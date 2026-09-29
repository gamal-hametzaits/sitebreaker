(() => {
  const old = window.__sitebreaker;
  if (old) { old.stop(); return; }

  // No network calls. The only page data used is geometry and a small visual clone.
  const host = document.createElement('div');
  host.id = 'sitebreaker-overlay';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = `
    :host { all:initial; }
    *, *::before, *::after {box-sizing:border-box}
    .hud {position:fixed;top:16px;left:16px;display:flex;align-items:center;gap:10px;background:#111b;color:white;border:1px solid #ffffff44;border-radius:999px;padding:8px 12px;font:600 13px/1.2 system-ui,sans-serif;direction:rtl;box-shadow:0 4px 20px #0005;pointer-events:auto}
    button {background:#ff674e;border:0;border-radius:999px;color:#190d09;font:700 13px system-ui;cursor:pointer;padding:7px 12px}
    canvas {position:fixed;inset:0;width:100%;height:100%;pointer-events:none}
    .shard {position:fixed;overflow:hidden;pointer-events:none;transform-origin:center;will-change:transform,opacity;animation:scatter .75s cubic-bezier(.2,.75,.25,1) forwards;box-shadow:0 0 2px #2225}
    @keyframes scatter {to {transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}
    .hint {position:fixed;bottom:18px;left:50%;transform:translateX(-50%);padding:7px 12px;border-radius:8px;background:#111c;color:white;font:12px system-ui;direction:rtl;white-space:nowrap;pointer-events:none}
  `;
  const canvas = document.createElement('canvas');
  const hud = document.createElement('div'); hud.className='hud';
  const score = document.createElement('span'); score.textContent='💥 0';
  const close = document.createElement('button'); close.textContent='סיום'; close.title='החזר רכיבים וסגור';
  hud.append(score, close);
  const hint = document.createElement('div'); hint.className='hint'; hint.textContent='לחץ על רכיב באתר כדי לירות • Esc לסיום';
  shadow.append(style, canvas, hud, hint);
  document.documentElement.append(host);
  const ctx = canvas.getContext('2d');
  let w=0,h=0,dpr=1,raf=0,running=true,points=0,projectiles=[],particles=[],hidden=new Map(),shards=[];
  const player={x:Math.min(innerWidth*.2,160), y:innerHeight-76};
  const cap=(v,min,max)=>Math.max(min,Math.min(max,v));
  function resize(){ dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);player.x=cap(player.x,25,w-25);player.y=h-76; }
  resize();
  function pick(x,y){
    if (x<0||y<0||x>w||y>h) return null;
    let el=document.elementFromPoint(x,y);
    while (el && el!==document.body && el!==document.documentElement) {
      const r=el.getBoundingClientRect();
      const tag=el.tagName;
      if (!hidden.has(el) && !['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','OPTION','VIDEO','IFRAME','CANVAS','SVG'].includes(tag) && r.width>=28 && r.height>=14 && r.width<=w*.85 && r.height<=h*.65 && getComputedStyle(el).visibility!=='hidden') return el;
      el=el.parentElement;
    }
    return null;
  }
  function burst(x,y,element){
    for(let i=0;i<25;i++){let a=Math.random()*Math.PI*2,s=2+Math.random()*8;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:30+Math.random()*25,color:['#ff674e','#ffcc6e','#fff2d0','#aee5ff'][i%4]});}
    if(!element) return;
    const rect=element.getBoundingClientRect();
    // Avoid exposing form contents; visual shards use only computed background color.
    const cs=getComputedStyle(element);
    const background=cs.backgroundColor==='rgba(0, 0, 0, 0)'?'#ddd':cs.backgroundColor;
    const cols=cap(Math.ceil(rect.width/44),2,9),rows=cap(Math.ceil(rect.height/44),2,7);
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const piece=document.createElement('div');piece.className='shard';
      const px=rect.left+col*rect.width/cols,py=rect.top+row*rect.height/rows;
      piece.style.left=px+'px';piece.style.top=py+'px';piece.style.width=rect.width/cols+'px';piece.style.height=rect.height/rows+'px';
      piece.style.background=background;
      piece.style.border='1px solid #ffffff88';
      piece.style.setProperty('--dx',((px+rect.width/cols/2-x)*.5+(Math.random()-.5)*150)+'px');
      piece.style.setProperty('--dy',((py+rect.height/rows/2-y)*.5-70-Math.random()*120)+'px');
      piece.style.setProperty('--rot',((Math.random()-.5)*250)+'deg');
      shadow.append(piece);shards.push(piece);setTimeout(()=>{piece.remove();shards=shards.filter(s=>s!==piece)},850);
    }
    hidden.set(element,element.style.getPropertyValue('visibility'));
    element.style.setProperty('visibility','hidden','important');
    points++;score.textContent='💥 '+points;
  }
  function shoot(e){
    if (!running || e.button!==0 || e.target===host || e.composedPath().includes(host)) return;
    // Capture click only during play, so the page does not follow links or submit forms.
    e.preventDefault(); e.stopImmediatePropagation();
    const x=e.clientX,y=e.clientY,target=pick(x,y);
    projectiles.push({x:player.x+18,y:player.y-23,tx:x,ty:y,target,progress:0});
  }
  function key(e){if(e.key==='Escape'){e.preventDefault();stop();}}
  function draw(){
    if(!running)return;
    ctx.clearRect(0,0,w,h);
    // Ground shadow and articulated stickman, following the last shot direction.
    ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(player.x,player.y+20,27,5,0,0,7);ctx.fill();
    ctx.strokeStyle='#1b273b';ctx.lineWidth=5;ctx.lineCap='round';
    const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke()};
    line(player.x,player.y-39,player.x,player.y-5);line(player.x,player.y-5,player.x-13,player.y+18);line(player.x,player.y-5,player.x+15,player.y+18);
    line(player.x,player.y-29,player.x-12,player.y-15);line(player.x,player.y-29,player.x+22,player.y-32);
    ctx.fillStyle='#f9e8cc';ctx.beginPath();ctx.arc(player.x,player.y-51,11,0,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#394957';ctx.fillRect(player.x+18,player.y-36,22,8);
    projectiles=projectiles.filter(p=>{
      p.progress+=.065;const t=Math.min(1,p.progress);const x=p.x+(p.tx-p.x)*t,y=p.y+(p.ty-p.y)*t-55*Math.sin(Math.PI*t);
      ctx.strokeStyle='#ff873d';ctx.lineWidth=3;line(x-13,y+3,x-3,y);ctx.fillStyle='#fff2ae';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();
      if(t>=1){burst(p.tx,p.ty,p.target?.isConnected?p.target:null);return false;}return true;
    });
    particles=particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.2;p.life--;ctx.globalAlpha=cap(p.life/35,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);ctx.globalAlpha=1;return p.life>0;});
    raf=requestAnimationFrame(draw);
  }
  function stop(){
    if(!running)return;running=false;cancelAnimationFrame(raf);
    document.removeEventListener('click',shoot,true);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',resize);
    hidden.forEach((value,el)=>{if(el.isConnected){if(value)el.style.setProperty('visibility',value);else el.style.removeProperty('visibility');}});
    hidden.clear();host.remove();delete window.__sitebreaker;
  }
  close.addEventListener('click',stop);
  document.addEventListener('click',shoot,true);document.addEventListener('keydown',key,true);window.addEventListener('resize',resize);
  window.__sitebreaker={stop};draw();
})();

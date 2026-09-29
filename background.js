chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:\/\//.test(tab.url || '')) return;
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['content.js']});
  } catch (error) {
    console.warn('Sitebreaker cannot run on this page:', error);
  }
});

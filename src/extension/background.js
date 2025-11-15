// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisible') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse(dataUrl);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'createCalendarEvent') {
    // TODO: Integrate your calendar function here
    // Example: createGoogleCalendarEvent(request.dataUrl);
    console.log('Calendar event creation triggered with screenshot');
  }
});
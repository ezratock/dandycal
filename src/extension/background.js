chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === "captureVisible") {
		chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
			sendResponse(dataUrl);
		});
		return true;
	}
	if (request.action === "createCalendarEvent") {
		createCalendarUrlFromImage(request.base64Image, GEMINI_API_KEY).then(({ event, url }) => {
			sendResponse({ success: true, event, url });
		}).catch((error) => {
			console.error(error);
			sendResponse({ success: false, error: error.message });
		});
		return true;
	}
	if (request.action === "openUrl") {
		console.log("Opening new tab " + request.url);
		chrome.tabs.create({ url: request.url });
		return true;
	}
});

// src/extension/background.js
import { createCalendarUrlFromImage } from '../lib/calUrlFromImage.js';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === "captureVisible") {
		chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
			sendResponse(dataUrl);
		});
		return true;
	}

	if (request.action === "createCalendarEvent") {
		chrome.storage.sync.get(['geminiApiKey'], (result) => {
			const apiKey = result.geminiApiKey;

			if (!apiKey) {
				sendResponse({
					success: false,
					error: 'API key not configured. Please set it in extension options.'
				});
				return;
			}

			createCalendarUrlFromImage(request.base64Image, apiKey)
				.then(({ event, url }) => {
					sendResponse({ success: true, event, url });
				})
				.catch((error) => {
					console.error(error);
					sendResponse({ success: false, error: error.message });
				});
		});
		return true;
	}

	if (request.action === "openUrl") {
		console.log("Opening new tab " + request.url);
		chrome.tabs.create({ url: request.url });
		return true;
	}

	if (message.action === 'screenshotComplete') {
		chrome.action.openPopup();
	}
});

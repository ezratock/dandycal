import { createCalendarUrlFromImage } from '../lib/calUrlFromImage.js';

function setPopupStatus(status) {
	// status is an object like: { state: 'loading', text: '...' }
	chrome.storage.local.set({ popupStatus: status });
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === 'captureVisible') {
		chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
			if (chrome.runtime.lastError) {
				console.error('captureVisible error:', chrome.runtime.lastError);
				sendResponse(null);
				return;
			}
			sendResponse(dataUrl);
		});
		return true;
	}

	if (request.action === 'createCalendarEvent') {
		const loadingStatus = {
			state: 'loading',
			text: 'Processing screenshot...',
		};
		setPopupStatus(loadingStatus);

		// Try to open the popup (may fail if not considered a user gesture)
		chrome.action.openPopup?.();
		if (chrome.runtime.lastError) {
			console.warn('openPopup error:', chrome.runtime.lastError.message);
		}

		// Best-effort live update (works only if popup is already open & listening)
		chrome.runtime.sendMessage({
			action: 'showLoading',
			text: loadingStatus.text,
		});

		chrome.storage.sync.get(['geminiApiKey'], (result) => {
			const apiKey = result.geminiApiKey;

			if (!apiKey) {
				const errorMsg =
					'API key not configured. Please set it in extension options.';

				const errorStatus = { state: 'error', text: errorMsg };
				setPopupStatus(errorStatus);

				chrome.runtime.sendMessage({
					action: 'hideLoading',
					text: errorMsg,
				});

				sendResponse({
					success: false,
					error: errorMsg,
				});
				return;
			}

			createCalendarUrlFromImage(request.base64Image, apiKey)
				.then(({ event, url }) => {
					const successText = '';
					const successStatus = { state: 'done', text: successText };
					setPopupStatus(successStatus);

					chrome.runtime.sendMessage({
						action: 'showLoading',
						text: successText,
					});

					sendResponse({ success: true, event, url });
				})
				.catch((error) => {
					console.error(error);

					const errText =
						error?.message || 'Failed to process screenshot.';
					const errorStatus = { state: 'error', text: errText };
					setPopupStatus(errorStatus);

					chrome.runtime.sendMessage({
						action: 'showLoading',
						text: errText,
					});

					sendResponse({
						success: false,
						error: error.message,
					});
				})
		});

		return true;
	}

	if (request.action === 'openUrl') {
		console.log('Opening new tab ' + request.url);
		chrome.tabs.create({ url: request.url }, () => {
			if (chrome.runtime.lastError) {
				console.error('openUrl error:', chrome.runtime.lastError);
			}
			sendResponse?.({ success: true });
			chrome.runtime.sendMessage({
				action: 'hideLoading',
				text: errorMsg,
			});
		});

		return true;
	}

	if (request.action === 'openPopup') {
		chrome.action.openPopup?.();
	}
});

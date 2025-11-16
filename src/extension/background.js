import { createCalendarUrlFromImage } from '../lib/calUrlFromImage.js';

function setPopupStatus(status) {
	// status is an object like: { state: 'loading', text: '...' }
	chrome.storage.local.set({ popupStatus: status });
}

async function startAreaSelectionCapture() {
	try {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});

		if (!tab || !tab.id) {
			console.warn('No active tab found for capture.');
			return;
		}

		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['src/extension/content.js'],
		});
	} catch (error) {
		console.error('Failed to start area selection capture:', error);
	}
}

async function handleCaptureVisible(sendResponse) {
	try {
		const dataUrl = await chrome.tabs.captureVisibleTab(null, {
			format: 'png',
		});
		sendResponse(dataUrl);
	} catch (error) {
		console.error('captureVisible error:', error);
		sendResponse(null);
	}
}

async function handleCreateCalendarEvent(request, sendResponse) {
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

	// Delay 100ms so the popup has time to open and listen before sending
	await new Promise((resolve) => setTimeout(resolve, 100));
	chrome.runtime.sendMessage({
		action: 'showLoading',
		text: loadingStatus.text,
	});

	try {
		const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
		const apiKey = geminiApiKey;

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

		const { event, url } = await createCalendarUrlFromImage(
			request.base64Image,
			apiKey,
		);

		const successText = '';
		const successStatus = { state: 'done', text: successText };
		setPopupStatus(successStatus);

		chrome.runtime.sendMessage({
			action: 'hideLoading',
			text: successText,
		});

		sendResponse({ success: true, event, url });
	} catch (error) {
		console.error(error);

		const errText = error?.message || 'Failed to process screenshot.';
		const errorStatus = { state: 'error', text: errText };
		setPopupStatus(errorStatus);

		chrome.runtime.sendMessage({
			action: 'hideLoading',
			text: errText,
		});

		sendResponse({
			success: false,
			error: errText,
		});
	}
}

async function handleOpenUrl(request, sendResponse) {
	try {
		await chrome.tabs.create({ url: request.url });
		sendResponse?.({ success: true });

		chrome.runtime.sendMessage({
			action: 'hideLoading',
			text: request.text || '',
		});
	} catch (error) {
		console.error('openUrl error:', error);
		sendResponse?.({ success: false, error: error.message });

		chrome.runtime.sendMessage({
			action: 'hideLoading',
			text: error.message,
		});
	}
}

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
	if (command === 'capture-screenshot') {
		// Start the same area-selection flow as the popup button
		startAreaSelectionCapture();
	}
});

// Message router
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	if (request.action === 'captureVisible') {
		handleCaptureVisible(sendResponse);
		return true;
	}

	if (request.action === 'createCalendarEvent') {
		handleCreateCalendarEvent(request, sendResponse);
		return true;
	}

	if (request.action === 'openUrl') {
		handleOpenUrl(request, sendResponse);
		return true;
	}

	if (request.action === 'openPopup') {
		chrome.action.openPopup?.();
	}

	return false;
});

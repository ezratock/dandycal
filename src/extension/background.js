import { createCalendarUrlFromImage, createCalendarUrlFromText } from '../lib/calUrlFromImage.js';

function setPopupStatus(status) {
    // status is an object like: { state: 'loading', text: '...' }
    chrome.storage.local.set({ popupStatus: status });
}

function resetCancellation() {
    // Reset the cancellation flag so user can make new selections
    chrome.storage.local.set({ userCancelled: false });
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

        // Check if user cancelled while we were processing
        const { userCancelled } = await chrome.storage.local.get(['userCancelled']);
        if (userCancelled) {
            const cancelText = 'Cancelled';
            const cancelStatus = { state: 'error', text: cancelText };
            setPopupStatus(cancelStatus);

            chrome.runtime.sendMessage({
                action: 'hideLoading',
                text: cancelText,
            });

            sendResponse({
                success: false,
                error: 'User cancelled the operation',
            });
            return;
        }

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
    } finally {
        // Reset cancellation flag after operation completes
        resetCancellation();
    }
}

async function handleParseElementText(request, sendResponse) {
    const loadingStatus = {
        state: 'loading',
        text: 'Processing element text...',
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

        const { event, url } = await createCalendarUrlFromText(
            request.textContent,
            apiKey,
        );

        // Check if user cancelled while we were processing
        const { userCancelled } = await chrome.storage.local.get(['userCancelled']);
        if (userCancelled) {
            const cancelText = 'Cancelled';
            const cancelStatus = { state: 'error', text: cancelText };
            setPopupStatus(cancelStatus);

            chrome.runtime.sendMessage({
                action: 'hideLoading',
                text: cancelText,
            });

            sendResponse({
                success: false,
                error: 'User cancelled the operation',
            });
            return;
        }

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

        const errText = error?.message || 'Failed to process element text.';
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
    } finally {
        // Reset cancellation flag after operation completes
        resetCancellation();
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

async function handleDownloadText(request, sendResponse) {
	const loadingStatus = {
		state: 'loading',
		text: 'Processing text to calendar event...',
	};
	setPopupStatus(loadingStatus);

	// Try to open the popup
	chrome.action.openPopup?.();
	if (chrome.runtime.lastError) {
		console.warn('openPopup error:', chrome.runtime.lastError.message);
	}

	// Delay 100ms so the popup has time to open and listen before sending
	await new Promise((resolve) => setTimeout(resolve, 100));
	try {
		chrome.runtime.sendMessage({
			action: 'showLoading',
			text: loadingStatus.text,
		});
	} catch (e) {
		console.warn('Failed to send showLoading:', e);
	}

	try {
		const textContent = request.textContent;

		if (!textContent || !textContent.trim()) {
			throw new Error('No text content provided.');
		}

		const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
		const apiKey = geminiApiKey;

		if (!apiKey) {
			const errorMsg =
				'API key not configured. Please set it in extension options.';

			const errorStatus = { state: 'error', text: errorMsg };
			setPopupStatus(errorStatus);

			try {
				chrome.runtime.sendMessage({
					action: 'hideLoading',
					text: errorMsg,
				});
			} catch (e) {
				console.warn('Failed to send hideLoading:', e);
			}

			sendResponse({
				success: false,
				error: errorMsg,
			});
			return;
		}

		const { event, url } = await createCalendarUrlFromText(
			textContent,
			apiKey,
		);

		// Check if user cancelled while we were processing
		const { userCancelled } = await chrome.storage.local.get(['userCancelled']);
		if (userCancelled) {
			const cancelText = 'Cancelled';
			const cancelStatus = { state: 'error', text: cancelText };
			setPopupStatus(cancelStatus);

			try {
				chrome.runtime.sendMessage({
					action: 'hideLoading',
					text: cancelText,
				});
			} catch (e) {
				console.warn('Failed to send hideLoading:', e);
			}

			sendResponse({
				success: false,
				error: 'User cancelled the operation',
			});
			return;
		}

		const successText = '';
		const successStatus = { state: 'done', text: successText };
		setPopupStatus(successStatus);

		try {
			chrome.runtime.sendMessage({
				action: 'hideLoading',
				text: successText,
			});
		} catch (e) {
			console.warn('Failed to send hideLoading:', e);
		}

		// Open the calendar URL
		await chrome.tabs.create({ url: url });

		sendResponse({ success: true, event, url });
	} catch (error) {
		console.error('Text to calendar error:', error);

		const errText = error?.message || 'Failed to process text.';
		const errorStatus = { state: 'error', text: errText };
		setPopupStatus(errorStatus);

		try {
			chrome.runtime.sendMessage({
				action: 'hideLoading',
				text: errText,
			});
		} catch (e) {
			console.warn('Failed to send hideLoading:', e);
		}

		sendResponse({
			success: false,
			error: errText,
		});
	} finally {
		// Reset cancellation flag after operation completes
		resetCancellation();
	}
}

async function handleCaptureFullScreen(sendResponse) {
	try {
		// Wait a moment for popup to fully close
		await new Promise(resolve => setTimeout(resolve, 150));

		// Capture the full visible tab (popup is now closed, won't be in screenshot)
		const fullCapture = await chrome.tabs.captureVisibleTab(null, {
			format: 'png',
		});

		if (!fullCapture) {
			throw new Error('Failed to capture screen.');
		}

		// Convert data URL to base64
		const base64Data = fullCapture.split(',')[1];

		// Set processing status
		const loadingStatus = {
			state: 'loading',
			text: 'Processing screenshot...',
		};
		setPopupStatus(loadingStatus);

		// Try to reopen popup to show processing status
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

		// Get API key
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

		// Process with Gemini
		const { event, url } = await createCalendarUrlFromImage(
			base64Data,
			apiKey,
		);

		// Check if user cancelled while we were processing
		const { userCancelled } = await chrome.storage.local.get(['userCancelled']);
		if (userCancelled) {
			const cancelText = 'Cancelled';
			const cancelStatus = { state: 'error', text: cancelText };
			setPopupStatus(cancelStatus);

			chrome.runtime.sendMessage({
				action: 'hideLoading',
				text: cancelText,
			});

			sendResponse({
				success: false,
				error: 'User cancelled the operation',
			});
			return;
		}

		// Success - open the calendar URL
		const successText = '';
		const successStatus = { state: 'done', text: successText };
		setPopupStatus(successStatus);

		chrome.runtime.sendMessage({
			action: 'hideLoading',
			text: successText,
		});

		// Open the calendar URL
		await chrome.tabs.create({ url: url });

		sendResponse({ success: true, event, url });
	} catch (error) {
		console.error('Full screen capture error:', error);

		const errText = error?.message || 'Failed to capture full screen.';
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
	} finally {
		// Reset cancellation flag after operation completes
		resetCancellation();
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

	if (request.action === 'parseElementText') {
		handleParseElementText(request, sendResponse);
		return true;
	}

	if (request.action === 'openUrl') {
		handleOpenUrl(request, sendResponse);
		return true;
	}

	if (request.action === 'captureFullScreen') {
		handleCaptureFullScreen(sendResponse);
		return true;
	}

	if (request.action === 'downloadText') {
		handleDownloadText(request, sendResponse);
		return true;
	}

	if (request.action === 'openPopup') {
		chrome.action.openPopup?.();
	}

	return false;
});
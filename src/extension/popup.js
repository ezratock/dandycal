document.addEventListener('DOMContentLoaded', () => {
	const statusEl = document.getElementById('status');
	const statusText = document.getElementById('statusText');
	const captureBtn = document.getElementById('captureBtn');
	const shortcutLink = document.getElementById('shortcutLink');
	const shortcutKey = document.getElementById('shortcutKey');

	let isProcessing = false;

	// Load the actual keyboard shortcut from Chrome settings
	chrome.commands.getAll((commands) => {
		const captureCommand = commands.find(
			(cmd) => cmd.name === 'capture-screenshot',
		);
		if (captureCommand && captureCommand.shortcut) {
			shortcutKey.textContent = captureCommand.shortcut;
		} else {
			shortcutKey.textContent = 'none set';
		}
	});

	// Make shortcut text clickable to open shortcuts settings
	shortcutLink.addEventListener('click', (e) => {
		e.preventDefault();
		chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
	});

	// Restore last known popup status (e.g., from background processing)
	chrome.storage.local.get('popupStatus', ({ popupStatus }) => {
		if (!popupStatus) return;

		if (popupStatus.state === 'loading') {
			isProcessing = true;
			captureBtn.textContent = 'Cancel';
			captureBtn.classList.add('cancel-mode');
			statusText.textContent = popupStatus.text || 'Processing...';
			statusEl.classList.add('show', 'loading');
		} else if (
			popupStatus.state === 'done' ||
			popupStatus.state === 'error'
		) {
			statusText.textContent = popupStatus.text || '';
			statusEl.classList.add('show');
			statusEl.classList.remove('loading');
		}
	});

	// Start area-selection capture or cancel when the button is clicked
	captureBtn.addEventListener('click', async () => {
		if (isProcessing) {
			// In processing mode - this is a CANCEL click
			isProcessing = false;
			chrome.storage.local.set({ userCancelled: true });
			captureBtn.textContent = 'Take Screenshot';
			captureBtn.classList.remove('cancel-mode');  
			statusEl.classList.remove('show', 'loading', 'error');
        	statusText.textContent = '';
			// Clear the stored popup status so it resets next time
			chrome.storage.local.set({ popupStatus: null });
			// Close popup like the initial screenshot button does
			window.close();
			return;
		}
		
		// In initial mode - this is a TAKE SCREENSHOT click
		try {
			statusText.textContent = 'Select an area...';
			statusEl.classList.add('show');
			statusEl.classList.remove('loading', 'error');

			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab || !tab.id) {
				throw new Error('No active tab found.');
			}

			// Reset cancel flag for new capture
			chrome.storage.local.set({ userCancelled: false });

			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ['src/extension/content.js'],
			});

			// Close popup so user can see the page and select area
			window.close();
		} catch (error) {
			console.error('Screenshot error:', error);
			statusText.textContent = '✗ Error starting capture';
			statusEl.classList.add('show', 'error');

			setTimeout(() => {
				statusEl.classList.remove('show', 'error');
			}, 3000);
		}
	});

	// Live status updates from background.js
	chrome.runtime.onMessage.addListener((message) => {
		console.log('received message to update loading status');

		if (message.action === 'showLoading') {
			// Processing has started - switch to cancel mode
			isProcessing = true;
			captureBtn.textContent = 'Cancel';
			captureBtn.classList.add('cancel-mode');
			statusText.textContent = message.text || 'Processing...';
			statusEl.classList.add('show', 'loading');
		} else if (message.action === 'hideLoading') {
			statusEl.classList.remove('loading');

			if (message.text) {
				statusText.textContent = message.text;
				setTimeout(() => {
					statusEl.classList.remove('show');
					// Close popup after showing completion
					window.close();
				}, 3000);
			} else {
				statusEl.classList.remove('show');
				window.close();
			}

			// Reset to initial state
			isProcessing = false;
			captureBtn.textContent = 'Take Screenshot';
			captureBtn.classList.remove('cancel-mode');
		}
	});
});

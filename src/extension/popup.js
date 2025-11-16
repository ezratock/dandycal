document.addEventListener('DOMContentLoaded', () => {
	const statusEl = document.getElementById('status');
	const statusText = document.getElementById('statusText');
	const captureRegionBtn = document.getElementById('captureRegionBtn');
	const captureFullBtn = document.getElementById('captureFullBtn');
	const cancelBtn = document.getElementById('cancelBtn');
	const captureButtons = document.getElementById('captureButtons');
	const shortcutLink = document.getElementById('shortcutLink');
	const shortcutKey = document.getElementById('shortcutKey');

	let isProcessing = false;
	let isCancelling = false;

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
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			statusText.textContent = popupStatus.text || 'Processing...';
			statusEl.classList.add('show', 'loading');
		} else if (popupStatus.state === 'cancelling') {
			isCancelling = true;
			isProcessing = false;
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
			// Disable buttons during cancellation
			captureRegionBtn.disabled = true;
			captureFullBtn.disabled = true;
			statusText.textContent = 'Cancelling request...';
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

	// Capture Selected Region button handler
	captureRegionBtn.addEventListener('click', async () => {
		// Don't allow new requests while cancelling
		if (isCancelling) return;

		try {
			// Hide capture buttons, show cancel button
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			isProcessing = true;

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
			console.error('Region capture error:', error);
			statusText.textContent = '✗ Error starting capture';
			statusEl.classList.add('show', 'error');

			// Reset button states on error
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
			isProcessing = false;

			setTimeout(() => {
				statusEl.classList.remove('show', 'error');
			}, 3000);
		}
	});

	// Capture Entire Screen button handler
	captureFullBtn.addEventListener('click', async () => {
		// Don't allow new requests while cancelling
		if (isCancelling) return;

		try {
			// Reset cancel flag for new capture
			chrome.storage.local.set({ userCancelled: false });

			// Send message to background to handle full screen capture
			// Background will close popup, capture, and process
			chrome.runtime.sendMessage({
				action: 'captureFullScreen',
			});

			// Close popup immediately so it's not in the screenshot
			window.close();
		} catch (error) {
			console.error('Full screen capture error:', error);
			statusText.textContent = '✗ Error capturing full screen';
			statusEl.classList.add('show', 'error');
			statusEl.classList.remove('loading');

			// Reset button states on error
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
			isProcessing = false;

			setTimeout(() => {
				statusEl.classList.remove('show', 'error');
			}, 3000);
		}
	});

	// Cancel button handler
	cancelBtn.addEventListener('click', () => {
		// Set cancellation flag
		chrome.storage.local.set({ userCancelled: true });

		// Enter cancelling state
		isCancelling = true;
		isProcessing = false;

		// Show capture buttons but disabled
		captureButtons.style.display = 'flex';
		cancelBtn.style.display = 'none';
		captureRegionBtn.disabled = true;
		captureFullBtn.disabled = true;

		// Show cancelling status with spinner
		statusText.textContent = 'Cancelling request...';
		statusEl.classList.add('show', 'loading');
		statusEl.classList.remove('error');

		// Store cancelling status
		chrome.storage.local.set({
			popupStatus: {
				state: 'cancelling',
				text: 'Cancelling request...'
			}
		});
	});

	// Live status updates from background.js
	chrome.runtime.onMessage.addListener((message) => {
		console.log('received message to update loading status');

		if (message.action === 'showLoading') {
			// Processing has started - show cancel button
			isProcessing = true;
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			statusText.textContent = message.text || 'Processing...';
			statusEl.classList.add('show', 'loading');
		} else if (message.action === 'hideLoading') {
			statusEl.classList.remove('loading');

			// Reset to initial state
			isProcessing = false;
			const wasCancelling = isCancelling;
			isCancelling = false;
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
			// Re-enable buttons
			captureRegionBtn.disabled = false;
			captureFullBtn.disabled = false;

			if (message.text) {
				statusText.textContent = message.text;

				// Only close popup automatically if it was a successful completion (not cancellation)
				if (!wasCancelling && message.text !== 'Cancelled') {
					setTimeout(() => {
						statusEl.classList.remove('show');
						// Close popup after showing completion
						window.close();
					}, 3000);
				} else {
					// For cancellation, just hide the status after 3 seconds but keep popup open
					setTimeout(() => {
						statusEl.classList.remove('show');
					}, 3000);
				}
			} else {
				statusEl.classList.remove('show');
				// Only close if not cancelled
				if (!wasCancelling) {
					window.close();
				}
			}
		}
	});
});

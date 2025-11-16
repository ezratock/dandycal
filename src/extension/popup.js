document.addEventListener('DOMContentLoaded', () => {
	const statusEl = document.getElementById('status');
	const statusText = document.getElementById('statusText');
	const captureRegionBtn = document.getElementById('captureRegionBtn');
	const captureFullBtn = document.getElementById('captureFullBtn');
	const selectTextBtn = document.getElementById('selectTextBtn');
	const cancelBtn = document.getElementById('cancelBtn');
	const captureButtons = document.getElementById('captureButtons');
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
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
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

	// Capture Selected Region button handler
	captureRegionBtn.addEventListener('click', async () => {
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

		// Reset UI
		captureButtons.style.display = 'flex';
		cancelBtn.style.display = 'none';
		isProcessing = false;
		statusEl.classList.remove('show', 'loading', 'error');
		statusText.textContent = '';

		// Clear the stored popup status so it resets next time
		chrome.storage.local.set({ popupStatus: null });

		// Close popup
		window.close();
	});

	// Select Text & Download button handler
	selectTextBtn.addEventListener('click', async () => {
		try {
			// Hide capture buttons, show cancel button
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			isProcessing = true;

			statusText.textContent = 'Select text on the page and we\'ll download it...';
			statusEl.classList.add('show');
			statusEl.classList.remove('loading', 'error');

			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab || !tab.id) {
				throw new Error('No active tab found.');
			}

			// Reset cancel flag for new selection
			chrome.storage.local.set({ userCancelled: false });

			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ['src/extension/text-selector.js'],
			});

			// Close popup so user can see the page and select text
			window.close();
		} catch (error) {
			console.error('Text selection error:', error);
			statusText.textContent = '✗ Error starting text selection';
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
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
		}
	});
});

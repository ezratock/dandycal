// Camera shutter sound effect
function playCameraSound() {
	// Check if sound is enabled
	chrome.storage.local.get(['soundEnabled'], ({ soundEnabled }) => {
		if (soundEnabled === false) {
			return; // Sound is muted
		}

		try {
			const audio = new Audio('assets/camera-13695.mp3');
			audio.volume = 0.5;
			audio.play().catch(err => console.warn('Failed to play camera sound:', err));
		} catch (error) {
			console.warn('Failed to play camera sound:', error);
		}
	});
}

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
	const volumeToggle = document.getElementById('volumeToggle');

	let isProcessing = false;
	let isCancelling = false;

	// Load and set initial volume icon state
	chrome.storage.local.get(['soundEnabled'], ({ soundEnabled }) => {
		// Default to enabled if not set
		const isEnabled = soundEnabled !== false;
		updateVolumeIcon(isEnabled);
	});

	// Update volume icon based on state
	function updateVolumeIcon(isEnabled) {
		if (isEnabled) {
			volumeToggle.src = 'assets/volume.png';
			volumeToggle.alt = 'Volume On';
		} else {
			volumeToggle.src = 'assets/mute.png';
			volumeToggle.alt = 'Volume Off';
		}
	}

	// Volume toggle click handler
	volumeToggle.addEventListener('click', () => {
		chrome.storage.local.get(['soundEnabled'], ({ soundEnabled }) => {
			// Toggle the state (default to enabled if not set)
			const currentState = soundEnabled !== false;
			const newState = !currentState;

			// Save new state
			chrome.storage.local.set({ soundEnabled: newState });

			// Update icon
			updateVolumeIcon(newState);
		});
	});

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
			// Play camera shutter sound
			playCameraSound();

			// Reset cancel flag for new capture
			chrome.storage.local.set({ userCancelled: false });

			// Show processing UI
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			isProcessing = true;
			statusText.textContent = 'Capturing screen...';
			statusEl.classList.add('show', 'loading');

			// Send message to background to handle full screen capture
			// Background will close popup, capture, and process
			chrome.runtime.sendMessage({
				action: 'captureFullScreen',
			});

			// Don't close popup - let user cancel if needed
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
		selectTextBtn.disabled = true;

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

	// Select Text button handler
	selectTextBtn.addEventListener('click', async () => {
		// Don't allow new requests while cancelling
		if (isCancelling) return;

		try {
			// Hide capture buttons, show cancel button
			captureButtons.style.display = 'none';
			cancelBtn.style.display = 'block';
			isProcessing = true;

			statusText.textContent = 'Select text on the page...';
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

			// Reset to initial state
			isProcessing = false;
			const wasCancelling = isCancelling;
			isCancelling = false;
			captureButtons.style.display = 'flex';
			cancelBtn.style.display = 'none';
			// Re-enable buttons
			captureRegionBtn.disabled = false;
			captureFullBtn.disabled = false;
			selectTextBtn.disabled = false;

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

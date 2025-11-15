document.getElementById('captureBtn').addEventListener('click', async () => {
	const statusEl = document.getElementById('status');

	try {
		// Show instruction
		statusEl.textContent = 'Select an area...';
		statusEl.classList.add('show');

		// Get the active tab
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		// Inject the selection overlay
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['src/extension/content.js']
		});

		// Close the popup so user can see the page
		window.close();

	} catch (error) {
		console.error('Screenshot error:', error);
		statusEl.textContent = '✗ Error starting capture';
		statusEl.style.background = 'rgba(255, 0, 0, 0.3)';

		setTimeout(() => {
			statusEl.classList.remove('show');
			statusEl.style.background = 'rgba(255, 255, 255, 0.2)';
		}, 3000);
	}
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	const statusEl = document.getElementById('status');
	const statusText = document.getElementById('statusText');

	if (message.action === 'showLoading') {
		statusText.textContent = message.text || 'Processing...';
		statusEl.classList.add('show', 'loading');
	}

	else if (message.action === 'hideLoading') {
		statusEl.classList.remove('loading');
		if (message.text) {
			statusText.textContent = message.text;
			setTimeout(() => {
				statusEl.classList.remove('show');
			}, 3000);
		} else {
			statusEl.classList.remove('show');
		}
	}
});

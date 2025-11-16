document.addEventListener('DOMContentLoaded', () => {
	const statusEl = document.getElementById('status');
	const statusText = document.getElementById('statusText');
	const captureBtn = document.getElementById('captureBtn');

	chrome.storage.local.get('popupStatus', ({ popupStatus }) => {
		if (!popupStatus) return;

		if (popupStatus.state === 'loading') {
			statusText.textContent =
				popupStatus.text || 'Processing...';
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

	captureBtn.addEventListener('click', async () => {
		try {
			statusText.textContent = 'Select an area...';
			statusEl.classList.add('show');
			statusEl.classList.remove('loading', 'error');

			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ['src/extension/content.js'],
			});

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

	chrome.runtime.onMessage.addListener((message) => {
		console.log('recieved message to update loading status');

		if (message.action === 'showLoading') {
			statusText.textContent = message.text || 'Processing...';
			statusEl.classList.add('show', 'loading');
		} else if (message.action === 'hideLoading') {
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
});

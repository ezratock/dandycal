// Load saved API key on page load
document.addEventListener('DOMContentLoaded', async () => {
	const result = await chrome.storage.sync.get(['geminiApiKey']);
	if (result.geminiApiKey) {
		document.getElementById('apiKey').value = result.geminiApiKey;
	}
});

// Save API key
document.getElementById('saveBtn').addEventListener('click', async () => {
	const apiKey = document.getElementById('apiKey').value.trim();
	const statusEl = document.getElementById('status');

	if (!apiKey) {
		statusEl.textContent = 'Please enter an API key';
		statusEl.className = 'status error show';
		return;
	}

	try {
		await chrome.storage.sync.set({ geminiApiKey: apiKey });

		statusEl.textContent = '✓ Settings saved successfully!';
		statusEl.className = 'status success show';

		setTimeout(() => {
			statusEl.classList.remove('show');
		}, 3000);
	} catch (error) {
		console.error('Error saving settings:', error);
		statusEl.textContent = '✗ Error saving settings';
		statusEl.className = 'status error show';
	}
});

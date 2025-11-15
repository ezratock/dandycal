(function() {
	// Prevent multiple instances
	if (window.screenshotSelectorActive) return;
	window.screenshotSelectorActive = true;

	let startX, startY, endX, endY;
	let isSelecting = false;

	// Create overlay
	const overlay = document.createElement('div');
	overlay.id = 'screenshot-overlay';
	overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    cursor: crosshair;
    z-index: 999999;
  `;

	// Create selection box
	const selectionBox = document.createElement('div');
	selectionBox.id = 'screenshot-selection';
	selectionBox.style.cssText = `
    position: fixed;
    border: 2px solid #667eea;
    background: rgba(102, 126, 234, 0.1);
    display: none;
    z-index: 1000000;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
  `;

	// Create instruction text
	const instruction = document.createElement('div');
	instruction.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    color: #667eea;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 1000001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
	instruction.textContent = 'Click and drag to select area • ESC to cancel';

	document.body.appendChild(overlay);
	document.body.appendChild(selectionBox);
	document.body.appendChild(instruction);

	// Mouse down - start selection
	overlay.addEventListener('mousedown', (e) => {
		isSelecting = true;
		startX = e.clientX;
		startY = e.clientY;
		selectionBox.style.display = 'block';
		updateSelection(e.clientX, e.clientY);
	});

	// Mouse move - update selection
	overlay.addEventListener('mousemove', (e) => {
		if (!isSelecting) return;
		updateSelection(e.clientX, e.clientY);
	});

	// Mouse up - capture selection
	overlay.addEventListener('mouseup', async (e) => {
		if (!isSelecting) return;
		isSelecting = false;

		endX = e.clientX;
		endY = e.clientY;

		// Calculate selection bounds
		const x = Math.min(startX, endX);
		const y = Math.min(startY, endY);
		const width = Math.abs(endX - startX);
		const height = Math.abs(endY - startY);

		if (width < 10 || height < 10) {
			cleanup();
			return;
		}

		// Capture the screenshot
		await captureSelection(x, y, width, height);
	});

	// ESC to cancel
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			cleanup();
		}
	});

	function updateSelection(currentX, currentY) {
		const x = Math.min(startX, currentX);
		const y = Math.min(startY, currentY);
		const width = Math.abs(currentX - startX);
		const height = Math.abs(currentY - startY);

		selectionBox.style.left = x + 'px';
		selectionBox.style.top = y + 'px';
		selectionBox.style.width = width + 'px';
		selectionBox.style.height = height + 'px';
	}

	async function captureSelection(x, y, width, height) {
		try {
			console.log("Starting screen capture...")
			// Hide overlay temporarily
			overlay.style.display = 'none';
			selectionBox.style.display = 'none';
			instruction.style.display = 'none';

			// Wait a moment for UI to hide
			await new Promise(resolve => setTimeout(resolve, 100));

			// Use html2canvas to capture the selected area
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			canvas.width = width * window.devicePixelRatio;
			canvas.height = height * window.devicePixelRatio;

			// Capture full page first
			console.log("Requesting runtime capture screen")
			const fullCapture = await chrome.runtime.sendMessage({ action: 'captureVisible' });

			// Load image
			console.log("Creating image...")
			const img = new Image();
			img.onload = () => {
				// Calculate scaling
				const scale = window.devicePixelRatio;
				ctx.drawImage(
					img,
					x * scale, y * scale, width * scale, height * scale,
					0, 0, width * scale, height * scale
				);

				// Convert to data URL
				const dataUrl = canvas.toDataURL('image/png');

				// Extract base64 from data URL
				const base64Data = dataUrl.split(',')[1];


				chrome.runtime.sendMessage(
					{
						action: "createCalendarEvent",
						base64Image: base64Data,
					},
					(response) => {
						if (chrome.runtime.lastError) {
							console.error("Extension error:", chrome.runtime.lastError.message);
							cleanup();
							return;
						}

						if (!response || !response.success) {
							console.error("Failed to create calendar URL:", response?.error);
							cleanup();
							return;
						}

						const { url } = response;

						// now tell background to open the URL in a new tab
						chrome.runtime.sendMessage(
							{
								action: "openUrl",
								url,
							},
							() => {
								cleanup();
							}
						);
					}
				)
			};
			img.src = fullCapture;

		} catch (error) {
			console.error('Capture error:', error);
			cleanup();
		}
	}

	function cleanup() {
		overlay.remove();
		selectionBox.remove();
		instruction.remove();
		window.screenshotSelectorActive = false;
	}
})();

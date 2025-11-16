(function() {
	if (window.screenshotSelectorActive) return;
	window.screenshotSelectorActive = true;

	let startX = 0;
	let startY = 0;
	let isSelecting = false;
	let isDragSelection = false;
	let currentElement = null;

	const DRAG_THRESHOLD = 8;

	const overlay = document.createElement('div');
	overlay.id = 'screenshot-overlay';
	overlay.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    cursor: crosshair;
    z-index: 2147483646;
  `;

	const selectionBox = document.createElement('div');
	selectionBox.id = 'screenshot-selection';
	selectionBox.style.cssText = `
    position: fixed;
    border: 2px solid #667eea;
    background: rgba(102, 126, 234, 0.1);
    display: none;
    z-index: 2147483647;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  `;

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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
      Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  `;
	instruction.textContent =
		'Hover to select element • Click to capture • Drag to draw region • ' +
		'ESC to cancel';

	document.body.appendChild(overlay);
	document.body.appendChild(selectionBox);
	document.body.appendChild(instruction);

	function sendMessage(message) {
		return new Promise((resolve, reject) => {
			try {
				chrome.runtime.sendMessage(message, (response) => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}
					resolve(response);
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	function waitForNextFrame() {
		return new Promise((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(resolve);
			});
		});
	}

	// Drag-based selection (old behavior)
	function updateSelection(currentX, currentY) {
		const x = Math.min(startX, currentX);
		const y = Math.min(startY, currentY);
		const width = Math.abs(currentX - startX);
		const height = Math.abs(currentY - startY);

		selectionBox.style.left = `${x}px`;
		selectionBox.style.top = `${y}px`;
		selectionBox.style.width = `${width}px`;
		selectionBox.style.height = `${height}px`;
		selectionBox.style.display = 'block';
	}

	// Element-based selection helpers
	function getElementAtPoint(x, y) {
		// Temporarily let events hit the page to detect the underlying element
		overlay.style.pointerEvents = 'none';
		const el = document.elementFromPoint(x, y);
		overlay.style.pointerEvents = 'auto';
		return el || null;
	}

	function updateElementSelectionAt(x, y) {
		const el = getElementAtPoint(x, y);
		if (!el) return;

		currentElement = el;
		const rect = el.getBoundingClientRect();

		selectionBox.style.display = 'block';
		selectionBox.style.left = `${rect.left}px`;
		selectionBox.style.top = `${rect.top}px`;
		selectionBox.style.width = `${rect.width}px`;
		selectionBox.style.height = `${rect.height}px`;
	}

	async function captureSelection(x, y, width, height) {
		console.log('Starting screen capture...');

		// Hide overlay elements from the capture
		overlay.style.display = 'none';
		selectionBox.style.display = 'none';
		instruction.style.display = 'none';

		// Ensure layout is updated before capturing
		await waitForNextFrame();

		console.log('Requesting runtime capture screen');
		const fullCapture = await sendMessage({
			action: 'captureVisible',
		});

		if (!fullCapture || typeof fullCapture !== 'string') {
			throw new Error('No capture data from background.');
		}

		console.log('Creating image and cropping...');
		const scale = window.devicePixelRatio || 1;

		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		const ctx = canvas.getContext('2d');

		const img = new Image();
		img.src = fullCapture;

		await new Promise((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () =>
				reject(new Error('Failed to load captured image.'));
		});

		ctx.drawImage(
			img,
			Math.round(x * scale),
			Math.round(y * scale),
			Math.round(width * scale),
			Math.round(height * scale),
			0,
			0,
			canvas.width,
			canvas.height
		);

		const dataUrl = canvas.toDataURL('image/png');
		const base64Data = dataUrl.split(',')[1];

		console.log('Sending to createCalendarEvent...');
		const createRes = await sendMessage({
			action: 'createCalendarEvent',
			base64Image: base64Data,
		});

		if (!createRes || !createRes.success || !createRes.url) {
			const msg =
				createRes && createRes.error
					? createRes.error
					: 'Failed to create calendar event.';
			throw new Error(msg);
		}

		return createRes.url;
	}

	function cleanup() {
		try {
			overlay.remove();
			selectionBox.remove();
			instruction.remove();
		} catch (e) {
			// ignore
		}
		document.removeEventListener('keydown', onKeydown, true);
		window.screenshotSelectorActive = false;
	}

	async function finishSelectionAndCapture(x, y, width, height) {
		try {
			const calendarUrl = await captureSelection(x, y, width, height);

			// Check if user cancelled before opening URL
			const { userCancelled } = await chrome.storage.local.get(['userCancelled']);
			
			if (!userCancelled) {
				await sendMessage({
					action: 'openUrl',
					url: calendarUrl,
				});
			}
		} catch (error) {
			console.error('Capture error:', error);
			// Optional: show an in-page error if you want
		} finally {
			cleanup();
		}
	}

	overlay.addEventListener('mousedown', (e) => {
		e.preventDefault();
		e.stopPropagation();

		isSelecting = true;
		isDragSelection = false;
		startX = e.clientX;
		startY = e.clientY;
	});

	overlay.addEventListener('mousemove', (e) => {
		e.preventDefault();
		e.stopPropagation();

		const x = e.clientX;
		const y = e.clientY;

		if (isSelecting) {
			const dx = x - startX;
			const dy = y - startY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (!isDragSelection && distance > DRAG_THRESHOLD) {
				// Switch into drag mode
				isDragSelection = true;
			}

			if (isDragSelection) {
				// Old behavior: free-form rectangular selection
				updateSelection(x, y);
			} else {
				// Still treating this as an element click; keep highlighting element
				updateElementSelectionAt(x, y);
			}
		} else {
			// Hover mode: highlight element under cursor
			updateElementSelectionAt(x, y);
		}
	});

	overlay.addEventListener('mouseup', (e) => {
		if (!isSelecting) return;

		e.preventDefault();
		e.stopPropagation();

		isSelecting = false;

		if (isDragSelection) {
			// Drag selection path (old behavior)
			const endX = e.clientX;
			const endY = e.clientY;

			const x = Math.min(startX, endX);
			const y = Math.min(startY, endY);
			const width = Math.abs(endX - startX);
			const height = Math.abs(endY - startY);

			if (width < 10 || height < 10) {
				// Tiny drag – treat as cancel
				cleanup();
				return;
			}

			finishSelectionAndCapture(x, y, width, height);
		} else {
			// Element click selection path
			const el =
				currentElement || getElementAtPoint(e.clientX, e.clientY);

			if (!el) {
				cleanup();
				return;
			}

			const rect = el.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				cleanup();
				return;
			}

			// Use the element's bounding box
			finishSelectionAndCapture(
				rect.left,
				rect.top,
				rect.width,
				rect.height
			);
		}
	});

	function onKeydown(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cleanup();
		}
	}

	document.addEventListener('keydown', onKeydown, true);
})();

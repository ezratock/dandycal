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
    position: fixed;    inset: 0;    width: 100vw;    height: 100vh;    background: rgba(0, 0, 0, 0.4);    cursor: crosshair;    z-index: 2147483646;  `;

    const selectionBox = document.createElement('div');
    selectionBox.id = 'screenshot-selection';
    selectionBox.style.cssText = `  
    position: fixed;    border: 2px solid #667eea;    background: rgba(102, 126, 234, 0.1);    display: none;    z-index: 2147483647;    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);    pointer-events: none;  `;

    const instruction = document.createElement('div');
    instruction.style.cssText = `  
    position: fixed;    top: 20px;    left: 50%;    transform: translateX(-50%);    background: white;    color: #667eea;    padding: 12px 24px;    border-radius: 8px;    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',      Roboto, sans-serif;    font-size: 14px;    font-weight: 600;    z-index: 2147483647;    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);    pointer-events: none;  `;
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

    /**
     * Determine if an element should be processed as text or as an image.     * Returns true if the element is primarily textual, false if it should be captured as an image.     */    function isTextualElement(element) {
        if (!element) return false;

        // List of inherently textual tags
        const textualTags = new Set([
            'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'U',
            'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'CODE',
            'LABEL', 'LEGEND', 'CAPTION', 'TH', 'TD',
            'DT', 'DD', 'CITE', 'Q', 'SMALL', 'MARK',
            'DEL', 'INS', 'SUB', 'SUP', 'ABBR', 'TIME'
        ]);

        // If the element itself is a textual tag, return true
        if (textualTags.has(element.tagName)) {
            return true;
        }

        // For container elements (DIV, SECTION, ARTICLE, etc.), check their contents
        const containerTags = new Set([
            'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER',
            'FOOTER', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION'
        ]);

        if (containerTags.has(element.tagName)) {
            // Check if the container has any image-related elements
            const hasImages = element.querySelector('img, svg, canvas, video, picture, iframe');
            if (hasImages) {
                return false; // Contains images, should be processed as image
            }

            // Check if the container has significant text content
            const textContent = (element.innerText || element.textContent || '').trim();
            if (textContent.length === 0) {
                return false; // No text, should be processed as image
            }

            // Check if all children are textual elements
            const allChildren = Array.from(element.querySelectorAll('*'));
            const hasNonTextualChildren = allChildren.some(child => {
                const tag = child.tagName;
                // If child is an image/media/canvas element
                if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'].includes(tag)) {
                    return true;
                }
                return false;
            });

            if (hasNonTextualChildren) {
                return false; // Contains non-textual children
            }

            // If we get here, it's a container with only textual content
            return true;
        }

        // For image/media elements, always process as image
        const visualTags = new Set([
            'IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'
        ]);

        if (visualTags.has(element.tagName)) {
            return false;
        }

        // For tables, check if they contain images
        if (element.tagName === 'TABLE') {
            const hasImages = element.querySelector('img, svg, canvas, video, picture');
            return !hasImages; // Text if no images, otherwise image
        }

        // Default: if it has text content and no images, treat as text
        const textContent = (element.innerText || element.textContent || '').trim();
        if (textContent.length > 0) {
            const hasImages = element.querySelector('img, svg, canvas, video, picture, iframe');
            return !hasImages;
        }

        // Default to image processing if we can't determine
        return false;
    }

    function updateElementSelectionAt(x, y) {
        const el = getElementAtPoint(x, y);
        if (!el) return;

        currentElement = el;
        const rect = el.getBoundingClientRect();

        const padding = 12;

        selectionBox.style.display = 'block';
        selectionBox.style.left = `${rect.left - padding}px`;
        selectionBox.style.top = `${rect.top - padding}px`;
        selectionBox.style.width = `${rect.width + padding * 2}px`;
        selectionBox.style.height = `${rect.height + padding * 2}px`;
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

    let scrollTimeout = null;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function onScroll() {
        // If we have a current element being highlighted, update its position immediately
        if (currentElement && !isDragSelection && selectionBox.style.display !== 'none') {
            // Check if mouse is now over a different element due to scrolling
            const elementAtMouse = getElementAtPoint(lastMouseX, lastMouseY);

            if (elementAtMouse && elementAtMouse !== currentElement) {
                // Element changed due to scroll - use transition for smooth switch
                currentElement = elementAtMouse;

                // Enable transition
                selectionBox.style.transition = 'all 0.15s ease-in-out';

                // Force reflow to ensure transition is registered before changing position
                void selectionBox.offsetHeight;

                // Now apply new position with transition
                const rect = elementAtMouse.getBoundingClientRect();
                const padding = 12;

                selectionBox.style.left = `${rect.left - padding}px`;
                selectionBox.style.top = `${rect.top - padding}px`;
                selectionBox.style.width = `${rect.width + padding * 2}px`;
                selectionBox.style.height = `${rect.height + padding * 2}px`;
            } else {
                // Same element, just repositioned - no transition for immediate feedback
                selectionBox.style.transition = 'none';

                const rect = currentElement.getBoundingClientRect();
                const padding = 12;

                selectionBox.style.left = `${rect.left - padding}px`;
                selectionBox.style.top = `${rect.top - padding}px`;
                selectionBox.style.width = `${rect.width + padding * 2}px`;
                selectionBox.style.height = `${rect.height + padding * 2}px`;

                // Re-enable transitions after a short delay (when scrolling stops)
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }
                scrollTimeout = setTimeout(() => {
                    selectionBox.style.transition = 'all 0.15s ease-in-out';
                }, 150);
            }
        }
    }

    function cleanup() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        try {
            overlay.remove();
            selectionBox.remove();
            instruction.remove();
        } catch (e) {
            // ignore
        }
        document.removeEventListener('keydown', onKeydown, true);
        document.removeEventListener('scroll', onScroll, true);
        window.screenshotSelectorActive = false;
    }

    async function finishSelectionAndCapture(x, y, width, height) {
        try {
            const calendarUrl = await captureSelection(x, y, width, height);

            const { userCancelled } = await chrome.storage.local.get(['userCancelled'])

            if (!userCancelled) {
                await sendMessage({
                    action: 'openUrl',
                    url:calendarUrl,
                })
            }
        } catch (error) {
            console.error('Capture error:', error);
            // Optional: show an in-page error if you want
        } finally {
            cleanup();
        }
    }

    async function finishElementTextCapture(element) {
        try {
            // Hide UI elements before extracting text
            overlay.style.display = 'none';
            selectionBox.style.display = 'none';
            instruction.style.display = 'none';

            // Extract text content from the element
            const textContent = element.innerText || element.textContent || '';

            if (!textContent.trim()) {
                throw new Error('No text content found in selected element.');
            }

            console.log('Sending element text to parseElementText...');
            const createRes = await sendMessage({
                action: 'parseElementText',
                textContent: textContent.trim(),
            });

            if (!createRes || !createRes.success || !createRes.url) {
                const msg =
                    createRes && createRes.error
                        ? createRes.error
                        : 'Failed to create calendar event from text.';
                throw new Error(msg);
            }

            const { userCancelled } = await chrome.storage.local.get(['userCancelled']);

            if (!userCancelled) {
                await sendMessage({
                    action: 'openUrl',
                    url: createRes.url,
                });
            }
        } catch (error) {
            console.error('Element text capture error:', error);
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

        lastMouseX = x;
        lastMouseY = y;

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

    // Update selection box on scroll
    document.addEventListener('scroll', onScroll, true);

    overlay.addEventListener('mouseup', (e) => {
        if (!isSelecting) return;

        e.preventDefault();
        e.stopPropagation();

        isSelecting = false;

        if (isDragSelection) {
            // Drag selection path (screenshot capture)
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

            // Determine if element should be processed as text or image
            if (isTextualElement(el)) {
                // Extract and send text content
                finishElementTextCapture(el);
            } else {
                // Capture as screenshot using element's bounding box
                finishSelectionAndCapture(
                    rect.left,
                    rect.top,
                    rect.width,
                    rect.height
                );
            }
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
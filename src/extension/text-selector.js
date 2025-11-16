(function() {
    if (window.textDownloadActive) return;
    window.textDownloadActive = true;

    console.log('Text selector activated');

    // Add custom selection styling to match the project design
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        ::selection {
            background-color: rgba(102, 126, 234, 1);
            color: white;
        }
        ::-moz-selection {
            background-color: rgba(102, 126, 234, 1);
            color: white;
        }
    `;
    document.head.appendChild(styleSheet);

    const overlay = document.createElement('div');
    overlay.id = 'text-selector-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.2);
        z-index: 2147483646;
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        pointer-events: none;
    `;
    instruction.textContent = 'Select text to create calendar event • ESC to cancel';

    document.body.appendChild(overlay);
    document.body.appendChild(instruction);

    console.log('Overlay and instruction added');

    // Camera shutter sound effect
    function playCameraSound() {
        // Check if sound is enabled
        chrome.storage.local.get(['soundEnabled'], ({ soundEnabled }) => {
            if (soundEnabled === false) {
                return; // Sound is muted
            }

            try {
                const audio = new Audio(chrome.runtime.getURL('src/extension/assets/camera-13695.mp3'));
                audio.volume = 0.5;
                audio.play().catch(err => console.warn('Failed to play camera sound:', err));
            } catch (error) {
                console.warn('Failed to play camera sound:', error);
            }
        });
    }

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

    function cleanup() {
        console.log('Cleaning up...');
        try {
            overlay.remove();
            instruction.remove();
            styleSheet.remove();
            window.getSelection().removeAllRanges();
        } catch (e) {
            console.log('Error removing elements:', e);
        }
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeydown);
        window.textDownloadActive = false;
    }

    async function downloadSelectedText() {
        const selectedText = window.getSelection().toString();
        console.log('Selected text:', selectedText);

        if (!selectedText.trim()) {
            console.log('No text selected');
            cleanup();
            return;
        }

        // Play camera shutter sound
        playCameraSound();

        try {
            console.log('Sending text to calendar API...');
            const response = await sendMessage({
                action: 'downloadText',
                textContent: selectedText.trim(),
            });

            console.log('Calendar event response:', response);

            if (!response || !response.success) {
                const msg = response && response.error
                    ? response.error
                    : 'Failed to create calendar event.';
                throw new Error(msg);
            }

            console.log('Calendar event created successfully');
        } catch (error) {
            console.error('Calendar event error:', error);
        } finally {
            cleanup();
        }
    }

    function onMouseUp(e) {
        console.log('Mouse up detected');
        const selectedText = window.getSelection().toString();

        if (selectedText.trim()) {
            console.log('Text selected, triggering download');
            downloadSelectedText();
        }
    }

    function onKeydown(e) {
        if (e.key === 'Escape') {
            console.log('Escape pressed, cancelling');
            cleanup();
        }
    }

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeydown);

    console.log('Event listeners attached');
})();
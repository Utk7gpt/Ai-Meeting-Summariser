// Google Meet Content Script for Caption Scraping
console.log("Synapse Scraper: Google Meet content script loaded.");

const SELECTORS = {
    region: '[aria-label="Captions"][role="region"], .aG25Uc',
    turn: '.nMcdL, [data-sender-name]',
    speaker: '.NWpY1d, .YS5uaf, [data-sender-name]',
    text: '.ygicle, .TDTru, .bh44bd'
};

let observer = null;
let checkInterval = null;
let turnMap = new Map(); // Local cache for speaker turn blocks

function safeSendMessage(msg) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage(msg);
        }
    } catch (e) {
        console.warn("Synapse Scraper: Context invalidated. Please refresh the meeting page.", e);
    }
}

function startObserving(containerElement) {
    if (observer) return;

    console.log("Synapse Scraper: Activating robust observation on captions region.");
    safeSendMessage({ action: "captionsStatus", active: true, platform: "Google Meet" });

    observer = new MutationObserver((mutations) => {
        handleCaptionMutations();
    });

    observer.observe(containerElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Initial check
    handleCaptionMutations();
}

function handleCaptionMutations() {
    const region = document.querySelector(SELECTORS.region);
    if (!region) return;

    // Retrieve active speaker blocks
    const turnBlocks = region.querySelectorAll(SELECTORS.turn);
    const blocks = turnBlocks.length ? Array.from(turnBlocks) : Array.from(region.children);

    if (!blocks.length) return;

    let bufferChanged = false;

    chrome.storage.local.get(['transcriptBuffer'], (result) => {
        let buffer = result.transcriptBuffer || [];

        blocks.forEach(turnEl => {
            let turnId = turnEl.dataset.synapseTurnId;
            
            // If this is a new turn block, initialize metadata
            if (!turnId) {
                turnId = 'turn_' + Math.random().toString(36).substring(2, 9);
                turnEl.dataset.synapseTurnId = turnId;

                // Extract speaker name
                let speakerEl = turnEl.querySelector(SELECTORS.speaker);
                if (!speakerEl) {
                    speakerEl = turnEl.querySelector('img')?.nextElementSibling || turnEl.firstElementChild;
                }
                
                let speaker = speakerEl?.textContent?.trim() || "You";
                if (speaker.toLowerCase() === 'you') {
                    speaker = "You";
                } else {
                    speaker = speaker.charAt(0).toUpperCase() + speaker.slice(1).toLowerCase();
                }

                turnMap.set(turnId, {
                    speaker: speaker,
                    timestamp: new Date().toTimeString().split(' ')[0],
                    textNodes: new Map() // Links DOM Node reference to its captured text content
                });
            }

            const turnEntry = turnMap.get(turnId);

            // Locate the container holding text blocks
            let textContainer = turnEl.querySelector(SELECTORS.text);
            if (!textContainer) {
                textContainer = turnEl.lastElementChild;
            }

            if (textContainer) {
                let textNodeCount = 0;
                
                // Read individual text nodes dynamically
                for (const child of textContainer.childNodes) {
                    // TEXT_NODE (3) or wrapped in child elements (e.g. spans)
                    if (child.nodeType === 3) {
                        const val = child.textContent.trim();
                        if (val) {
                            turnEntry.textNodes.set(child, val);
                            textNodeCount++;
                        }
                    } else if (child.nodeType === 1) {
                        const val = child.textContent.trim();
                        if (val) {
                            turnEntry.textNodes.set(child, val);
                            textNodeCount++;
                        }
                    }
                }

                // Fallback: If no nested nodes found, read textContent directly
                if (textNodeCount === 0 && textContainer.textContent.trim()) {
                    turnEntry.textNodes.set(textContainer, textContainer.textContent.trim());
                }
            }

            // Compile the combined caption string
            const textParts = Array.from(turnEntry.textNodes.values()).filter(t => t.length > 0);
            const combinedText = textParts.join(' ').replace(/\s+/g, ' ').trim();

            if (combinedText) {
                const existingIndex = buffer.findIndex(item => item.turnId === turnId);
                
                if (existingIndex !== -1) {
                    // Update current block in-place
                    if (buffer[existingIndex].text !== combinedText) {
                        buffer[existingIndex].text = combinedText;
                        buffer[existingIndex].timestamp = new Date().toTimeString().split(' ')[0];
                        bufferChanged = true;
                    }
                } else {
                    // Add new block to transcript buffer
                    buffer.push({
                        turnId: turnId,
                        speaker: turnEntry.speaker,
                        text: combinedText,
                        timestamp: turnEntry.timestamp
                    });
                    bufferChanged = true;
                }
            }
        });

        // Write modifications to storage
        if (bufferChanged) {
            chrome.storage.local.set({ transcriptBuffer: buffer });
        }
    });
}

function stopObserving() {
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("Synapse Scraper: Google Meet observation stopped.");
    }
    safeSendMessage({ action: "captionsStatus", active: false, platform: "Google Meet" });
}

function checkDomForCaptions() {
    const container = document.querySelector(SELECTORS.region);
    
    if (container) {
        startObserving(container);
    } else {
        if (observer) {
            stopObserving();
        }
    }
}

// Check every 2 seconds
checkInterval = setInterval(checkDomForCaptions, 2000);

window.addEventListener('unload', () => {
    clearInterval(checkInterval);
    if (observer) observer.disconnect();
});

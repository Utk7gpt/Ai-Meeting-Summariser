// Microsoft Teams Web Content Script for Caption Scraping
console.log("Synapse Scraper: Microsoft Teams Web Client content script loaded.");

const SELECTORS = {
    container: '.caption-window, [data-tid="captions-container"], .closed-captions-window, .ui-chat',
    speaker: '.closed-captions-speaker, .caption-speaker, [data-tid="caption-speaker-name"]',
    text: '.closed-captions-text, .caption-text, [data-tid="caption-text"]'
};

let observer = null;
let checkInterval = null;
let turnMap = new Map();

function startObserving(containerElement) {
    if (observer) return;

    console.log("Synapse Scraper: Activating robust observation on Teams captions container.");
    chrome.runtime.sendMessage({ action: "captionsStatus", active: true, platform: "Teams Web" });

    observer = new MutationObserver(() => {
        handleCaptionMutations();
    });

    observer.observe(containerElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    handleCaptionMutations();
}

function handleCaptionMutations() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    // Use direct child wrappers as distinct speaker blocks
    const blocks = Array.from(container.children);
    if (!blocks.length) return;

    let bufferChanged = false;

    chrome.storage.local.get(['transcriptBuffer'], (result) => {
        let buffer = result.transcriptBuffer || [];

        blocks.forEach(turnEl => {
            let turnId = turnEl.dataset.synapseTurnId;
            
            if (!turnId) {
                turnId = 'turn_' + Math.random().toString(36).substring(2, 9);
                turnEl.dataset.synapseTurnId = turnId;

                // Extract speaker name
                let speakerEl = turnEl.querySelector(SELECTORS.speaker);
                let speaker = speakerEl?.textContent?.replace(':', '')?.trim() || "Speaker";
                speaker = speaker.charAt(0).toUpperCase() + speaker.slice(1).toLowerCase();

                turnMap.set(turnId, {
                    speaker: speaker,
                    timestamp: new Date().toTimeString().split(' ')[0],
                    textNodes: new Map()
                });
            }

            const turnEntry = turnMap.get(turnId);

            // Locate text container
            let textContainer = turnEl.querySelector(SELECTORS.text) || turnEl;

            if (textContainer) {
                let textNodeCount = 0;
                
                for (const child of textContainer.childNodes) {
                    if (child.nodeType === 3) { // TEXT_NODE
                        const val = child.textContent.trim();
                        if (val && !val.endsWith(':')) {
                            turnEntry.textNodes.set(child, val);
                            textNodeCount++;
                        }
                    } else if (child.nodeType === 1 && !child.matches(SELECTORS.speaker)) {
                        const val = child.textContent.trim();
                        if (val) {
                            turnEntry.textNodes.set(child, val);
                            textNodeCount++;
                        }
                    }
                }

                if (textNodeCount === 0) {
                    const cleanText = textContainer.textContent.replace(turnEntry.speaker + ':', '').trim();
                    if (cleanText) {
                        turnEntry.textNodes.set(textContainer, cleanText);
                    }
                }
            }

            const textParts = Array.from(turnEntry.textNodes.values()).filter(t => t.length > 0);
            const combinedText = textParts.join(' ').replace(/\s+/g, ' ').trim();

            if (combinedText) {
                const existingIndex = buffer.findIndex(item => item.turnId === turnId);
                
                if (existingIndex !== -1) {
                    if (buffer[existingIndex].text !== combinedText) {
                        buffer[existingIndex].text = combinedText;
                        buffer[existingIndex].timestamp = new Date().toTimeString().split(' ')[0];
                        bufferChanged = true;
                    }
                } else {
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

        if (bufferChanged) {
            chrome.storage.local.set({ transcriptBuffer: buffer });
        }
    });
}

function stopObserving() {
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("Synapse Scraper: Teams observation stopped.");
    }
    chrome.runtime.sendMessage({ action: "captionsStatus", active: false, platform: "Teams Web" });
}

function checkDomForCaptions() {
    const container = document.querySelector(SELECTORS.container);
    
    if (container) {
        startObserving(container);
    } else {
        if (observer) {
            stopObserving();
        }
    }
}

checkInterval = setInterval(checkDomForCaptions, 2000);

window.addEventListener('unload', () => {
    clearInterval(checkInterval);
    if (observer) observer.disconnect();
});

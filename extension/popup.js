// Extension Popup Controller
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const statusPill = document.getElementById('status-pill');
    const statusText = document.getElementById('status-text');
    const platformName = document.getElementById('platform-name');
    const consentBanner = document.getElementById('consent-banner');
    const btnDismissConsent = document.getElementById('btn-dismiss-consent');
    const statLines = document.getElementById('stat-lines');
    const statWords = document.getElementById('stat-words');
    const captionWarning = document.getElementById('caption-warning');
    const btnSendTransit = document.getElementById('btn-send-transit');
    const btnEndSummarize = document.getElementById('btn-end-summarize');

    let pollInterval = null;

    // Load initial states
    initPopup();

    // Setup event listeners
    btnDismissConsent.addEventListener('click', dismissConsentBanner);
    btnSendTransit.addEventListener('click', sendTranscriptToBackend);
    btnEndSummarize.addEventListener('click', endAndSummarizeMeeting);

    // Initial configuration check
    function initPopup() {
        // 1. Consent banner visibility check
        chrome.storage.local.get(['consentDismissed'], (res) => {
            if (res.consentDismissed) {
                consentBanner.classList.add('hidden');
            }
        });

        // 2. Scan active tab properties
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs.length) return;
            const tab = tabs[0];
            const url = tab.url || '';

            let currentPlatform = null;
            let iconHtml = '<i class="fa-solid fa-video"></i>';

            if (url.includes('meet.google.com')) {
                currentPlatform = "Google Meet";
                iconHtml = '<i class="fa-brands fa-google"></i> Google Meet';
            } else if (url.includes('zoom.us')) {
                currentPlatform = "Zoom Web";
                iconHtml = '<i class="fa-solid fa-video"></i> Zoom Web';
            } else if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) {
                currentPlatform = "Teams Web";
                iconHtml = '<i class="fa-brands fa-windows"></i> Teams Web';
            }

            if (currentPlatform) {
                platformName.innerHTML = iconHtml;
                // If it is a meeting page, run updates
                updatePopupState();
                pollInterval = setInterval(updatePopupState, 1000);
            } else {
                // If not currently on a meeting tab, check if we have background recording tab active
                chrome.storage.local.get(['activePlatform', 'captionsActive'], (res) => {
                    if (res.activePlatform) {
                        platformName.innerHTML = `<i class="fa-solid fa-square-poll-vertical"></i> ${res.activePlatform} (Bg)`;
                        updatePopupState();
                        pollInterval = setInterval(updatePopupState, 1000);
                    } else {
                        platformName.innerHTML = '<i class="fa-solid fa-video-slash"></i> No Active Meeting';
                        statusPill.className = 'status-indicator-pill';
                        statusText.textContent = 'Idle';
                        captionWarning.classList.add('hidden');
                    }
                });
            }
        });
    }

    // Dismiss consent banner persistently
    function dismissConsentBanner() {
        chrome.storage.local.set({ consentDismissed: true });
        consentBanner.classList.add('hidden');
    }

    // Query and update captions statuses and word counts
    function updatePopupState() {
        chrome.storage.local.get(['transcriptBuffer', 'captionsActive'], (res) => {
            const buffer = res.transcriptBuffer || [];
            const active = res.captionsActive || false;

            // Update stats
            statLines.textContent = buffer.length;
            
            const wordsCount = buffer.reduce((acc, line) => {
                return acc + (line.text ? line.text.split(/\s+/).length : 0);
            }, 0);
            statWords.textContent = wordsCount;

            // Update status indicators and caption toggle warnings
            if (active) {
                statusPill.className = 'status-indicator-pill recording';
                statusText.textContent = 'Capturing';
                captionWarning.classList.add('hidden');
            } else {
                statusPill.className = 'status-indicator-pill';
                statusText.textContent = 'No Captions';
                captionWarning.classList.remove('hidden');
            }
        });
    }

    // POST transcript data to server endpoint
    async function sendTranscriptToBackend() {
        chrome.storage.local.get(['transcriptBuffer'], async (res) => {
            const buffer = res.transcriptBuffer || [];
            if (!buffer.length) {
                alert("Transcript buffer is empty. Start your captions to capture data.");
                return;
            }

            btnSendTransit.disabled = true;
            const origHtml = btnSendTransit.innerHTML;
            btnSendTransit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

            try {
                const response = await fetch('http://localhost:3000/api/transcript', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: buffer })
                });

                if (response.ok) {
                    alert("Transcript sent to Synapse server successfully!");
                } else {
                    throw new Error(`Server returned error: ${response.status}`);
                }
            } catch (err) {
                console.error(err);
                alert(`Failed to connect to Synapse server: ${err.message}. Make sure your dashboard server is running on localhost:3000.`);
            } finally {
                btnSendTransit.disabled = false;
                btnSendTransit.innerHTML = origHtml;
            }
        });
    }

    // Send and open dashboard, then clear active buffer
    async function endAndSummarizeMeeting() {
        chrome.storage.local.get(['transcriptBuffer'], async (res) => {
            const buffer = res.transcriptBuffer || [];
            if (!buffer.length) {
                alert("No transcript details captured yet.");
                return;
            }

            btnEndSummarize.disabled = true;
            btnEndSummarize.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Triggering Summary...';

            try {
                // Post payload to backend
                const response = await fetch('http://localhost:3000/api/transcript', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: buffer })
                });

                if (response.ok) {
                    // Open dashboard in a new tab
                    chrome.tabs.create({ url: 'http://localhost:3000' });
                    
                    // Reset buffer session
                    chrome.storage.local.set({ 
                        transcriptBuffer: [],
                        captionsActive: false,
                        activeMeetingTabId: null,
                        activePlatform: null
                    });
                    
                    // Close popup window
                    window.close();
                } else {
                    throw new Error(`Server returned error: ${response.status}`);
                }
            } catch (err) {
                console.error(err);
                alert(`Error ending session: ${err.message}. Ensure your dashboard is running.`);
                btnEndSummarize.disabled = false;
                btnEndSummarize.innerHTML = '<i class="fa-solid fa-circle-check"></i> End & Summarize';
            }
        });
    }

    // Clear poll interval on close
    window.addEventListener('unload', () => {
        if (pollInterval) clearInterval(pollInterval);
    });
});

// Synapse Background Service Worker
console.log("Synapse Scraper: Background script loaded.");

let activeMeetingTabs = new Set();

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captionsStatus') {
        const tabId = sender.tab?.id;
        if (!tabId) return;

        if (message.active) {
            activeMeetingTabs.add(tabId);
            // Set visual recording badge state
            chrome.action.setBadgeText({ tabId: tabId, text: 'REC' });
            chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#10b981' }); // Emerald Green
            
            // Save tab ID and platform details
            chrome.storage.local.set({ 
                activeMeetingTabId: tabId,
                activePlatform: message.platform,
                captionsActive: true
            });
        } else {
            activeMeetingTabs.delete(tabId);
            chrome.action.setBadgeText({ tabId: tabId, text: '' });
            chrome.storage.local.set({ captionsActive: false });
        }
    }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (activeMeetingTabs.has(tabId)) {
        activeMeetingTabs.delete(tabId);
        chrome.storage.local.get(['activeMeetingTabId'], (res) => {
            if (res.activeMeetingTabId === tabId) {
                chrome.storage.local.set({ 
                    captionsActive: false,
                    activeMeetingTabId: null,
                    activePlatform: null
                });
            }
        });
    }
});

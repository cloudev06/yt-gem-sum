// ===== Background Service Worker =====
// Manages a single Gemini tab — finds existing ones across all windows, or creates one.

let geminiTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openGemini") {
        openOrReuseGeminiTab(message.prompt);
        sendResponse({ ok: true });
    }
});

async function openOrReuseGeminiTab(prompt) {
    const geminiUrl = `https://gemini.google.com/app#yt-summarize=${encodeURIComponent(prompt)}`;

    // Step 1: Try our tracked tab first
    if (geminiTabId !== null) {
        try {
            const tab = await chrome.tabs.get(geminiTabId);
            if (tab && tab.url && tab.url.includes("gemini.google.com")) {
                await focusAndSend(tab, prompt, geminiUrl);
                return;
            }
        } catch (e) {
            geminiTabId = null;
        }
    }

    // Step 2: Search ALL windows for any existing Gemini tab
    try {
        const tabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
        if (tabs.length > 0) {
            // Use the most recently accessed one
            const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
            geminiTabId = tab.id;
            await focusAndSend(tab, prompt, geminiUrl);
            return;
        }
    } catch (e) {
        console.log("[Gemini Summarizer] Tab query failed:", e.message);
    }

    // Step 3: No Gemini tab found anywhere — create a new one
    const tab = await chrome.tabs.create({ url: geminiUrl, active: true });
    geminiTabId = tab.id;
}

async function focusAndSend(tab, prompt, geminiUrl) {
    // Focus the tab and its window
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });

    // Try sending message to the content script
    try {
        await chrome.tabs.sendMessage(tab.id, {
            action: "fillPrompt",
            prompt: prompt
        });
    } catch (e) {
        // Content script not loaded (e.g. user opened Gemini manually before installing)
        // Reload the tab with the hash
        await chrome.tabs.update(tab.id, { url: geminiUrl });
    }
}

// Clean up if the Gemini tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === geminiTabId) {
        geminiTabId = null;
    }
});

// ===== Gemini Content Script =====
// Handles prompts from both:
//  1. URL hash (first open)
//  2. Runtime messages (tab reuse)

(() => {
    "use strict";

    const HASH_PREFIX = "yt-summarize=";

    // ── Listen for messages from background.js (tab reuse) ──
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "fillPrompt" && message.prompt) {
            console.log("[Gemini Summarizer] Received prompt via message");
            fillAndSend(message.prompt);
            sendResponse({ ok: true });
        }
    });

    // ── Check URL hash on initial load ──
    function getPromptFromHash() {
        const hash = window.location.hash;
        if (!hash || !hash.includes(HASH_PREFIX)) return null;

        const encoded = hash.split(HASH_PREFIX)[1];
        if (!encoded) return null;

        try {
            return decodeURIComponent(encoded);
        } catch (e) {
            return null;
        }
    }

    /**
     * Wait for an element to appear in the DOM.
     */
    function waitForElement(selectors, timeout = 15000) {
        return new Promise((resolve, reject) => {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
            }

            const observer = new MutationObserver(() => {
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
                        resolve(el);
                        return;
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timed out waiting for input element"));
            }, timeout);
        });
    }

    /**
     * Fill the Gemini input and click send.
     */
    async function fillAndSend(prompt) {
        console.log("[Gemini Summarizer] Filling prompt...");

        const inputSelectors = [
            '.ql-editor',
            'div[contenteditable="true"]',
            'rich-textarea .ql-editor',
            'rich-textarea div[contenteditable="true"]',
            'textarea',
            '.ProseMirror',
            'div[role="textbox"]',
        ];

        try {
            const inputEl = await waitForElement(inputSelectors);
            console.log("[Gemini Summarizer] Found input:", inputEl.tagName, inputEl.className);

            if (inputEl.tagName === "TEXTAREA") {
                inputEl.value = prompt;
                inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
                // Contenteditable div
                inputEl.focus();
                inputEl.innerHTML = "";

                const p = document.createElement("p");
                p.textContent = prompt;
                inputEl.appendChild(p);

                inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                inputEl.dispatchEvent(new Event("change", { bubbles: true }));

                // Also try execCommand
                inputEl.focus();
                document.execCommand("selectAll", false, null);
                document.execCommand("insertText", false, prompt);
            }

            // Click send after a brief delay
            setTimeout(() => clickSend(), 800);

        } catch (err) {
            console.error("[Gemini Summarizer] Could not find input:", err.message);
        }

        // Clean up hash
        if (window.location.hash.includes(HASH_PREFIX)) {
            history.replaceState(null, "", window.location.pathname + window.location.search);
        }
    }

    /**
     * Find and click the send button.
     */
    function clickSend() {
        console.log("[Gemini Summarizer] Looking for send button...");

        const sendSelectors = [
            'button[aria-label="Send message"]',
            'button[aria-label="Send"]',
            'button[data-at="send"]',
            'button.send-button',
            'mat-icon-button[aria-label="Send message"]',
            '.action-wrapper button',
            'button[mat-icon-button]',
        ];

        for (const selector of sendSelectors) {
            const btn = document.querySelector(selector);
            if (btn && !btn.disabled) {
                console.log("[Gemini Summarizer] Clicking send:", selector);
                btn.click();
                return;
            }
        }

        // Fallback: find any button with a send-like label
        const allButtons = document.querySelectorAll("button");
        for (const btn of allButtons) {
            const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
            const matTooltip = (btn.getAttribute("mattooltip") || "").toLowerCase();
            if (
                (ariaLabel.includes("send") || ariaLabel.includes("submit") || matTooltip.includes("send")) &&
                !btn.disabled
            ) {
                console.log("[Gemini Summarizer] Clicking fallback send:", ariaLabel);
                btn.click();
                return;
            }
        }

        // Last resort: Enter key
        console.log("[Gemini Summarizer] No send button found, trying Enter");
        const input = document.querySelector('.ql-editor, div[contenteditable="true"], textarea, div[role="textbox"]');
        if (input) {
            input.dispatchEvent(new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
        }
    }

    // ── Init: check hash on first load ──
    const prompt = getPromptFromHash();
    if (prompt) {
        console.log("[Gemini Summarizer] Prompt from hash:", prompt);
        if (document.readyState === "complete") {
            setTimeout(() => fillAndSend(prompt), 2000);
        } else {
            window.addEventListener("load", () => {
                setTimeout(() => fillAndSend(prompt), 2000);
            });
        }
    }
})();

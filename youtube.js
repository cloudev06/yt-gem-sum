// ===== YouTube Content Script =====
// Adds a "Summarize" button next to the like button.
// Opens Gemini with the video URL encoded in the hash.

(() => {
    "use strict";

    const BUTTON_ID = "gemini-summarize-btn";

    const GEMINI_SVG = `
    <svg class="gemini-logo" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C14 7.732 7.732 14 0 14C7.732 14 14 20.268 14 28C14 20.268 20.268 14 28 14C20.268 14 14 7.732 14 0Z"
        fill="url(#gemini-grad-btn)" />
      <defs>
        <linearGradient id="gemini-grad-btn" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stop-color="#4285F4" />
          <stop offset="0.5" stop-color="#9B72CB" />
          <stop offset="1" stop-color="#D96570" />
        </linearGradient>
      </defs>
    </svg>
  `;

    function createButton() {
        const btn = document.createElement("button");
        btn.id = BUTTON_ID;
        btn.setAttribute("data-tooltip", "Summarize with Gemini");
        btn.setAttribute("aria-label", "Summarize this video with Google Gemini");
        btn.innerHTML = `${GEMINI_SVG}<span class="gemini-label">Summarize</span>`;
        btn.addEventListener("click", handleClick);
        return btn;
    }

    function handleClick(e) {
        e.stopPropagation();
        e.preventDefault();

        const videoUrl = getCurrentVideoUrl();
        if (!videoUrl) return;

        const prompt = `Summarize this YouTube video: ${videoUrl}`;

        // Send to background script — it will open or reuse the Gemini tab
        chrome.runtime.sendMessage({ action: "openGemini", prompt: prompt });
    }

    function getCurrentVideoUrl() {
        const url = new URL(window.location.href);
        const videoId = url.searchParams.get("v");
        if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
        return null;
    }

    function injectButton() {
        if (document.getElementById(BUTTON_ID)) return;

        const actionsContainer = document.querySelector("#top-level-buttons-computed");
        if (!actionsContainer) return;

        const btn = createButton();

        const likeSegment = actionsContainer.querySelector(
            "segmented-like-dislike-button-view-model"
        ) || actionsContainer.querySelector("ytd-segmented-like-dislike-button-renderer");

        if (likeSegment) {
            actionsContainer.insertBefore(btn, likeSegment);
        } else {
            actionsContainer.prepend(btn);
        }

        console.log("[Gemini Summarizer] Button injected ✓");
    }

    function observeNavigation() {
        const observer = new MutationObserver(() => {
            if (window.location.pathname === "/watch") {
                injectButton();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        if (window.location.pathname === "/watch") {
            setTimeout(injectButton, 1500);
        }

        document.addEventListener("yt-navigate-finish", () => {
            const existing = document.getElementById(BUTTON_ID);
            if (existing) existing.remove();

            if (window.location.pathname === "/watch") {
                setTimeout(injectButton, 1000);
            }
        });
    }

    observeNavigation();
})();

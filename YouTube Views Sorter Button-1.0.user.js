// ==UserScript==
// @name          YouTube Views Sorter Button
// @version       1.0
// @description   Adds a button to a YouTube channels videos page, shorts page and playlists which sorts items by views.
// @author        madsession
// @match         *://*.youtube.com/@*
// @match         *://*.youtube.com/*/featured
// @match         *://*.youtube.com/*/videos
// @match         *://*.youtube.com/*/shorts
// @match         *://*.youtube.com/*/playlists
// @match         *://*.youtube.com/playlist*
// @exclude-match *://*.youtube.com/watch
// @exclude-match *://*.youtube.com/feed/history
// @icon          https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    function addButton() {
        const path = window.location.pathname.toLowerCase();

        // Exclude unsupported tab pages like podcasts or releases, but keep streams enabled
        if (path.includes("/podcasts") || path.includes("/releases")) {
            const existingBtn = document.getElementById("sortViewButton");
            if (existingBtn) existingBtn.remove();
            return;
        }

        const isPlaylistPage = path.startsWith("/playlist");
        let container = null;
        let targetElement = null;

        if (isPlaylistPage) {
            targetElement = document.querySelector("yt-item-section-renderer, ytd-playlist-video-list-renderer");
            if (targetElement) {
                container = targetElement.parentNode;
            }
        }

        // 1. Try finding an existing standard chip bar container first
        if (!container) {
            container = document.querySelector("chip-bar-view-model.ytChipBarViewModelHost") ||
                        document.querySelector("chip-bar-view-model");
        }

        // 2. If it doesn't exist, create a native-looking container pinned to the left
        if (!container) {
            const richGrid = document.querySelector("ytd-rich-grid-renderer");
            if (richGrid) {
                let syntheticBar = richGrid.querySelector("#syntheticSortContainer");
                if (!syntheticBar) {
                    syntheticBar = document.createElement("div");
                    syntheticBar.id = "syntheticSortContainer";
                    syntheticBar.className = "style-scope ytd-rich-grid-renderer";

                    Object.assign(syntheticBar.style, {
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                        width: "100%",
                        boxSizing: "border-box",
                        paddingLeft: "24px",
                        margin: "16px 0 0 0"
                    });

                    const contents = richGrid.querySelector("#contents");
                    if (contents) {
                        richGrid.insertBefore(syntheticBar, contents);
                    } else {
                        richGrid.appendChild(syntheticBar);
                    }
                }
                container = syntheticBar;
            }
        }

        if (!container) return;

        let chip = document.getElementById("sortViewButton");

        if (!chip) {
            chip = document.createElement("button");
            chip.id = "sortViewButton";
            chip.className = "ytChipShapeButtonReset";
            chip.setAttribute("role", "tab");
            chip.setAttribute("aria-selected", "false");

            chip.innerHTML = `
                <div class="ytChipShapeChip ytChipShapeInactive ytChipShapeOnlyTextPadding">
                    <div>Sort by Views</div>
                    <yt-touch-feedback-shape aria-hidden="true" class="ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse">
                        <div class="ytSpecTouchFeedbackShapeStroke" style="border-radius: 8px;"></div>
                        <div class="ytSpecTouchFeedbackShapeFill" style="border-radius: 8px;"></div>
                    </yt-touch-feedback-shape>
                </div>
            `;

            Object.assign(chip.style, {
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0",
                fontFamily: "inherit"
            });

            chip.addEventListener("click", sortByViews);
        }

        if (isPlaylistPage && targetElement && container.contains(targetElement)) {
            if (chip.parentNode !== container || chip.nextElementSibling !== targetElement) {
                container.insertBefore(chip, targetElement);
            }
            chip.style.margin = "12px 48px";
        } else {
            if (chip.parentNode !== container) {
                container.appendChild(chip);
            }
            if (container.id !== "syntheticSortContainer" && getComputedStyle(container).display !== "flex") {
                container.style.display = "flex";
                container.style.alignItems = "center";
                container.style.flexWrap = "wrap";
                container.style.gap = "8px";
            }
            chip.style.order = "";
            chip.style.marginLeft = "";
            chip.style.margin = "";
        }
    }

    function parseViewNumber(text) {
        if (!text) return 0;
        text = text.replace(/\u00A0/g, " ").trim().toUpperCase();

        let multiplier = 1;
        // Kontrollera miljarder först eftersom "MD" eller "B" annars riskerar att krocka
        if (text.includes("MD") || text.includes("B") || text.includes("MILJARD")) {
            multiplier = 1000000000;
        } else if (text.includes("M") || text.includes("MN")) {
            multiplier = 1000000;
        } else if (text.includes("K") || text.includes("T")) {
            multiplier = 1000;
        }

        let cleanText = text.replace(/[A-ZÀ-ÖØ-ß]/g, "");
        cleanText = cleanText.replace(/(\d)\s+(\d)/g, "$1$2");

        const match = cleanText.match(/([\d,\.]+)/);
        if (!match) return 0;

        let numStr = match[1];
        if (numStr.includes(',') && !numStr.includes('.')) {
            numStr = numStr.replace(',', '.');
        } else {
            numStr = numStr.replace(/,/g, '');
        }

        const val = parseFloat(numStr);
        return isNaN(val) ? 0 : val * multiplier;
    }

    function getViews(e) {
        try {
            const infoElements = e.querySelectorAll(
                "#video-info, ytd-video-meta-block span, .ytContentMetadataViewModelMetadataText, .shortsLockupViewModelHostOutsideMetadataSubhead"
            );

            for (const el of infoElements) {
                const text = el.textContent ? el.textContent.replace(/\u00A0/g, " ").trim() : "";
                if (!text) continue;

                const lowerText = text.toLowerCase();

                if (
                    /(timmar|timme|dagar|dag|veckor|vecka|månader|månad|år|years|year|months|month|weeks|week|days|day|vor|och|and|för|\b\d{1,2}:\d{2}\b)/i.test(lowerText) ||
                    lowerText === "impaulsive" ||
                    lowerText.includes(" och ")
                ) {
                    continue;
                }

                if (
                    lowerText.includes("view") ||
                    lowerText.includes("visning") ||
                    lowerText.includes("aufruf") ||
                    lowerText.includes("visualiz") ||
                    lowerText.includes("md") ||
                    lowerText.includes("mn") ||
                    lowerText.includes("k") ||
                    /^\d+([\s\.,]\d+)*\s*[a-zäöå]*$/i.test(text)
                ) {
                    const parsed = parseViewNumber(text);
                    if (parsed > 0) {
                        return parsed;
                    }
                }
            }

            const titleLink = e.querySelector('a#video-title-link, #video-title, a.yt-simple-endpoint.ytd-playlist-video-renderer');
            if (titleLink) {
                const ariaLabel = titleLink.getAttribute("aria-label");
                if (ariaLabel) {
                    const match = ariaLabel.match(/([\d,.\s]+)\s*(views|visningar|visualizaciones|aufrufe)/i);
                    if (match) {
                        return parseViewNumber(match[1]);
                    }
                }
            }
        } catch (err) {
            console.error("Error parsing views for item:", err);
        }
        return 0;
    }

    function sortByViews() {
        console.log("Sorting...");

        const isPlaylistPage = window.location.pathname.startsWith("/playlist");
        let items, parents;

        if (isPlaylistPage) {
            items = document.querySelectorAll("ytd-playlist-video-renderer");
            if (items.length === 0) {
                items = document.querySelectorAll("#contents > div");
            }
            if (items.length === 0) {
                items = document.querySelectorAll("yt-lockup-view-model");
            }
            parents = [...items].map(e => e.parentNode);
        } else {
            items = document.querySelectorAll("ytd-rich-item-renderer");
            parents = [...items].map(e => e.parentNode);
        }

        console.log(`Found ${items.length} items on the page.`);
        if (items.length === 0) return;

        const sorted = [...items].sort(function(a, b) {
            return getViews(b) - getViews(a);
        });

        const infiniteScrollItem = document.getElementsByTagName("ytd-continuation-item-renderer")[0];
        if (infiniteScrollItem && infiniteScrollItem.parentNode) {
          infiniteScrollItem.parentNode.removeChild(infiniteScrollItem);
        }

        for (let item of sorted) {
          const parent = parents.shift();
          if (item.parentNode) {
              item.parentNode.removeChild(item);
          }
          if (parent) {
              parent.append(item);
          }
        }

        if (infiniteScrollItem && sorted.length > 0) {
          sorted[sorted.length - 1].parentNode.append(infiniteScrollItem);
        }
        console.log("Sorting complete.");
    }

    const observer = new MutationObserver(() => {
        addButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    addButton();
})();
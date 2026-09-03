export const VIEW_TYPE = "html-gallery-view";
export const PLUGIN_NAME = "HTML Gallery";

/** Virtual viewport width (px) of thumbnail iframes. Fixed, because sizing to the card would switch responsive HTML into its mobile layout */
export const THUMB_VIEWPORT_WIDTH = 1280;
/** Virtual viewport height (px) */
export const THUMB_VIEWPORT_HEIGHT = Math.round(THUMB_VIEWPORT_WIDTH * 0.72);

/** sandbox value for thumbnails with scripts disabled */
export const SANDBOX_NO_SCRIPTS = "allow-same-origin";
/** sandbox value for thumbnails with scripts enabled and for the enlarged view. Never combined with allow-same-origin */
export const SANDBOX_SCRIPTS = "allow-scripts";

/** How long a replaced card whose iframe is still loading is kept (hidden) before it is removed anyway */
export const RETIRED_CARD_TIMEOUT_MS = 15000;

/** Preload margin for the IntersectionObserver */
export const LAZY_ROOT_MARGIN = "300px 0px";

/** Number of same-folder candidates to guess */
export const SIBLING_NOTE_LIMIT = 2;

/** Body text (after removing script/style) shorter than this is treated as blank and gets the fallback thumbnail */
export const EMPTY_TEXT_THRESHOLD = 20;
/** Maximum number of body characters included in the search index */
export const SEARCH_TEXT_LIMIT = 8000;

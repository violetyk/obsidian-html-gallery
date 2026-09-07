/** Persisted in the user's workspace.json, so it keeps the original id */
export const VIEW_TYPE = "html-gallery-view";

/** Virtual viewport width (px) of thumbnail iframes. Fixed, because sizing to the card would switch responsive HTML into its mobile layout */
export const THUMB_VIEWPORT_WIDTH = 1280;
/** Virtual viewport height (px). Matches the shot box ratio in styles.css exactly */
export const THUMB_VIEWPORT_HEIGHT = 920;

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

/** Widest a PDF thumbnail is rendered (px). devicePixelRatio is ignored on purpose: a card at
 * DPR 2 would hold several MB of canvas backing store per PDF */
export const PDF_THUMB_MAX_WIDTH = 640;
/** Upper bound on thumbnail canvas area (px), so a poster-sized page cannot blow up memory */
export const PDF_THUMB_MAX_PIXELS = 1_200_000;
/** PDFs larger than this are listed but neither rendered nor indexed */
export const PDF_MAX_BYTES = 30 * 1024 * 1024;
/** How many PDFs may be open in pdf.js at once, shared by indexing and thumbnail rendering */
export const PDF_CONCURRENCY = 2;
/** How many pages of a PDF are read for the search index */
export const PDF_INDEX_PAGE_LIMIT = 3;

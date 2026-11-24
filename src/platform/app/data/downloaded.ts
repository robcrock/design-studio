// A downloaded prototype (src/platform/modules/prototypes/node/download.js) is one page opened from disk. It carries
// its manifest, so nothing is fetched, and it is also the page that runs its view previews.
export const embeddedManifest = typeof document === 'undefined' ? null : document.getElementById('studio-manifest');
export const downloaded = embeddedManifest !== null;

// The page that runs previews: the site's index.html, or the downloaded file itself.
export const appPage = () => (downloaded ? location.pathname : `${import.meta.env.BASE_URL}index.html`);

// Messages between the app and its preview frames. A page opened from disk has an opaque origin, which messages
// report as "null" and postMessage can't name, so it posts to any window; receivers still check the sender.
const fromDisk = () => location.protocol === 'file:';
export const postTarget = () => (fromDisk() ? '*' : location.origin);
export const messageOrigin = () => (fromDisk() ? 'null' : location.origin);

// src/router.ts
// Minimal hash-free client-side router using a simple state machine.
// Thu Sep  3 23:19:57 CEST 2026
let handler = null;
/** Register the single route handler (called once from main.ts). */
export function registerRouteHandler(h) {
    handler = h;
}
/** Navigate to a named route, passing optional params. */
export function navigate(name, params) {
    if (!handler)
        return;
    if (name === 'detail' && params?.['playlistId']) {
        handler({ name: 'detail', playlistId: params['playlistId'] });
    }
    else if (name === 'compare') {
        handler({ name: 'compare' });
    }
    else if (name === 'logout') {
        handler({ name: 'logout' });
    }
    else {
        handler({ name: 'list' });
    }
}

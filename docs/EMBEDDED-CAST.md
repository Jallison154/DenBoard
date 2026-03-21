# DenBoard: iframe, Home Assistant & Chromecast compatibility

This document audits embedded usage (Home Assistant `panel_custom` / iframe, casting to Nest/Chromecast) and how to run **display-safe** settings.

## Common console errors (and what actually causes them)

### `Abort fetching component for route: "/upload"`

**There is no `/upload` route, import, or `router.push` to `/upload` in the DenBoard repository** (verified via full-text search). This message is emitted by the **Next.js App Router client runtime** when a **flight/RSC prefetch or navigation** for a route is aborted (navigation away, iframe teardown, or a **different origin’s** router).

**What to check:**

1. **Confirm the console is scoped to your DenBoard origin** — filter DevTools by domain. Home Assistant’s own frontend (or a Lovelace card) may log Next-style messages if HA uses a similar stack, or a **browser extension** may inject routes.
2. **Iframe teardown** — if the parent removes the iframe while Next is still prefetching a chunk, you can see **aborted** fetches. Not specific to `/upload` unless something external requested that path.
3. **Service worker / proxy** — unlikely to invent `/upload`; still worth checking the **Network** tab for who requested `/upload`.

### `Uncaught (in promise) Error: Orphaned iframed`

Often seen when code interacts with **`window.top` / parent browsing context** while the iframe is **detached** or **cross-origin** rules change. DenBoard **does not** use `window.top` in application code anymore; **`DisplayChrome`** enables kiosk mode via **`?embed=1`**, **`?display=1`**, or the **`/display/*`** path only (no `self !== top` checks).

If this error persists, capture the **stack trace** — it may point at **Home Assistant**, **Cast receiver**, or **Chromium** internals rather than DenBoard.

### `AbortError: Transition was skipped`

Usually **Framer Motion** or **View Transitions** when a transition is interrupted (fast navigation, iframe removed, or reduced-motion). DenBoard uses **`MotionConfig`** with **`reducedMotion="always"`** in **kiosk** mode and **static background images** (no `AnimatePresence` for the background photo) when **`useDisplayMode().kiosk`** is true to reduce interrupted animations.

---

## Display-safe / kiosk mode (implemented)

| Mechanism | Behavior |
|-----------|----------|
| **`?embed=1`** or **`?display=1`** | Kiosk: no floating nav, no footer, reduced motion, static background image (no enter/exit animation), `data-denboard-embed` on `<html>`. |
| **`/display/nest`** | Same UI as **`/nest/home`**, but path-based kiosk without relying on query params (good for HA iframe `src`). |
| **`FloatingNav` links** | **`prefetch={false}`** to avoid speculative route loads in embedded contexts. |

Files: `components/DisplayChrome.tsx`, `contexts/DisplayModeContext.tsx`, kiosk branches in `components/FooterBar.tsx`, `components/FloatingNav.tsx`, `components/BackgroundLayer.tsx`.

### Recommended URLs for cast / HA iframe

```text
https://YOUR-DENBOARD/display/nest
```

or

```text
https://YOUR-DENBOARD/nest/home?embed=1
```

---

## Audit summary (codebase review)

### X-Frame-Options / CSP `frame-ancestors`

- **Next.js app**: No `middleware.ts` and no default `X-Frame-Options` or `frame-ancestors` in `next.config.mjs` in the stock repo.
- **Risk**: A **reverse proxy** (nginx, Caddy, Traefik, Cloudflare) in front of DenBoard may inject `X-Frame-Options: DENY` or `SAMEORIGIN`, which **blocks** embedding in Home Assistant. **Check your proxy** and remove or relax framing headers for the DenBoard origin.
- **Optional**: Set `DENBOARD_FRAME_ANCESTORS` in env to emit `Content-Security-Policy: frame-ancestors …` (see `next.config.mjs`).

### HTTPS / HTTP / redirects

- **`app/page.tsx`**: Server redirect to `/tv/home` (same-origin, no protocol flip).
- **Mixed content**: If Home Assistant is **HTTPS** and DenBoard is **HTTP**, the browser may block or warn. Serve DenBoard over **HTTPS**.

### Absolute URL assumptions

- **`NEXT_PUBLIC_BASE_PATH`**: Wrong base path breaks JS/CSS loading → **white or blank page**.
- **API routes**: Client uses **relative** `/api/...` fetches (same origin as the iframe `src`).

### WebSockets / SSE

- **`ws`** is **server-only** in `lib/weather.ts`. The **browser** does not open a WebSocket for DenBoard UI.

### Fullscreen / layout / iframe

- **`h-dvh` / `100dvh`**: If the **iframe has no height**, content can collapse → **blank**. **Set an explicit height** on the HA card/panel.

### Cookies / auth

- Admin uses `credentials: "include"`. Read-only dashboards do not require auth for viewing.

### Cast “white screen” checklist

1. **Iframe height 0** — fix HA layout.
2. **Mixed content** — HTTPS DenBoard.
3. **Wrong `basePath`** — assets 404.
4. **Proxy `X-Frame-Options: DENY`** — allow framing.
5. **JS error** — check stack (hydration, chunk 404).

---

## Optional env: `DENBOARD_FRAME_ANCESTORS`

```bash
DENBOARD_FRAME_ANCESTORS="'self' https://homeassistant.local:8123 https://ha.example.com"
```

Rebuild/restart after changing.

---

## Home Assistant iframe example

```yaml
type: iframe
url: "https://denboard.example.com/display/nest"
aspect_ratio: "16:9"
```

If the iframe has no intrinsic height, the inner page may appear blank.

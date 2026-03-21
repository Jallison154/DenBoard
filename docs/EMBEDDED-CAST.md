# DenBoard: iframe, Home Assistant & Chromecast compatibility

This document audits embedded usage (Home Assistant `panel_custom` / iframe, casting to Nest/Chromecast) and how to run **embed-safe** settings.

## Audit summary (codebase review)

### X-Frame-Options / CSP `frame-ancestors`

- **Next.js app**: No `middleware.ts` and no default `X-Frame-Options` or `frame-ancestors` in `next.config.mjs` in the stock repo.
- **Risk**: A **reverse proxy** (nginx, Caddy, Traefik, Cloudflare) in front of DenBoard may inject `X-Frame-Options: DENY` or `SAMEORIGIN`, which **blocks** embedding in Home Assistant. **Check your proxy** and remove or relax framing headers for the DenBoard origin.
- **Optional**: Set `DENBOARD_FRAME_ANCESTORS` (see below) to emit an explicit `Content-Security-Policy: frame-ancestors …` so only HA (and your app) may embed DenBoard.

### HTTPS / HTTP / redirects

- **`app/page.tsx`**: Server redirect to `/tv/home` (same-origin, no protocol flip).
- **Server-side HA/weather**: `lib/homeAssistant.ts` / `lib/weather.ts` may normalize `http://` for HA base URL when the env string has no scheme. That affects **server → Home Assistant** calls only, not the browser.
- **Mixed content**: If Home Assistant is **HTTPS** and DenBoard is **HTTP**, the browser may block or warn. Serve DenBoard over **HTTPS** on the same trust level as HA.

### Absolute URL assumptions

- **`NEXT_PUBLIC_BASE_PATH`**: Documented in `next.config.mjs` for subpath hosting. Wrong base path breaks JS/CSS loading → **white or blank page**. Must match how you access the app.
- **API routes**: Client code uses **relative** `/api/...` fetches (same origin as the page). Good for iframe as long as the iframe `src` is the real DenBoard origin.

### WebSockets / SSE

- **`ws` (Node `WebSocket`)** is used **only on the server** in `lib/weather.ts` for Home Assistant forecast fallback. The **browser** does not open a WebSocket for weather.
- **No SSE / EventSource** found in client code.

### JS that may behave differently on cast receivers

- **Framer Motion** is used across dashboards. Cast browsers are Chromium-based but can lag; use **`?embed=1`** or automatic iframe detection so **`MotionConfig` uses `reducedMotion: "always"`** (see `EmbedChrome` component).
- **`matchMedia('(hover: hover)')`** in `FloatingNav` hides the nav on touch/cast — not a white screen.
- **`dangerouslySetInnerHTML`** for theme CSS vars in root layout — if a **parent page** sets a very strict **CSP** without `'unsafe-inline'`, script/style could be blocked. HA’s iframe usually loads your origin directly; if you wrap DenBoard in another CSP-heavy page, test with DevTools console.

### Fullscreen / layout / iframe

- **`h-dvh` / `100dvh`**: Used on `html`/`body`. In an iframe, **dynamic viewport** can differ from the outer window; usually still works. If the **iframe has no height**, the inner document can collapse → **blank white area**. **Set an explicit height** on the HA iframe/panel (e.g. `aspect_ratio` or layout card with min height).
- **`position: fixed` footer**: Still relative to the iframe viewport; OK for kiosk-style panels.

### Cookies / auth

- Admin `fetch(..., { credentials: "include" })` for settings. Embedded `/nest/home` does not rely on cookies for read-only dashboards.
- **Third-party cookie** phaseout: not an issue for **same-origin** iframe `src` pointing at DenBoard.

### Cast “white screen” checklist

1. **Iframe height 0** — fix HA panel layout / card height.
2. **Mixed content** — use HTTPS for DenBoard.
3. **Wrong `basePath`** — assets 404; check Network tab.
4. **Proxy `X-Frame-Options: DENY`** — allow framing or use HA’s origin in CSP.
5. **JS error** — open remote debugging or on-device DevTools; look for hydration or chunk load errors.
6. **Very old WebView** — rare on Chromecast; React 19 + Next 16 require a reasonably current Chromium.

---

## Embed / “compatibility” mode

### Automatic behavior

- **`EmbedChrome`** (client): If `?embed=1` / `?embed=true` **or** the page runs **inside an iframe** (`window.self !== window.top`), it:
  - Sets `document.documentElement.dataset.denboardEmbed = ""` for CSS hooks.
  - Wraps the app in **`MotionConfig`** with **`reducedMotion="always"`** so Framer Motion reduces animations.

### Optional env: `DENBOARD_FRAME_ANCESTORS`

Space-separated CSP `frame-ancestors` sources, e.g.:

```bash
DENBOARD_FRAME_ANCESTORS="'self' https://homeassistant.local:8123 https://ha.example.com"
```

Rebuild/restart after changing. If unset, no extra CSP header is added (embedding is not restricted by DenBoard itself).

### Recommended for wall / cast displays

- **URL**: Use a dedicated route (e.g. `/nest/home`) with `?embed=1` for stricter reduced motion.
- **No auth popups**: Avoid opening `/admin` on the cast target; use read-only views.
- **Animations**: Rely on embed mode + reduced motion; avoid adding new heavy canvas/WebGL.
- **Stable layout**: Prefer routes with fixed structure (`overflow-hidden` shell) for small iframes.

### “Minimal JS” (future)

The app is a Next.js SPA; true “minimal JS” would require a separate static or server-rendered minimal view. For now, **embed mode + reduced motion + avoiding heavy panels** is the practical compromise.

---

## Home Assistant iframe example

Use a **panel** or **iframe** with explicit height:

```yaml
# Illustrative — adjust to your HA integration
type: iframe
url: "https://denboard.example.com/nest/home?embed=1"
aspect_ratio: "16:9"
```

If the iframe has no intrinsic height, the inner page may appear blank.

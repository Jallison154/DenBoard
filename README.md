# DenBoard V2

A live family dashboard for wall-mounted TVs. Big clock, today's events, a rolling
month calendar, current + weekly weather, rain radar, Home Assistant status, and a
rotating dad joke / fun fact / on-this-day item. Everything is readable from 6–10 ft.

## What's new vs V1

- **Live, not polled.** The server holds one WebSocket to Home Assistant and pushes every
  change to all screens over Server-Sent Events. Doors, people, and media update instantly.
- **Responds to what's happening.** The Today list counts down to the next event and
  highlights the one happening now with a progress bar. Unlocked doors or an open garage
  rise to an alert bar after a delay you set. Now Playing appears when media is playing.
  Radar only shows when rain or snow is near. Severe NWS alerts pulse red.
- **Correct recurring events.** It uses ical.js, so BYDAY, EXDATE, moved or cancelled
  instances, and DST all work. V1's parser only handled simple FREQ rules.
- **Background follows sun and weather.** The sky changes with sunrise, sunset, clouds,
  rain and snow, with a star field at night. No Unsplash key needed.
- **Always-on care.** Night dimming, a slow pixel-shift against burn-in, auto-reconnect,
  and a nightly self-reload.
- **Fixed canvas.** Layouts are designed on 1080×1920 / 1920×1080 / 1024×600 and scaled
  to fit, so a 4K TV looks exactly like the preview.

## Screens

| URL | Canvas | For |
| --- | --- | --- |
| `/` | 1080×1920 portrait | Den's vertical 4K Samsung |
| `/landscape` | 1920×1080 | Other TVs |
| `/nest` | 1024×600 | Nest Hub / small displays |

Add `?guest=1` to any screen to force guest mode, or toggle the HA entity
`input_boolean.denboard_guest_mode`. Guest mode hides people, lock alerts, and every
calendar not marked `"guestVisible": true`. V1 URLs (`/portrait/home`, `/tv/home`,
`/nest/home`) redirect to the new ones.

## Setup

```bash
cp .env.example .env        # set HOME_ASSISTANT_URL + HOME_ASSISTANT_TOKEN
docker compose up -d --build
```

On first run DenBoard writes `data/denboard.json`. If a V1 `data/settings.json` is in the
same volume, it imports your calendars, location, and HA entities from it. Edit the file
any time (see `config/denboard.example.json`): every screen reloads itself within ~10s.

- **calendars**: any ICS URL (Google "Secret address in iCal format", iCloud, Outlook).
- **homeAssistant.people**: `person.*` or `device_tracker.*`.
- **homeAssistant.tiles**: `kind` is `lock | door | garage | window | climate | sensor | light | switch`.
  `alertAfterMinutes` sets how long a lock/door/garage can stay open before it reaches the alert bar.
- **mediaPlayers**: `"auto"` shows any playing `media_player.*`; hide some with `hideMediaPlayers`.

Health check: `GET /api/health`.

## Develop

```bash
npm install
npm run demo     # sample calendar + house data, live weather/radar
npm run dev      # real config
```

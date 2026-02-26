### DenBoard

DenBoard is a clean, modern, always-on family dashboard designed for wall-mounted 10‑foot displays. It runs as a Next.js app with a calm, mountain-inspired aesthetic and is intended to sit behind a reverse proxy (Caddy, Nginx, etc.).

---

### Tech stack

- **Framework**: Next.js (App Router, Node 20+)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion (subtle only)
- **Time/Calendar**: Luxon, node-ical

---

### Prerequisites

- **Node.js**: 20.9 or newer (required by Next 16)
- **npm**: 10+
- A reverse proxy (Caddy, Nginx, etc.) terminating TLS in front of the app

On Debian 12:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

### Getting started

#### 1. Clone the repo

```bash
git clone <your-denboard-repo-url>.git
cd DenBoard
```

#### 2. Environment configuration

Copy the example env file and fill in values:

```bash
cp .env.example .env.local
```

Environment variables:

- **UNSPLASH_ACCESS_KEY**: Unsplash API access key for rotating mountain backgrounds.
- **DASHBOARD_LAT / DASHBOARD_LON**: Latitude/longitude for your location.
- **DASHBOARD_TZ**: Time zone (e.g. `America/Denver`).
- **GCAL_ICS_URL**: Private Google Calendar ICS URL for family calendar.
- **HOME_ASSISTANT_URL**: Base URL of your Home Assistant instance (e.g. `https://ha.example.com`).
- **HOME_ASSISTANT_TOKEN**: Long‑lived access token for the curated entity list.
- **PORT**: Port for Next.js to listen on (default `3000`). The reverse proxy should point here.

#### 3. Install dependencies

For production‑like reproducibility:

```bash
npm ci
```

#### 4. Build and run

```bash
npm run build
PORT=3000 npm run start
```

The app will listen on `0.0.0.0:PORT`. Place it behind your reverse proxy for TLS and public access.

---

### Automated install on Debian 12 CT (Proxmox LXC)

For a Proxmox Debian 12 container, there is an installer that handles:

- Installing Node.js 20, git, and build tools
- Cloning the repo into `/opt/denboard`
- Creating a dedicated `denboard` user
- Creating `/opt/denboard/.env` from `.env.example` (if it does not exist)
- Running `npm ci && npm run build`
- Creating and enabling a `denboard.service` systemd unit
- Optionally installing and configuring a Caddy reverse proxy

From inside the CT:

```bash
cd /opt
git clone <your-denboard-repo-url>.git denboard
cd denboard

sudo bash scripts/install-denboard.sh https://github.com/USER/denboard.git \
  --branch main \
  --host denboard.local \
  --with-caddy
```

Arguments:

- **git_repo_url**: GitHub URL of your DenBoard repo (required).
- **--branch**: Git branch to deploy (default: `main`).
- **--host**: Hostname to use when configuring Caddy (default: `denboard.local`).
- **--with-caddy**: Install and configure Caddy reverse proxy.

The installer is **idempotent** and safe to run multiple times. It does not modify your `.env` once created.

After installation, the app runs as the `denboard` user with:

- Code at `/opt/denboard`
- Service `denboard.service`
- Health check at `http://127.0.0.1:PORT/api/health`

If you enable Caddy, it will proxy `HOSTNAME` (e.g. `denboard.local`) to `http://127.0.0.1:PORT`.

---

### Routes

Landscape (e.g. 55" bedroom TV):

- `/tv/home` – primary always‑on view (time + date focus, weather secondary, dad joke, home status tiles).
- `/tv/weather` – expanded weather view with 5‑day outlook and descriptive copy.
- `/tv/status` – home status and entities, with time and compact weather.

Portrait (e.g. 43" family display):

- `/p/home` – stacked time, weather, status, and dad joke.
- `/p/calendar` – 4‑week grid with today’s events; hides in Guest Mode.
- `/p/status` – portrait status view with time, weather, tiles, and dad joke.

---

### Guest Mode & Home Assistant

DenBoard reads a **Guest Mode** flag from Home Assistant:

- **Entity**: `input_boolean.denboard_guest_mode`

When Guest Mode is **ON**:

- **Hidden**:
  - Calendar details (today’s events and 4‑week grid)
  - Home Assistant status tiles
- **Still visible**:
  - Time and date
  - Current weather and 5‑day forecast
  - Dad joke
  - Severe weather alerts

Guest Mode transitions use smooth fades so the display never “jumps”.

The Home Assistant integration polls a curated entity list every 10 seconds via:

- `HOME_ASSISTANT_URL`
- `HOME_ASSISTANT_TOKEN`

---

### Auto‑refresh & caching

- **Weather**:
  - Server: cached 5–10 minutes.
  - Client: polls `/api/weather` roughly every 6 minutes.
- **Backgrounds**:
  - Uses Unsplash with search terms based on time of day and conditions.
  - Server‑side caching and rotation every ~45 minutes.
- **Calendar**:
  - Server: ICS parsed and cached for 5 minutes.
  - Client: polls `/api/calendar` every 5 minutes.
- **Home Assistant**:
  - Client: polls `/api/home-assistant` every 10 seconds.
- **Dad joke**:
  - Server: cached for ~45 minutes.
  - Client: polls `/api/dadjoke` on that interval.

All remote calls use a small retry wrapper and log clearly on failure. UI panels fail gracefully with soft “unavailable” copy rather than crashing.

---

### Systemd service (Debian 12 / Proxmox LXC)

Assuming the project lives at `/opt/denboard` and you want to run as user `denboard`:

```ini
[Unit]
Description=DenBoard family dashboard
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=denboard
Group=denboard
WorkingDirectory=/opt/denboard
Environment=NODE_ENV=production
EnvironmentFile=/opt/denboard/.env.local
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable denboard.service
sudo systemctl start denboard.service
```

Place your reverse proxy (Caddy, Nginx, etc.) in front of the service and proxy to `http://127.0.0.1:PORT`.

---

### Environment configuration (.env)

In production the installer expects `/opt/denboard/.env` to exist. It will copy from `.env.example` the first time if missing and then leave it untouched.

Required variables:

```bash
UNSPLASH_ACCESS_KEY=
DASHBOARD_LAT=
DASHBOARD_LON=
DASHBOARD_TZ=America/Denver
GCAL_ICS_URL=
HOME_ASSISTANT_URL=
HOME_ASSISTANT_TOKEN=
PORT=3000
```

Update `/opt/denboard/.env` as needed, then restart:

```bash
sudo systemctl restart denboard.service
```

---

### Updating DenBoard

To pull the latest code, reinstall dependencies, rebuild, and restart the service:

```bash
cd /opt/denboard
sudo bash scripts/update-denboard.sh
```

The script:

- Runs `git fetch` + `git pull --ff-only`
- Runs `npm ci` and `npm run build` as the `denboard` user
- Restarts `denboard.service`
- On failure, prints:
  - `systemctl status denboard --no-pager`
  - `journalctl -u denboard -n 50 --no-pager`

It is safe to run repeatedly.

---

### Checking logs and health

- **Systemd status**:

  ```bash
  sudo systemctl status denboard.service --no-pager
  ```

- **Streaming logs**:

  ```bash
  sudo journalctl -u denboard.service -f --no-pager
  ```

- **Health endpoint** (inside the CT):

  ```bash
  curl http://127.0.0.1:3000/api/health
  ```

If you changed `PORT` in `.env`, substitute that value in the URL.

---

### Uninstalling

To remove DenBoard and its systemd service:

```bash
sudo systemctl stop denboard.service
sudo systemctl disable denboard.service
sudo rm -f /etc/systemd/system/denboard.service
sudo systemctl daemon-reload

sudo rm -rf /opt/denboard
sudo userdel denboard || true
```

If you installed Caddy specifically for DenBoard and no longer need it:

```bash
sudo systemctl stop caddy
sudo systemctl disable caddy
sudo apt-get remove -y caddy
sudo rm -f /etc/caddy/Caddyfile
```

---

### Production notes

- **Logging**: Server‑side utilities log with a small `logger` wrapper and avoid noisy console spam in production.
- **Failure handling**: Weather, backgrounds, calendar, Home Assistant, and dad jokes all have timeouts, retries, and present safe fallback UI.
- **PORT**: The Next.js server respects the `PORT` environment variable, so it can be managed cleanly by systemd and a reverse proxy.


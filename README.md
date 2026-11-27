# Larva

<p align="center">
  <img src="static/icons/dark/icon.svg" width="96" alt="Larva" />
</p>

<p align="center">
  <strong>Self-hosted, offline-first application for nutrition tracking, supplements and daily health habits, recipes and weekly meal planning.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Svelte_5-Runes-FF3E00?logo=svelte&logoColor=white" alt="Svelte 5 Runes" />
  <img src="https://img.shields.io/badge/SvelteKit-3.1-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit 3.1" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/SQLite-Drizzle_ORM-003B57?logo=sqlite&logoColor=white" alt="SQLite & Drizzle" />
  <img src="https://img.shields.io/badge/PWA-Offline_First-5A0FC8?logo=pwa&logoColor=white" alt="Offline-First PWA" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D24-339933?logo=nodedotjs&logoColor=white" alt="Node.js >=24" />
</p>

---

Larva is a privacy-first, self-hosted web application designed from the ground up for mobile ergonomics. Navigation and high-frequency actions stay anchored at the bottom of the screen within comfortable thumb reach, allowing you to log meals, supplements, water and more in a few taps.

The nutrition diary and habit trackers work **offline-first** through IndexedDB and sync automatically with the server when network connectivity is available.

Install Larva on your phone or desktop as a **Progressive Web App (PWA)** for a seamless native-app feel, or run it through your preferred browser.

---

## Table of Contents

- [Features](#features)
  - [Nutrition Home & Food Diary](#nutrition-home--food-diary)
  - [Daily Log & History](#daily-log--history)
  - [Recipes & Meal Planning](#recipes--meal-planning)
  - [Settings, Ergonomics & PWA](#settings-ergonomics--pwa)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Local Development](#local-development)
- [Deployment](#deployment)
  - [Docker Compose](#docker-compose)
  - [Environment Variables](#environment-variables)
  - [HTTPS Requirement](#https-requirement)
  - [Push Notifications (Web Push)](#push-notifications-web-push)
  - [Admin Password Recovery](#admin-password-recovery)
- [User Management & Security](#user-management--security)
- [Automated Database Maintenance](#automated-database-maintenance)

---

## Features

### Nutrition Home & Food Diary

<table align="center">
  <thead>
    <tr>
      <th align="center">Food Diary</th>
      <th align="center">Log Meal</th>
      <th align="center">Macro Goals</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/Nutrition Today.png" width="180" alt="Daily food diary with calories and macronutrients" /></td>
      <td align="center"><img src="docs/screenshots/Nutrition Log Meal.png" width="180" alt="Meal logging view with food and amount selection" /></td>
      <td align="center"><img src="docs/screenshots/Nutrition Goal.png" width="180" alt="Daily calorie and macronutrient goal settings" /></td>
    </tr>
  </tbody>
</table>

- **Home Screen:** Nutrition is the start screen. Meals come first, followed by the daily log with supplements, water, caffeine, mood and meditation. The date arrows switch the whole screen to another day, so you can review or complete earlier days.
- **Daily Food Diary:** Log meals across the day with real-time calorie calculation and macronutrient progress rings (Protein, Carbohydrates, Fats, Fiber).
- **Dual Nutrition Database:** Search among 160+ built-in generic whole foods or query any branded item directly via the Open Food Facts barcode engine (includes Nutri-Score, Nova group, and nutritional values).
- **Estimated Energy Calculation:** Set customized targets manually or let Larva compute recommended caloric targets using the Mifflin-St Jeor metabolic expenditure algorithm based on your physical parameters.
- **Recipe Nutrition Mapping:** Map recipe ingredients to nutrition database entries once; Larva displays calculated calories per portion and enables logging prepared servings directly into your daily log.

---

### Daily Log & History

<table align="center">
  <thead>
    <tr>
      <th align="center">Daily Log</th>
      <th align="center">Quick Log</th>
      <th align="center">Weekly History</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/Supplement Today.png" width="180" alt="Today's supplement and health tracker overview" /></td>
      <td align="center"><img src="docs/screenshots/Log Supplement.png" width="180" alt="Quick-log view for a supplement" /></td>
      <td align="center"><img src="docs/screenshots/Supplement History_1.png" width="180" alt="Weekly supplement history and adherence overview" /></td>
    </tr>
  </tbody>
</table>

<table align="center">
  <thead>
    <tr>
      <th align="center">Tracker Log</th>
      <th align="center">Mood & Gratitude</th>
      <th align="center">Monthly History</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/Log Tracker.png" width="180" alt="Quick-log view for health and lifestyle trackers" /></td>
      <td align="center"><img src="docs/screenshots/mood_tracker.png" width="180" alt="Daily mood tracking view with gratitude note" /></td>
      <td align="center"><img src="docs/screenshots/Supplement History_2.png" width="180" alt="Monthly supplement history and adherence overview" /></td>
    </tr>
  </tbody>
</table>

- **Supplements & Nootropics:** One-tap quick intake logging. Define nutrient breakdowns per unit (e.g., 200 mg Magnesium per capsule); Larva calculates your aggregated daily micronutrient totals. Track inventory stock levels.
- **Hydration Tracking:** Quick-log water intake with customizable presets, track progress towards your daily milliliter goal, and schedule interval reminders throughout the day.
- **Caffeine Intake:** Built-in drink catalog (coffee, espresso, energy drinks, tea) with customizable default serving sizes and caffeine ratings. Visual threshold indicator alerts you when reaching your daily caffeine ceiling.
- **Meditation Timer:** Full-screen timer with calming animations, configurable preparation countdowns, soothing start/end bell acoustics, and adherence metrics.
- **Mood Journal:** Log daily mental well-being on a 1–5 scale accompanied by activity tags and gratitude reflections.
- **History, Adherence Metrics & PDF Export:** A dedicated History tab with week, month and year views: averages with the number of logged days, comparisons with the previous period, a year calendar of logging consistency per category, approximate supplement adherence and food micronutrients with their data coverage. Tapping a day opens it on the home screen. Generate and export polished, printer-friendly PDF clinical reports for medical professionals or trainers.

---

### Recipes & Meal Planning

<table align="center">
  <thead>
    <tr>
      <th align="center">Recipe Catalog</th>
      <th align="center">Recipe Details</th>
      <th align="center">Meal Planner</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/Recipes.png" width="180" alt="Overview of saved recipes" /></td>
      <td align="center"><img src="docs/screenshots/Recipes_detail.png" width="180" alt="Recipe details with ingredients and serving controls" /></td>
      <td align="center"><img src="docs/screenshots/Meal Planner.png" width="180" alt="Weekly meal planner with scheduled recipes" /></td>
    </tr>
  </tbody>
</table>

- **Recipe Library & Web Scraper:** Store, tag, rate, and organize personal recipes. Import full recipes, ingredients, and instructions directly from popular cooking sites via URL.
- **Dynamic Serving Scaler:** Dynamically scale ingredient quantities by adjusting portion count.
- **Weekly Meal Planner:** Schedule meals for every day of the week and adjust servings per meal.

---

### Settings, Ergonomics & PWA

<table align="center">
  <thead>
    <tr>
      <th align="center">Settings Page</th>
      <th align="center">Navigation Menu</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="docs/screenshots/Settings Page.png" width="180" alt="Larva settings and customization options" /></td>
      <td align="center"><img src="docs/screenshots/Options Menu.png" width="180" alt="Navigation menu with Larva app sections" /></td>
    </tr>
  </tbody>
</table>

- **Modular Feature Toggles:** Hide trackers you do not use (water, caffeine, mood, meditation) in the tracker settings and the Recipes tab in *Settings*.
- **Quick-Access Action Wheel:** Long-press the floating action button (`+`) to activate up to 4 configurable radial shortcuts: log a meal, supplement, water, caffeine, mood or meditation.
- **Dark & Light Mode:** Seamlessly harmonizes with operating system visual preferences.
- **Internationalization (i18n):** Native support for English and German via `@inlang/paraglide-js`.

---

## Architecture & Tech Stack

Larva is engineered for reliability, deterministic offline operation, and sub-millisecond local latency:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (PWA)                          │
│  SvelteKit 3.1 (Svelte 5 Runes) + Tailwind CSS v4           │
│  IndexedDB (Dexie.js) + Multi-Tab Web Locks Synchronization │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTPS (REST / WebPush)       
┌──────────────────────────────▼──────────────────────────────┐
│                    Server (Node.js 24)                      │
│  SvelteKit Node Adapter                                     │
│  Custom Scrypt Authentication + Session Store               │
└──────────────────────────────▲──────────────────────────────┘
                               │ better-sqlite3 + WAL Mode
┌──────────────────────────────▼──────────────────────────────┐
│                  Database Engine (SQLite)                   │
│  Drizzle ORM + Idempotent Incremental Migrations            │
└─────────────────────────────────────────────────────────────┘
```

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend Framework** | SvelteKit 3.1 & Svelte 5 | Strict Runes reactivity (`$state`, `$derived`, `$props`, `$effect`). |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Modern, lightweight, atomic styling. |
| **Icons** | `@lucide/svelte` | Clean, accessible icon system. |
| **Client Storage** | Dexie.js (IndexedDB) | Offline persistence and FIFO mutation queue. |
| **Concurrency Lock** | Web Locks API | Inter-tab exclusion to serialize queue draining. |
| **Barcode Recognition** | BarcodeDetector API + ZBar WASM | Dual-layer hardware-accelerated barcode decoding. |
| **Server Engine** | Node.js `>=24` (Alpine base) | High-performance ESM backend. |
| **Database** | SQLite via `better-sqlite3` | Zero-latency embedded transactional storage. |
| **ORM & Migrations** | Drizzle ORM (`drizzle-orm`) | Type-safe queries and schema definition. |
| **Push Notifications** | Web Push API (`web-push`) | Background reminders. |
| **Localization** | Paraglide JS | Compile-time internationalization. |

---

## Local Development

### Prerequisites

- **Node.js:** `>=24.0.0 <25.0.0`
- **npm:** `>=10.0.0`
- C++ build tools (required by `better-sqlite3` compilation if prebuilt binaries are unavailable).

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/peterthepeter/groly.git larva
cd larva

# 2. Install dependencies (deterministic lockfile)
npm ci

# 3. Compile i18n catalogs and sync SvelteKit types
npm run prepare

# 4. Start the Vite development server
npm run dev
```

Navigate to `http://localhost:5173`.

### Quality & Verification Pipeline

Larva enforces strict zero-warning compilation and comprehensive testing:

```bash
# Type check and Svelte diagnostic validation
npm run check

# Execute unit and integration tests (Vitest)
npm run test

# Validate vendor dependency integrity & migration generator
npm run test:dependencies

# Verify production build with zero Rollup/Vite warnings
npm run build

# Run end-to-end browser tests (Playwright)
npm run test:browser
```

---

## Deployment

### Docker Compose

The standard production deployment runs through Docker Compose:

```yaml
services:
  larva:
    image: ghcr.io/peterthepeter/groly:latest
    container_name: larva
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - larva-data:/app/data
    environment:
      - NODE_ENV=production
      - ORIGIN=https://larva.example.com
      - DATABASE_URL=/app/data/groly.db
      - BODY_SIZE_LIMIT=15M
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=ChangeMeImmediately123!
      # Optional: Web Push Configuration
      - VAPID_PUBLIC_KEY=
      - VAPID_PRIVATE_KEY=
      - PUBLIC_VAPID_PUBLIC_KEY=
      - VAPID_SUBJECT=mailto:admin@example.com
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  larva-data:
```

Launch with:

```bash
docker compose up -d
```

---

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Node runtime environment. |
| `PORT` | `3000` | Internal HTTP port. |
| `ORIGIN` | *Required in Prod* | Canonical public URL (e.g., `https://larva.yourdomain.com`). |
| `DATABASE_URL` | `/app/data/groly.db` | Path to the SQLite database file on disk. |
| `BODY_SIZE_LIMIT` | `15M` | Maximum allowed payload size for uploads and recipe imports. |
| `ADMIN_USERNAME` | `admin` | Username for the primary instance administrator. |
| `ADMIN_PASSWORD` | *Empty* | Password set on initial bootstrap (ignored once DB exists). |
| `ADMIN_PASSWORD_RESET`| *Empty* | Set temporarily to force an admin password reset on restart. |
| `VAPID_PUBLIC_KEY` | *Empty* | Public VAPID key for Web Push. |
| `PUBLIC_VAPID_PUBLIC_KEY` | *Empty* | Must match `VAPID_PUBLIC_KEY` for client consumption. |
| `VAPID_PRIVATE_KEY` | *Empty* | Private VAPID key for backend notification signing. |
| `VAPID_SUBJECT` | *Empty* | Contact URI (`mailto:` or `https://`) required by Apple/Google push servers. |
| `OFF_COUNTRY` | *Empty* | Restricts Open Food Facts text search to one country (e.g. `chile`). |
| `OFF_PREFERRED_BARCODE_PREFIX` | `780` | Barcode prefix (GS1 country) ranked higher in food search; empty disables it. |
| `OFF_PREFERRED_COUNTRY` | `chile` | Open Food Facts country ranked higher in food search; empty disables it. |

---

### HTTPS Requirement

**HTTPS is mandatory** for modern browser features and security guarantees:

| Capability | Requirement Reason |
| :--- | :--- |
| **Offline Cache** | Service Workers will not register on insecure origins. |
| **PWA Installation** | Mobile browsers enforce HTTPS for "Add to Home Screen". |
| **Push Notifications** | The Web Push API requires secure contexts. |
| **Barcode Scanner** | Camera access (`getUserMedia`) is restricted to HTTPS. |
| **Session Cookies** | Session cookies set the `Secure` flag in production. |

#### Obtaining HTTPS

- **Tailscale (Easiest):** Enable HTTPS in the Tailscale Admin Console for automated Let's Encrypt certificates without opening ports.
- **Cloudflare Tunnel:** Zero-port tunnel providing managed HTTPS termination.
- **Reverse Proxy:** Terminate SSL with **Caddy**, **Nginx Proxy Manager**, or **Traefik**.

---

### Push Notifications (Web Push)

To enable push notifications for tracker reminders:

1. Generate a valid VAPID keypair:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Assign the output keys to `VAPID_PUBLIC_KEY`, `PUBLIC_VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` in your environment.
3. Configure `VAPID_SUBJECT` with your administrative email address.

---

### Admin Password Recovery

If the administrator password is lost:

1. Add `ADMIN_PASSWORD_RESET=YourNewTemporaryPassword123!` to the container environment.
2. Restart the container. Larva resets the admin account password on boot and invalidates existing sessions.
3. Log in with the new credentials and remove the environment variable from your configuration.

---

## User Management & Security

Larva operates under a **private invitation model**:
- There is **no public registration**.
- Administrators create users through the web interface (*Menu → Users → Add User*).
- An invitation link valid for **48 hours** is generated for the new user to securely set their password upon first access.
- Passwords are salted and hashed using **scrypt** with memory-hard parameters.

---

## Automated Database Maintenance

Larva executes an automated daily housekeeping routine at midnight to keep SQLite storage compact:

- **Barcode Cache:** Product lookup cache pruned after **6 months** without access.
- **Session Tokens:** Expired authentication sessions purged daily.
- **Stale Push Subscriptions:** Dead endpoints returning HTTP 404/410 are automatically deregistered.
- **Unused Images:** Uploaded images that no recipe, meal or favourite references any more are deleted once they are older than a day.

---

## License

This project is open-source software licensed under the MIT License.

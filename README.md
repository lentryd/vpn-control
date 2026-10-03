<div align="center">

<img src="web/public/favicon.svg" width="72" alt="">

# VPN Control

**A back office for VPN services running on [Remnawave](https://github.com/remnawave/panel)**

Customers, subscriptions, payments with auto-renewal, tariffs, add-ons, referrals and infrastructure costs, all in one place and synced with your panel.

[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)](go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](web/package.json)
[![Mantine](https://img.shields.io/badge/Mantine-9-339AF0?logo=mantine&logoColor=white)](web/package.json)
[![SQLite](https://img.shields.io/badge/SQLite-no%20CGO-003B57?logo=sqlite&logoColor=white)](internal/store)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)

**English** · [Русский](README.ru.md)

<img src="docs/screenshots/en/dashboard.webp" alt="Dashboard: MRR, expenses, profit, income and expenses by month, users' traffic" width="100%">

</div>

## Why

Remnawave manages VPN users well, but it doesn't track money. Who paid, for how long, what they owe, who referred them, and what the servers cost: these usually end up in a spreadsheet. VPN Control keeps that bookkeeping and pushes the result to the panel. A recorded payment extends the right panel users, and a tariff change updates their limits and squads.

## Features

- **Customers and subscriptions.** A paying customer can have several subscriptions (Remnawave users), and each subscription can have add-ons.
- **Terms at a glance.** A dashboard, expiry filters, and status and traffic from the panel show who expires when.
- **Payments with auto-renewal.** A payment goes to the customer's balance. A preview shows how many months it covers for which subscriptions and add-ons. Once you confirm, the new `expireAt` values go to the panel and any remainder stays on the balance.
- **Tariffs.** Base and add-on tariffs with a price, term discounts (3/6/12 months, trial days), traffic limit, reset strategy, HWID limit and squads. A subscription can have a custom price. Changing the tariff prices the rest of the term.
- **Add-ons.** An add-on is a separate panel user named `prefix + <username> + suffix` whose configs are appended to the main subscription (by [subpage](#add-ons-and-the-api) or a similar service). You can manage add-ons in the UI or load them from a file, and other services fetch the catalog over the API.
- **Tariffs with included add-ons.** A base tariff can include add-ons. These are connected for free and are extended, enabled and disabled together with the subscription.
- **Referrals.** A "who referred whom" tree, with bookkeeping accruals of X% of referred customers' payments. Accruals don't change balances.
- **Expenses in any currency.** Amounts are converted to the base currency at the date's rate (Bank of Russia, ECB). You can add a bank fee and a cost share. The converted amount is fixed when the expense is recorded. Refunds are kept separately.
- **Traffic-metered expenses.** For CDNs and per-GB transit, the cost comes from a node's traffic, with a forecast for the period and the top consumers. See [Metered pricing](#metered-pricing).
- **Backups.** Export and import by category, scheduled snapshots, and snapshot download over the API.
- **English and Russian UI.** It installs as a PWA. Offline, it shows cached data and disables changes.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/en/customer.webp" alt="Customer page"><br><sub><b>Customer:</b> balance, subscriptions, add-ons, traffic and payment history</sub></td>
    <td width="50%"><img src="docs/screenshots/en/payment.webp" alt="Payment modal"><br><sub><b>Payment:</b> a preview of what it extends and until when</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/en/subscriptions.webp" alt="Subscriptions"><br><sub><b>Subscriptions:</b> status, terms and traffic from the panel</sub></td>
    <td><img src="docs/screenshots/en/customers.webp" alt="Customers"><br><sub><b>Customers:</b> next expiry, monthly revenue, balance and debt</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/en/tariffs.webp" alt="Tariffs and add-ons"><br><sub><b>Tariffs:</b> term discounts, limits, squads and included add-ons</sub></td>
    <td><img src="docs/screenshots/en/expense-items.webp" alt="Expense items"><br><sub><b>Expense items:</b> fixed and per-GB costs in any currency</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/en/referrals.webp" alt="Referral tree"><br><sub><b>Referrals:</b> who referred whom and how much they bring in</sub></td>
  </tr>
</table>

<sub>The screenshots show made-up demo data.</sub>

## Quick start

You need a Remnawave panel and Docker. VPN Control runs as a separate container in the panel's docker network.

1. In the panel, create an API token (**API tokens**) with the scopes `users:*`, `internal-squads:read`, `nodes:read`, `bandwidth-stats:read` and `infra-billing:read`, or with `*`.
2. Clone the repository and fill in `.env`:

   ```bash
   git clone https://github.com/lentryd/vpn-control.git && cd vpn-control
   cp .env.example .env
   # set REMNAWAVE_TOKEN, APP_DOMAIN and JWT_SECRET (openssl rand -hex 32)
   ```

3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Open `https://$APP_DOMAIN/` and sign in with your panel admin username and password.

### Deployment notes

- The container joins the panel's docker network (`REMNAWAVE_NETWORK`, default `remnawave-network`) and talks to the backend directly at `http://remnawave:3000`. It sets the `X-Forwarded-*` headers the panel requires.
- Traefik labels serve the app at `https://$APP_DOMAIN/`. The app needs its own domain, for example a subdomain of the panel's. Set `TRAEFIK_CERTRESOLVER` and `TRAEFIK_ENTRYPOINTS` to match your Traefik.
- **Traefik on another host through frp:** add `COMPOSE_FILE=compose.yml:compose.frp.yml` to `.env`. `HOST_PORT` is then tunnelled to `1${HOST_PORT}` on the Traefik side.
- **Without Traefik:** the app listens on `HOST_PORT`, so put any reverse proxy in front of it. Keep HTTPS, or set `SECURE_COOKIE=false` for a plain-HTTP local run.
- **Login.** Admins sign in with their panel credentials. The app checks them with `POST /api/auth/login` and issues its own session. If the panel only allows OAuth or passkeys, set `ADMIN_PASSWORD` for a local login.

### Webhooks (optional)

Webhooks update statuses instantly. In the panel's `.env`, set:

- `WEBHOOK_ENABLED=true`
- `WEBHOOK_URL=https://<APP_DOMAIN>/api/webhooks/remnawave`. The panel only accepts `https://`, so the webhook goes through its Traefik.
- the same secret in the panel's `WEBHOOK_SECRET_HEADER` and in `WEBHOOK_SECRET` here.

Without webhooks, data is synced every `SYNC_INTERVAL` (10 minutes by default) and with the ⟳ button.

## Configuration

Everything is set through environment variables. See [`.env.example`](.env.example) for the full list. The main ones:

| Variable | Default | Meaning |
|---|---|---|
| `REMNAWAVE_URL`, `REMNAWAVE_TOKEN` | — | Panel backend and API token (required) |
| `JWT_SECRET` | — | Signs admin sessions (required) |
| `APP_DOMAIN` | — | Domain Traefik serves the app at |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `admin`, empty | Local fallback login; an empty password turns it off |
| `TZ` | `UTC` | Time zone used to show dates and to cut periods |
| `SYNC_INTERVAL` | `10m` | Panel users sync |
| `TRAFFIC_SYNC_INTERVAL` | `1h` | Node traffic sync for metered expenses |
| `ADDONS_FILE` / `ADDONS_CONFIG` | `./addons.yml` | Optional add-ons file (host path / path inside the app) |
| `DB_PATH` | `./data/vpn-control.db` | SQLite database |

These settings are edited in the UI (**Settings**):

- **Base currency.** Payments, balances and expense totals are kept in it. Rates come from the Bank of Russia for RUB and from the ECB for EUR, USD, GBP, CHF, PLN and others. You can change it only while there are no payments or expenses yet.
- **Referral percent**, the **"expiring soon" window** and the **default currency fee**.
- **Backup schedule**: how often snapshots are taken and how many are kept.

## Metered pricing

A "by traffic" expense item takes its traffic from a panel node, optionally only from the members of one internal squad on it. It is then priced the way the provider bills:

- **GB unit:** binary (1 GB = 1024³ bytes) or decimal (10⁹ bytes).
- **Minimum:** either *minimum charge*, where cost = `max(minimum, GB × price)`, or *fee + free allowance*, where cost = `fee + (GB − free GB) × price`.
- **Price:** a flat price per GB or graduated tiers ("up to 10 000 GB at X, then Y").
- **Period start day:** 1–28, for billing cycles that don't start on the 1st.

Examples:

| Provider | GB unit | Minimum | Price |
|---|---|---|---|
| Yandex Cloud CDN | binary | minimum charge | flat per GB |
| Bunny, Gcore | decimal | minimum charge (or none) | tiers by volume |
| Plans with included traffic | decimal | fee + free allowance | overage per GB |

**Close period** books the calculated cost as an expense. When the invoice arrives, change the amount to the invoiced one. The calculated value is kept for comparison.

## Add-ons and the API

Add-ons come from two sources:

- **The UI** (**Tariffs → Add-ons**): name, prefix and suffix, plus subpage's config names (`remark`, `remarkUnlimited`) and stubs.
- **An add-ons file** in subpage's `addons.yml` format (`ADDONS_FILE`). Add-ons from the file are read-only in the UI.

A base tariff can **include add-ons**: pick their add-on tariffs on the tariff. When you change the list, you can apply it to current subscribers right away. Otherwise it applies on their next tariff change. When a subscription moves to a tariff without one of its included add-ons, you choose whether to disable the add-on or keep it as a paid one.

Other services can read the catalog. Create a token in **Settings → API tokens**, as in the panel: a name, an expiry in days and scopes per resource (Read/Write or single endpoints; presets: read only, full access, subpage). A token is shown once, and only a hash of it is stored. Then call the API:

```bash
curl -H "Authorization: Bearer vpc_…" https://control.example.com/api/v1/addons              # JSON
curl -H "Authorization: Bearer vpc_…" "https://control.example.com/api/v1/addons?format=yaml" # addons.yml
```

| Endpoint | Endpoint key | |
|---|---|---|
| `GET /api/v1/addons` | `addons:list` | The add-on catalog; `?format=yaml` returns subpage's file format |
| `GET /api/v1/backups` | `backups:list` | List of snapshots |
| `GET /api/v1/backups/{name}` | `backups:download` | Download a snapshot |
| `POST /api/v1/backups` | `backups:create` | Take a snapshot and download it in the same response |

Scopes follow the panel's grammar: `*`, `<resource>:*`, `<resource>:read`, `<resource>:write` or an endpoint key from the table.

## Backups

In **Settings → Backups**:

- **Snapshots** are full copies of the database in `data/backups`. They are taken on a schedule, by hand, and automatically before every import. You can download them, restore them by category, or fetch them over the API.
- **Export** writes the selected categories to a zip archive: a `manifest.json` plus one JSON file per table. IDs and dates are kept as they are.
- **Import** replaces the selected categories in a single transaction. If the result would leave references to missing rows (for example, subscriptions without customers), the import is rolled back. The current data is saved as a pre-import snapshot first.

## Development

Requirements: Go 1.26, [Bun](https://bun.sh) and [Task](https://taskfile.dev).

```bash
task init      # .env, frontend dependencies
task dev       # API on :8080 and the Bun dev server on :5173 (proxies /api)
task test      # go test, frontend type check and locale key check
task build     # bin/vpn-control with the embedded UI
```

For a local run, set `SECURE_COOKIE=false` and an `ADMIN_PASSWORD` in `.env`. The app still needs a reachable panel for `REMNAWAVE_URL`. `go run . --no-sync` skips the background sync.

- Stack: Go, Fiber, Ent and SQLite (no CGO) on the backend; Mantine 9, mantine-react-table, TanStack Query and i18next on the frontend. The built UI is embedded in the binary.
- After editing `ent/schema`, run `task ent:generate`. Migrations run automatically on start.
- UI strings live in `web/public/locales/{en,ru}/vpn-control.json`. Keys are type-checked against the English file, and `bun run i18n:check` checks that every locale has the same keys. To add a language, add a folder there and list the language in `web/src/app/i18n/i18n.ts`.
- API errors carry a `code` (with `params`) that the UI translates (`errors.*` in the locales), plus an English `message` as a fallback.

## License

[AGPL-3.0](LICENSE). The theme, layout and some UI components are adapted from [remnawave/frontend](https://github.com/remnawave/frontend) (AGPL-3.0). See [`web/THIRD_PARTY.md`](web/THIRD_PARTY.md).

VPN Control is an independent project and is not affiliated with the Remnawave team.

# vpn-control

[Русская версия](README.ru.md)

A back office for a VPN service running on the [Remnawave](https://github.com/remnawave/panel) panel: customers, subscriptions, payments with auto-renewal, tariffs, add-ons, referrals and infrastructure costs. The UI is available in English and Russian.

What it does:

- **Customers and subscriptions.** A paying customer can have several subscriptions (Remnawave users). Each subscription can have add-ons.
- **Terms.** See who expires when: a dashboard, expiry filters, status and traffic from the panel.
- **Payments with auto-renewal.** A payment goes to the customer's balance. A preview then shows how many months it covers for which subscriptions and add-ons. Once you confirm, the new `expireAt` values are sent to the panel and any remainder stays on the balance.
- **Tariffs.** Base and add-on tariffs with a price, term discounts (3/6/12 months, trial days), traffic limit, reset strategy, HWID limit and squads. A subscription can have a custom price. Changing the tariff prices the rest of the term.
- **Add-ons.** An add-on is a separate panel user named `prefix + <username> + suffix` whose configs are appended to the main subscription (by subpage or a similar service). You can manage add-ons in the UI or load them from a file. Other services fetch the catalog through the API.
- **Tariffs with included add-ons.** A base tariff can include add-ons. These are connected for free and are extended, enabled and disabled together with the subscription.
- **Referrals.** A "who referred whom" tree and bookkeeping accruals of X% of referred customers' payments. Accruals don't change balances.
- **Expenses in any currency.** Amounts are converted to the base currency at the date's rate. A bank fee and a cost share can be added (for example, 30% when a domain is split three ways). The converted amount is fixed when the expense is recorded. Refunds are kept separately.
- **Traffic-metered expenses.** For CDNs and per-GB transit: cost from the traffic of a node (or of one squad's users on it), a forecast for the period, and the top consumers. See [Metered pricing](#metered-pricing).
- **Backups.** Export and import by category, scheduled snapshots, and snapshot download over the API.

Stack: Go 1.26, Fiber, Ent and SQLite (no CGO). The UI uses Mantine 9, mantine-react-table, TanStack Query and i18next. The theme, layout and components come from the Remnawave frontend (AGPL-3.0, see `web/THIRD_PARTY.md`). The built UI is embedded in the binary.

## Running next to the panel

1. In the panel, create an API token (**API tokens**) with the scopes `users:*`, `internal-squads:read`, `nodes:read`, `bandwidth-stats:read` and `infra-billing:read` (providers and payment dates from Infra Billing), or with `*`.
2. Fill in `.env`:

   ```bash
   cp .env.example .env
   # REMNAWAVE_TOKEN, PANEL_DOMAIN, JWT_SECRET (openssl rand -hex 32)
   ```

3. Run `docker compose up -d --build`.

The container joins the panel's docker network (`REMNAWAVE_NETWORK`, default `remnawave-network`) and talks to the backend directly at `http://remnawave:3000`. It sets the `X-Forwarded-*` headers the panel requires. Traefik labels serve the app at `https://$PANEL_DOMAIN$BASE_PATH/`, with `/control` as the default path. Set `TRAEFIK_CERTRESOLVER` and `TRAEFIK_ENTRYPOINTS` to match your Traefik.

**Traefik on another host through frp:** add `COMPOSE_FILE=compose.yml:compose.frp.yml` to `.env`. `HOST_PORT` is then tunnelled to `1${HOST_PORT}` on the Traefik side.

**Without Traefik:** the app listens on `HOST_PORT`. Put any reverse proxy in front of it. Keep HTTPS, or set `SECURE_COOKIE=false` for a plain-HTTP local run.

Admins sign in with their panel username and password. The app checks them with `POST /api/auth/login` and issues its own session. If the panel only allows OAuth or passkeys, set `ADMIN_PASSWORD` for a local login.

**Webhooks (optional)** update statuses instantly. In the panel's `.env`, set:

- `WEBHOOK_ENABLED=true`
- `WEBHOOK_URL=https://<PANEL_DOMAIN>/control/api/webhooks/remnawave`. The panel only accepts `https://`, so the webhook goes through its Traefik.
- the same secret in the panel's `WEBHOOK_SECRET_HEADER` and in `WEBHOOK_SECRET` here.

Without webhooks, data is synced every `SYNC_INTERVAL` (10 minutes by default) and with the ⟳ button.

## Configuration

Everything is set through environment variables; see `.env.example` for the full list. The main ones:

| Variable | Default | Meaning |
|---|---|---|
| `REMNAWAVE_URL`, `REMNAWAVE_TOKEN` | — | Panel backend and API token (required) |
| `JWT_SECRET` | — | Signs admin sessions (required) |
| `BASE_PATH` | `/control` in compose, empty locally | URL prefix of the app |
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

A "by traffic" expense item takes its traffic from a panel node (and optionally only from the members of one internal squad on it). It is then priced the way the provider bills:

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

Other services can read the catalog. Create a token in **Settings → API tokens**. A token is shown once, and only a hash of it is stored. Then call the API:

```bash
curl -H "Authorization: Bearer vpc_…" https://panel.example.com/control/api/v1/addons              # JSON
curl -H "Authorization: Bearer vpc_…" "https://panel.example.com/control/api/v1/addons?format=yaml" # addons.yml
```

| Endpoint | Scope | |
|---|---|---|
| `GET /api/v1/addons` | `addons:read` | The add-on catalog; `?format=yaml` returns subpage's file format |
| `GET /api/v1/backups` | `backups:read` | List of snapshots |
| `GET /api/v1/backups/{name}` | `backups:read` | Download a snapshot |
| `POST /api/v1/backups` | `backups:write` | Take a snapshot and download it in the same response |

A base tariff can **include add-ons**: pick their add-on tariffs on the tariff. When you change the list, you can apply it to current subscribers right away. Otherwise it applies on their next tariff change. When a subscription moves to a tariff without one of its included add-ons, you choose whether to disable the add-on or keep it as a paid one.

## Backups

**Settings → Backups:**

- **Snapshots** are full copies of the database in `data/backups`. They are taken on a schedule, by hand, and automatically before every import. You can download them, restore them by category, or fetch them over the API.
- **Export** writes the selected categories to a zip archive: a `manifest.json` plus one JSON file per table. IDs and dates are kept as they are.
- **Import** replaces the selected categories in a single transaction. If the result would leave references to missing rows (for example, subscriptions without customers), the import is rolled back. The current data is saved as a pre-import snapshot first.

## Development

```bash
task init      # .env, frontend dependencies
task dev       # API on :8080 and Vite on :5173 (proxies /api)
task test      # go test, frontend type check and locale key check
task build     # bin/vpn-control with the embedded UI
```

- After editing `ent/schema`, run `task ent:generate`. Migrations run automatically on start.
- UI strings live in `web/public/locales/{en,ru}/vpn-control.json`. Keys are type-checked against the English file, and `bun run i18n:check` checks that every locale has the same keys. To add a language, add a folder there and list the language in `web/src/app/i18n/i18n.ts`.
- API errors carry a `code` (with `params`) that the UI translates (`errors.*` in the locales), plus an English `message` as a fallback.

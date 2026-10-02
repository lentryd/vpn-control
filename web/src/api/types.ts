export type RwStatus = 'ACTIVE' | 'DISABLED' | 'LIMITED' | 'EXPIRED' | string

export interface RwUser {
    id: number
    username: string
    short_uuid: string
    status: RwStatus
    expire_at: string | null
    unlimited: boolean
    used_traffic_bytes: number
    traffic_limit_bytes: number
    traffic_limit_strategy: string
    hwid_device_limit: number | null
    online_at: string | null
    description: string
    tag: string
    telegram_id: number | null
    subscription_url: string
    squad_uuids: string[] | null
    deleted: boolean
    synced_at: string
}

export interface RwUserRow extends RwUser {
    subscription_id: number | null
    subscription_addon_id: number | null
    parent_subscription_id: number | null
    customer_id: number | null
    customer_name: string
    linked: boolean
}

export interface AddonItem {
    id: number
    subscription_id: number
    addon_id: number
    addon_name: string
    tariff_id: number | null
    tariff_name: string
    price_override: number | null
    price: number
    auto_extend: boolean
    rw_user: RwUser | null
}

export interface Subscription {
    id: number
    customer_id: number
    customer_name: string
    customer_archived: boolean
    tariff_id: number | null
    tariff_name: string
    label: string
    title: string
    price_override: number | null
    price: number
    auto_extend: boolean
    rw_user: RwUser | null
    addons: AddonItem[]
    created_at: string
}

export interface Customer {
    id: number
    name: string
    contact: string
    notes: string
    referrer_id: number | null
    referrer_name: string
    referral_percent: number | null
    archived: boolean
    balance: number
    subscriptions_count: number
    addons_count: number
    monthly: number
    nearest_expire_at: string | null
    referrals_count: number
    total_paid: number
    last_payment_at: string | null
    created_at: string
}

export interface Payment {
    id: number
    customer_id: number
    customer_name: string
    amount: number
    date: string
    method: string
    note: string
    historical: boolean
}

export interface LedgerEntry {
    id: number
    type: 'payment' | 'charge' | 'adjustment' | 'refund'
    amount: number
    date: string
    note: string
}

export interface Accrual {
    id: number
    referrer_id: number
    referrer_name: string
    referee_id: number
    referee_name: string
    payment_id: number
    percent: number
    amount: number
    date: string
    status: string
}

export interface Extension {
    id: number
    kind: 'extend' | 'connect' | 'tariff_change'
    months: number
    days: number
    amount: number
    from_at: string | null
    to_at: string | null
    status: 'ok' | 'failed'
    error: string
    actor: string
    created_at: string
    subscription_id: number | null
    subscription_addon_id: number | null
}

export interface CustomerDetail extends Customer {
    subscriptions: Subscription[]
    payments: Payment[] | null
    ledger: LedgerEntry[] | null
    referrals: Customer[] | null
    accruals: Accrual[] | null
    extensions: Extension[] | null
}

export interface Period {
    months: number
    days: number
    price: number
}

export interface Tariff {
    id: number
    kind: 'base' | 'addon'
    addon_id: number | null
    addon_name: string
    name: string
    description: string
    monthly_price: number
    active: boolean
    sort_order: number
    manage_rw: boolean
    traffic_limit_bytes: number
    traffic_strategy: string
    hwid_limit: number | null
    squad_uuids: string[]
    periods: Period[]
    subscribers: number
    overridden: number
    mrr: number
}

export interface Addon {
    id: number
    name: string
    prefix: string
    suffix: string
    in_config: boolean
}

export interface Squad {
    uuid: string
    name: string
    info: { membersCount: number; inboundsCount: number }
}

export interface RwNode {
    uuid: string
    name: string
    address: string
    countryCode: string
    isConnected: boolean
    isDisabled: boolean
    usersOnline: number
    configProfile: { activeInbounds: { uuid: string; tag: string; type: string; port: number | null }[] | null }
}

export interface InboundStatus {
    source: 'prometheus' | 'api'
    precise: boolean
    last_poll: string | null
    last_error?: string
    since: string | null
}

export interface Expense {
    id: number
    date: string
    provider: string
    provider_uuid: string
    expense_item_id: number | null
    item_name: string
    kind: 'charge' | 'refund'
    orig_amount: number
    orig_currency: string
    fx_rate: number
    fee_percent: number
    share_percent: number
    rub_amount: number
    refund_of_id: number | null
    refunded_total: number
    calc_rub_amount: number | null
    metered_gb: number | null
    period: string
    note: string
}

export interface ProviderTotals {
    provider: string
    provider_uuid: string
    gross: number
    refunded: number
    net: number
    count: number
    last: string
}

export interface ExpenseItem {
    id: number
    name: string
    provider: string
    provider_uuid: string
    currency: string
    pricing: 'fixed' | 'metered'
    amount: number
    period: 'month' | 'year'
    fee_percent: number
    share_percent: number
    price_per_gb: number
    min_charge: number
    rw_node_uuid: string
    rw_inbound_tag: string
    rw_squad_uuid: string
    next_due_date: string | null
    active: boolean
    notes: string
    monthly_rub: number | null
    rate: number | null
    plan_error?: string
}

export interface Consumer {
    rw_user_id: number
    username: string
    customer_id: number | null
    customer_name: string
    subscription_id: number | null
    sub_title: string
    gb: number
    share_percent: number
    cost_rub: number
}

export interface MeteredSummary {
    item_id: number
    name: string
    node_uuid: string
    node_name: string
    inbound_tag: string
    squad_uuid: string
    squad_share_percent: number
    period: string
    currency: string
    price_per_gb: number
    min_charge: number
    included_gb: number
    used_gb: number
    cost: number
    cost_rub: number
    forecast_gb: number
    forecast_cost: number
    forecast_rub: number
    daily: { date: string; gb: number }[]
    top_consumers: Consumer[]
    consumer_error: string
    error?: string
}

export interface ExpiringItem {
    kind: 'subscription' | 'addon'
    id: number
    subscription_id: number
    title: string
    customer_id: number
    customer_name: string
    status: RwStatus
    expire_at: string
    days_left: number
    price: number
    balance: number
}

export interface Dashboard {
    window_days: number
    mrr: number
    planned_expenses: number
    profit: number
    active_customers: number
    active_subs: number
    active_addons: number
    income_total: number
    expenses_total: number
    cash_balance: number
    income_month: number
    expenses_month: number
    referral_total: number
    referral_month: number
    debt_total: number
    expiring: ExpiringItem[]
    due_soon:
        | {
              id: number
              name: string
              provider: string
              provider_uuid?: string
              node_uuid?: string
              next_due_date: string
              monthly_rub?: number
              source: 'item' | 'panel'
          }[]
        | null
    metered: MeteredSummary[] | null
    months: { month: string; income: number; expenses: number }[]
    sync: { last_sync: string | null; error: string | null }
}

export interface ReferralNode {
    id: number
    name: string
    archived: boolean
    monthly: number
    total_paid: number
    direct_count: number
    direct_active: number
    branch_count: number
    branch_paid: number
    branch_monthly: number
    accrued_total: number
    children: ReferralNode[]
}

export interface Allocation {
    kind: 'subscription' | 'addon'
    id: number
    title: string
    months: number
    days: number
    amount: number
    from: string
    to: string
}

export interface PlanItem {
    kind: 'subscription' | 'addon'
    id: number
    title: string
    monthly: number
    expire_at: string | null
    periods: Period[] | null
}

export interface ReferralInfo {
    referrer_id: number
    referrer_name: string
    percent: number
    amount: number
}

export interface PaymentPreview {
    balance_before: number
    balance_after_payment: number
    allocations: Allocation[]
    remainder: number
    items: PlanItem[]
    referral: ReferralInfo | null
}

export interface ExtensionResult {
    kind: string
    id: number
    title: string
    months: number
    days: number
    amount: number
    from: string | null
    to: string | null
    ok: boolean
    error: string
}

export interface AuditRow {
    id: number
    at: string
    actor: string
    action: string
    entity: string
    entity_id: number
    payload: string
    ok: boolean
    error: string
}

export interface InfraProvider {
    uuid: string
    name: string
    faviconLink: string | null
    loginUrl: string | null
    billingHistory: { totalAmount: number; totalBills: number }
}

export interface InfraBillingNode {
    uuid: string
    nodeUuid: string | null
    name: string | null
    providerUuid: string
    nextBillingAt: string
}

export interface Infra {
    providers: InfraProvider[]
    billing_nodes: InfraBillingNode[]
    error: string | null
}

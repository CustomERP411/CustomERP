#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * CustomERP universal mock-data seeder.
 *
 * Drop this file into the ROOT of any generated CustomERP project (the
 * directory that contains `backend/`, `frontend/`, `dev.ps1` and
 * `docker-compose.yml`) and run it from there.
 *
 *   node seed-mock-data.js [--reset] [--volume small|medium|large]
 *                          [--seed N] [--only s,s,...] [--skip s,s,...]
 *                          [--dry-run]
 *
 * What it does
 *   - Reads `backend/src/systemConfig.js` (always emitted by the assembler)
 *     to discover the entity slugs, module configs, audit-log allowlist,
 *     scheduled-report config, RBAC group definitions, etc.
 *   - Optionally reads `sdf.json` (placed in the ERP root by the assembler
 *     run-script) for richer per-field hints (options, references,
 *     computed flags, validation patterns).
 *   - Connects to PostgreSQL using the same env-var rules as
 *     `backend/src/repository/db.js` (PGHOST/PGPORT/PGUSER/PGPASSWORD/
 *     PGDATABASE or DATABASE_URL, with the same localhost defaults).
 *   - For every entity slug it queries `information_schema.columns` to
 *     learn the live shape, generates plausible mock values per column
 *     (name + type heuristics + SDF hints), and inserts in dependency
 *     order with FK references resolved from in-memory caches.
 *   - Per-entity playbooks fill the most important tables with realistic
 *     transactional data (movements that net to on-hand, invoices whose
 *     line totals roll into header totals, paid/overdue/draft mixes,
 *     attendance covering the configured work_days, leave balances per
 *     employee+year, payroll ledger lines per pay period, etc.).
 *   - Anything unrecognised is filled by the generic introspect-and-fill
 *     fallback so post-generation customisations (renamed/added fields,
 *     extra entities) keep working.
 *   - Adds a few demo `__erp_users` (password = `demo`) so the
 *     auto-seeded RBAC groups have visible members, and finishes by
 *     writing realistic `__audit_logs` entries plus a 7-day rolling
 *     `__reports` history.
 *
 * Idempotency
 *   - `--reset` truncates every non-system business table first.
 *   - Without `--reset` the script skips any table that is already
 *     non-empty.
 *
 * Dependencies
 *   - Pulled from `backend/node_modules`: `pg`, `uuid`, `bcryptjs`.
 *     They are always installed in a generated ERP, so this script
 *     needs zero extra `npm install`.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────
// 0. Locate ERP root + dependencies
// ─────────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, 'backend');

if (!fs.existsSync(BACKEND_DIR)) {
  console.error(
    '[seed-mock-data] Could not find backend/ in the current directory.'
  );
  console.error(
    '                 Run this script from the ROOT of a generated CustomERP project.'
  );
  process.exit(1);
}

// Resolve the three runtime deps from one of:
//   1. <project>/backend/node_modules (only present when backend was npm-installed on the host)
//   2. <project>/.seed-mock-data-deps/node_modules (auto-installed by this script on first run)
//   3. The current Node module resolution (fallback)
//
// (3) lets a packaged or globally-installed seeder still work; (2) lets the
// drop-in script work zero-config even when the backend's node_modules is
// only inside the Docker image.

const DEPS = ['pg', 'uuid', 'bcryptjs'];
const HOST_BACKEND_NM = path.join(BACKEND_DIR, 'node_modules');
const FALLBACK_DEPS_DIR = path.join(ROOT, '.seed-mock-data-deps');
const FALLBACK_NM = path.join(FALLBACK_DEPS_DIR, 'node_modules');

function tryRequireFrom(dir, name) {
  try {
    return require(path.join(dir, name));
  } catch {
    return null;
  }
}

function loadDep(name) {
  return (
    tryRequireFrom(HOST_BACKEND_NM, name) ||
    tryRequireFrom(FALLBACK_NM, name) ||
    (() => { try { return require(name); } catch { return null; } })()
  );
}

function ensureFallbackDeps() {
  const missing = DEPS.filter((d) => !tryRequireFrom(HOST_BACKEND_NM, d) && !tryRequireFrom(FALLBACK_NM, d) && !(function () { try { require(d); return true; } catch { return false; } })());
  if (missing.length === 0) return;
  console.log(`[seed-mock-data] Installing helper dependencies (${missing.join(', ')}) into ${FALLBACK_DEPS_DIR} ...`);
  fs.mkdirSync(FALLBACK_DEPS_DIR, { recursive: true });
  const pkgPath = path.join(FALLBACK_DEPS_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'seed-mock-data-deps', version: '0.0.0', private: true }, null, 2));
  }
  const cp = require('child_process');
  const cmd = `npm install --no-audit --no-fund --silent ${missing.join(' ')}`;
  try {
    cp.execSync(cmd, { cwd: FALLBACK_DEPS_DIR, stdio: 'inherit', shell: true });
  } catch (e) {
    console.error(`[seed-mock-data] npm install failed: ${e.message}. Install manually:`);
    console.error(`    cd "${FALLBACK_DEPS_DIR}"`);
    console.error(`    npm install ${missing.join(' ')}`);
    process.exit(2);
  }
}

ensureFallbackDeps();

const pgMod = loadDep('pg');
const uuidMod = loadDep('uuid');
const bcrypt = loadDep('bcryptjs');
if (!pgMod || !uuidMod || !bcrypt) {
  console.error('[seed-mock-data] Required dependencies (pg, uuid, bcryptjs) could not be loaded.');
  process.exit(2);
}
const { Pool } = pgMod;
const { v4: uuid } = uuidMod;

// ─────────────────────────────────────────────────────────────────────
// 1. CLI args
// ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    reset: false,
    volume: 'medium',
    seed: 1337,
    only: null,
    skip: new Set(),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reset') out.reset = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--volume') out.volume = argv[++i];
    else if (a === '--seed') out.seed = Number(argv[++i]) || 1337;
    else if (a === '--only') {
      out.only = new Set(String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--skip') {
      out.skip = new Set(String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node seed-mock-data.js [--reset] [--volume small|medium|large] [--seed N] [--only s,s] [--skip s,s] [--dry-run]'
      );
      process.exit(0);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const VOLUME_PROFILES = {
  small: { sites: 2, vendors: 3, clients: 8, articles: 15, units: 3, staff: 8, dispatch: 5, invoices: 6, attendance_days: 14, holds: 5, adjustments: 3, cycle_sessions: 1 },
  medium: { sites: 5, vendors: 8, clients: 25, articles: 50, units: 5, staff: 25, dispatch: 20, invoices: 25, attendance_days: 45, holds: 10, adjustments: 6, cycle_sessions: 2 },
  large: { sites: 10, vendors: 15, clients: 60, articles: 120, units: 8, staff: 60, dispatch: 50, invoices: 60, attendance_days: 90, holds: 25, adjustments: 15, cycle_sessions: 4 },
};
const V = VOLUME_PROFILES[args.volume] || VOLUME_PROFILES.medium;

function allowed(slug) {
  if (args.only && !args.only.has(slug)) return false;
  if (args.skip.has(slug)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Deterministic RNG + faker
// ─────────────────────────────────────────────────────────────────────

function makeRng(seedNum) {
  let s = (seedNum >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(args.seed);

const FIRST_NAMES = ['Aria', 'Ben', 'Cleo', 'Dax', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivy', 'Jude', 'Kai', 'Lena', 'Milo', 'Nova', 'Otto', 'Piper', 'Quinn', 'Rhea', 'Soren', 'Tessa', 'Uma', 'Vera', 'Wes', 'Xena', 'Yara', 'Zane', 'Selim', 'Burak', 'Tunc', 'Orhan', 'Elkhan'];
const LAST_NAMES = ['Ash', 'Brooks', 'Cole', 'Dale', 'Esher', 'Frost', 'Gale', 'Holt', 'Iris', 'Jett', 'Knox', 'Lane', 'Mead', 'Noor', 'Orris', 'Penn', 'Quill', 'Reed', 'Stone', 'Thorn', 'Underwood', 'Vance', 'Wren', 'Yates', 'Zhao'];
const COMPANY_NOUNS = ['Logistics', 'Holdings', 'Trading', 'Industries', 'Supply', 'Works', 'Group', 'Partners', 'Mercantile', 'Cooperative', 'Cargo', 'Provisions'];
const COMPANY_PREFIXES = ['North', 'South', 'East', 'West', 'Crown', 'Harbor', 'Summit', 'Atlas', 'Cedar', 'Iron', 'Maple', 'Pine', 'River', 'Sky', 'Stellar', 'Anchor'];
const STREETS = ['Main St', 'Oak Ave', 'Maple Rd', 'Cedar Blvd', 'Elm Way', 'Pine Ct', 'Birch Ln', 'Spruce Dr', 'Willow Pl', 'Aspen Pkwy'];
const CITIES = ['Ankara', 'Istanbul', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya'];
const SITE_TYPES = ['Warehouse', 'Store', 'Vehicle', 'Virtual'];
const SITE_NAMES = ['Central Hub', 'North Yard', 'South Depot', 'East Annex', 'West Annex', 'Riverside Bay', 'Hilltop Locker', 'Harbor Dock', 'Airport Bond', 'Downtown Outlet'];
const ITEM_ADJ = ['Premium', 'Standard', 'Deluxe', 'Compact', 'Heavy-Duty', 'Eco', 'Pro', 'Lite', 'Industrial', 'Artisan'];
const ITEM_NOUNS = ['Widget', 'Cog', 'Sprocket', 'Bracket', 'Harness', 'Module', 'Capsule', 'Cartridge', 'Filter', 'Plate', 'Rod', 'Bushing', 'Coupler', 'Sleeve', 'Sensor', 'Driver', 'Adapter', 'Bearing', 'Valve'];
const ITEM_CATEGORIES = ['Raw Material', 'Finished Good', 'Service', 'Consumable'];
const SHIFT_NAMES = ['Morning', 'Afternoon', 'Evening', 'Night', 'Split', 'Extended Day'];
const PAY_METHODS = ['Cash', 'Check', 'Bank Transfer', 'Credit Card', 'Online'];
const PAYMENT_TERMS = ['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 60'];
const LEAVE_TYPES = ['Annual', 'Sick', 'Unpaid', 'Maternity', 'Other'];
const ADJUST_REASONS = ['COUNT', 'DAMAGED', 'EXPIRED', 'RETURN', 'OTHER'];
const COMP_TYPES = ['Base', 'Overtime', 'Bonus', 'Deduction', 'Tax'];

function pickOne(arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function pickOneWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}
function intBetween(min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}
function floatBetween(min, max, decimals = 2) {
  const v = min + rng() * (max - min);
  return Number(v.toFixed(decimals));
}
function makeFirstName() { return pickOne(FIRST_NAMES); }
function makeLastName() { return pickOne(LAST_NAMES); }
function makeFullName() { return `${makeFirstName()} ${makeLastName()}`; }
function makeCompanyName() { return `${pickOne(COMPANY_PREFIXES)} ${pickOne(COMPANY_NOUNS)}`; }
function makeAddress() {
  return `${intBetween(1, 9999)} ${pickOne(STREETS)}, ${pickOne(CITIES)}`;
}
function makeEmail(seed) {
  const slug = String(seed || makeFullName()).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');
  const dom = pickOne(['example.com', 'demo.test', 'mail.local', 'corp.io']);
  return `${slug}.${intBetween(10, 999)}@${dom}`;
}
function makePhone() {
  return `+90 ${intBetween(500, 599)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`;
}
function makeSku() {
  const a = pickOne(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X', 'Z']);
  return `${a}${a}${intBetween(100, 999)}-${intBetween(10, 99)}-${pickOne(['R', 'S', 'T', 'V'])}`;
}
function makeCode(prefix = 'C') {
  return `${prefix}-${intBetween(1000, 9999)}`;
}
function makeItemName() { return `${pickOne(ITEM_ADJ)} ${pickOne(ITEM_NOUNS)}`; }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function isoDt(d) { return d.toISOString(); }
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function daysFromNow(n) {
  return daysAgo(-n);
}
function recentDate(maxDaysBack = 180) {
  return daysAgo(intBetween(0, maxDaysBack));
}
function futureDate(maxDaysAhead = 365) {
  return daysFromNow(intBetween(1, maxDaysAhead));
}

// ─────────────────────────────────────────────────────────────────────
// 3. Load systemConfig + (optional) sdf.json + resolve slug names
// ─────────────────────────────────────────────────────────────────────

const systemConfig = require(path.join(BACKEND_DIR, 'src', 'systemConfig.js'));
const sdfPath = path.join(ROOT, 'sdf.json');
const sdf = fs.existsSync(sdfPath)
  ? JSON.parse(fs.readFileSync(sdfPath, 'utf8'))
  : null;

const sdfBySlug = new Map();
for (const e of (sdf && Array.isArray(sdf.entities) ? sdf.entities : [])) {
  if (e && e.slug) sdfBySlug.set(e.slug, e);
}

const ALL_SLUGS = (systemConfig.rbac && Array.isArray(systemConfig.rbac.entitySlugs))
  ? systemConfig.rbac.entitySlugs
  : Array.from(sdfBySlug.keys());

const inv = (systemConfig.modules && systemConfig.modules.inventory_priority_a) || {};
const invc = (systemConfig.modules && systemConfig.modules.invoice_priority_a) || {};
const hr = (systemConfig.modules && systemConfig.modules.hr_priority_a) || {};
const sr = (systemConfig.modules && systemConfig.modules.scheduled_reports) || {};

// Find first slug from ALL_SLUGS that contains a substring (case-insensitive)
function findSlug(...substrings) {
  const lowerAll = ALL_SLUGS.map((s) => [s, s.toLowerCase()]);
  for (const sub of substrings) {
    const needle = String(sub || '').toLowerCase();
    if (!needle) continue;
    const hit = lowerAll.find(([, lower]) => lower.includes(needle));
    if (hit) return hit[0];
  }
  return null;
}

const SLUGS = {
  stock: inv.stock_entity || findSlug('article', 'product', 'stock_item') || 'stock_articles',
  movement: (sr.movements && sr.movements.entity) || findSlug('movement', 'ledger_event', 'stock_event') || 'stock_movements',
  reservation: (inv.reservations && inv.reservations.reservation_entity) || findSlug('reservation', 'hold') || 'stock_reservations',
  po: (inv.inbound && inv.inbound.purchase_order_entity) || findSlug('procurement_order', 'purchase_order'),
  poItem: (inv.inbound && inv.inbound.purchase_order_item_entity) || findSlug('procurement_order_line', 'purchase_order_item'),
  grn: (inv.inbound && inv.inbound.grn_entity) || findSlug('arrival_docket', 'goods_receipt'),
  grnItem: (inv.inbound && inv.inbound.grn_item_entity) || findSlug('arrival_docket_line', 'goods_receipt_item'),
  cycleSession: (inv.cycle_counting && inv.cycle_counting.session_entity) || findSlug('audit_count_session', 'cycle_count_session'),
  cycleLine: (inv.cycle_counting && inv.cycle_counting.line_entity) || findSlug('audit_count_line', 'cycle_count_line'),
  invoice: invc.invoice_entity || findSlug('billing_docket', 'invoice'),
  invoiceItem: invc.invoice_item_entity || findSlug('billing_docket_line', 'invoice_item'),
  payment: (invc.payments && invc.payments.payment_entity) || findSlug('billing_settlement', 'invoice_payment'),
  allocation: (invc.payments && invc.payments.allocation_entity) || findSlug('settlement_split', 'payment_allocation'),
  note: (invc.notes && invc.notes.note_entity) || findSlug('billing_adjustment', 'invoice_note'),
  employee: hr.employee_entity || findSlug('workforce_member', 'staff_member', 'employee'),
  department: hr.department_entity || findSlug('business_unit', 'department'),
  leave: hr.leave_entity || findSlug('time_off_request', 'leave_request'),
  balance: (hr.leave_engine && hr.leave_engine.balance_entity) || findSlug('time_off_balance', 'leave_balance'),
  attendance: (hr.attendance_time && hr.attendance_time.attendance_entity) || findSlug('attendance_entry', 'attendance_log'),
  shift: (hr.attendance_time && hr.attendance_time.shift_entity) || findSlug('shift_plan', 'staff_shift'),
  timesheet: (hr.attendance_time && hr.attendance_time.timesheet_entity) || findSlug('timesheet_entry', 'timesheet_log'),
  ledger: (hr.compensation_ledger && hr.compensation_ledger.ledger_entity) || findSlug('compensation_ledger', 'payroll_ledger'),
  snapshot: (hr.compensation_ledger && hr.compensation_ledger.snapshot_entity) || findSlug('compensation_snapshot', 'payroll_snapshot'),
  // Master data slugs not covered by the priority_a configs:
  site: findSlug('stock_site', 'location', 'warehouse', 'site'),
  vendor: findSlug('vendor_partner', 'supplier'),
  client: findSlug('account_client', 'customer'),
  dispatch: findSlug('dispatch_order', 'sales_order'),
  dispatchLine: findSlug('dispatch_order_line', 'sales_order_line'),
};

// Auto-added stub tables (assembler emits these for invoice cross-pack
// toggles even when the user defined their own renamed equivalents).
const STUB_SALES_ORDERS = ALL_SLUGS.includes('sales_orders') && SLUGS.dispatch !== 'sales_orders';
const STUB_SALES_LINES = ALL_SLUGS.includes('sales_order_lines') && SLUGS.dispatchLine !== 'sales_order_lines';
const STUB_CUSTOMERS = ALL_SLUGS.includes('customers') && SLUGS.client !== 'customers';

// ─────────────────────────────────────────────────────────────────────
// 4. PG connect (mirrors backend/src/repository/db.js)
// ─────────────────────────────────────────────────────────────────────

function buildPgConfig() {
  const hasDiscrete =
    !!process.env.PGHOST ||
    !!process.env.PGUSER ||
    !!process.env.PGPASSWORD ||
    !!process.env.PGDATABASE ||
    !!process.env.PGPORT;
  if (hasDiscrete) {
    const port = Number(process.env.PGPORT || 5432);
    return {
      host: process.env.PGHOST || 'localhost',
      port: Number.isFinite(port) ? port : 5432,
      user: process.env.PGUSER || 'erpuser',
      password: process.env.PGPASSWORD || 'erppassword',
      database: process.env.PGDATABASE || 'erpdb',
    };
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return { host: 'localhost', port: 5432, user: 'erpuser', password: 'erppassword', database: 'erpdb' };
}

const pool = new Pool({ ...buildPgConfig(), max: 10, connectionTimeoutMillis: 5000 });

// ─────────────────────────────────────────────────────────────────────
// 5. Schema introspection + insert helpers
// ─────────────────────────────────────────────────────────────────────

const COLUMN_CACHE = new Map();
async function getColumns(slug) {
  if (COLUMN_CACHE.has(slug)) return COLUMN_CACHE.get(slug);
  const res = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [slug]
  );
  COLUMN_CACHE.set(slug, res.rows);
  return res.rows;
}

async function tableExists(slug) {
  const cols = await getColumns(slug);
  return cols.length > 0;
}

async function tableCount(slug) {
  try {
    const res = await pool.query(`SELECT COUNT(*)::int AS n FROM "${slug}"`);
    return res.rows[0].n;
  } catch {
    return 0;
  }
}

function coerce(val, col) {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const t = String(col.data_type || '').toLowerCase();
  if (t === 'json' || t === 'jsonb') return typeof val === 'string' ? val : JSON.stringify(val);
  if (t === 'boolean') return val === true || val === 'true' || val === 1 || val === '1';
  if (t === 'integer' || t === 'smallint' || t === 'bigint') return Math.trunc(Number(val));
  if (t === 'numeric' || t === 'double precision' || t === 'real') return Number(val);
  if (t === 'date') {
    if (val instanceof Date) return isoDate(val);
    return String(val).slice(0, 10);
  }
  if (t === 'timestamp with time zone' || t === 'timestamp without time zone') {
    if (val instanceof Date) return val.toISOString();
    return new Date(val).toISOString();
  }
  return String(val);
}

// Cache of inserted rows per slug so we can pick FK targets later.
const cache = {};
function pushCache(slug, row) {
  if (!cache[slug]) cache[slug] = [];
  cache[slug].push(row);
}
function pickFromCache(slug) {
  const rows = cache[slug];
  if (!rows || rows.length === 0) return null;
  return rows[Math.floor(rng() * rows.length)];
}

async function insertRow(slug, data) {
  const cols = await getColumns(slug);
  if (cols.length === 0) throw new Error(`Table '${slug}' does not exist`);
  const colMap = new Map(cols.map((c) => [c.column_name, c]));

  const id = data.id || uuid();
  const now = new Date().toISOString();
  const payload = {
    ...data,
    id,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  };

  const fields = [];
  const placeholders = [];
  const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (!colMap.has(k)) continue; // silently drop unknown columns (customisation safety)
    const prepared = coerce(v, colMap.get(k));
    if (prepared === undefined) continue;
    fields.push(`"${k}"`);
    values.push(prepared);
    placeholders.push(`$${values.length}`);
  }
  if (fields.length === 0) throw new Error(`No matching columns to insert into ${slug}`);

  if (args.dryRun) {
    return { id, ...payload };
  }

  const sql = `INSERT INTO "${slug}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const res = await pool.query(sql, values);
  return res.rows[0];
}

// Update helper for the self-reference second pass.
async function updateRow(slug, id, patch) {
  const cols = await getColumns(slug);
  const colMap = new Map(cols.map((c) => [c.column_name, c]));
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!colMap.has(k)) continue;
    fields.push(`"${k}" = $${values.length + 1}`);
    values.push(coerce(v, colMap.get(k)));
  }
  if (fields.length === 0) return;
  if (colMap.has('updated_at')) {
    fields.push(`"updated_at" = $${values.length + 1}`);
    values.push(new Date().toISOString());
  }
  if (args.dryRun) return;
  values.push(id);
  await pool.query(`UPDATE "${slug}" SET ${fields.join(', ')} WHERE "id" = $${values.length}`, values);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Generic introspect-and-fill (for unrecognized tables)
// ─────────────────────────────────────────────────────────────────────

function findReferenceTarget(slug, fieldName) {
  const sdfEntity = sdfBySlug.get(slug);
  if (sdfEntity && Array.isArray(sdfEntity.fields)) {
    const f = sdfEntity.fields.find((x) => x && x.name === fieldName);
    if (f && (f.reference_entity || f.referenceEntity)) {
      return f.reference_entity || f.referenceEntity;
    }
  }
  if (!fieldName) return null;
  const base = fieldName.replace(/_ids?$/i, '');
  const candidates = [base, `${base}s`, `${base}es`];
  for (const c of candidates) if (ALL_SLUGS.includes(c)) return c;
  return null;
}

function genericValueForColumn(slug, col) {
  const name = col.column_name;
  const t = String(col.data_type || '').toLowerCase();
  const sdfEntity = sdfBySlug.get(slug);
  const sdfField = sdfEntity && Array.isArray(sdfEntity.fields)
    ? sdfEntity.fields.find((f) => f && f.name === name)
    : null;

  if (sdfField && Array.isArray(sdfField.options) && sdfField.options.length) {
    return pickOne(sdfField.options);
  }
  if (sdfField && sdfField.computed === true) {
    return undefined; // skip computed fields
  }

  // FK-by-name
  if (/_id$/i.test(name) && t === 'text') {
    const target = findReferenceTarget(slug, name);
    if (target && cache[target] && cache[target].length) {
      return pickFromCache(target).id;
    }
    return null; // optional FK left null
  }

  // Heuristics
  if (name === 'name') return makeCompanyName();
  if (name === 'first_name') return makeFirstName();
  if (name === 'last_name') return makeLastName();
  if (name === 'email') return makeEmail();
  if (name === 'phone') return makePhone();
  if (name === 'address' || name === 'billing_address' || name === 'shipping_address') return makeAddress();
  if (name === 'sku') return makeSku();
  if (name === 'code') return makeCode();
  if (name === 'tax_identifier') return `TAX-${intBetween(100000, 999999)}`;
  if (name === 'description' || name === 'notes' || name === 'note' || name === 'reason' || name === 'message')
    return pickOne(['Auto-generated by seeder.', 'Demo data.', 'Sample record.', '']);
  if (name === 'status') return pickOne(['Active', 'Pending', 'Done']);
  if (name === 'is_active') return rng() > 0.1;

  if (t === 'boolean') return rng() > 0.5;
  if (t === 'integer' || t === 'smallint' || t === 'bigint') return intBetween(1, 100);
  if (t === 'numeric' || t === 'double precision' || t === 'real') return floatBetween(1, 1000);
  if (t === 'date') return isoDate(recentDate());
  if (t === 'timestamp with time zone' || t === 'timestamp without time zone') return isoDt(recentDate());
  return `demo-${intBetween(1000, 9999)}`;
}

async function seedGeneric(slug, count, label) {
  if (!allowed(slug)) return;
  if (!(await tableExists(slug))) return;
  if (!args.reset && (await tableCount(slug)) > 0) {
    log(`~ ${slug}: skipped (already populated)`, 'dim');
    return;
  }
  const cols = await getColumns(slug);
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const data = {};
    for (const c of cols) {
      if (['id', 'created_at', 'updated_at'].includes(c.column_name)) continue;
      const v = genericValueForColumn(slug, c);
      if (v !== undefined) data[c.column_name] = v;
    }
    try {
      const row = await insertRow(slug, data);
      pushCache(slug, row);
      n += 1;
    } catch (e) {
      // skip rows that fail unique/required constraints
      if (/duplicate key|null value|violates/i.test(e.message)) continue;
      throw e;
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  log(`✓ ${slug}: ${n} rows in ${dt}s${label ? ` (${label})` : ''}`);
}

// ─────────────────────────────────────────────────────────────────────
// 7. Reset (truncate non-system tables)
// ─────────────────────────────────────────────────────────────────────

const PROTECTED_TABLES = new Set([
  '__migrations',
  '__erp_users',
  '__erp_groups',
  '__erp_permissions',
  '__erp_user_groups',
  '__erp_group_permissions',
  '__erp_dashboard_preferences',
]);

async function reset() {
  const res = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const tables = res.rows.map((r) => r.table_name).filter((t) => !PROTECTED_TABLES.has(t));
  if (tables.length === 0) return;
  if (args.dryRun) {
    log(`(dry-run) would TRUNCATE ${tables.length} tables`, 'dim');
    return;
  }
  const list = tables.map((t) => `"${t}"`).join(', ');
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  log(`[reset] truncated ${tables.length} business tables (system tables preserved)`, 'dim');
}

// ─────────────────────────────────────────────────────────────────────
// 8. Logging
// ─────────────────────────────────────────────────────────────────────

const COLOR = { reset: '\x1b[0m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m' };
function log(msg, color = 'green') {
  if (!process.stdout.isTTY) return console.log(msg);
  console.log(`${COLOR[color] || ''}${msg}${COLOR.reset}`);
}
function header(msg) {
  if (!process.stdout.isTTY) return console.log(`\n=== ${msg} ===`);
  console.log(`\n${COLOR.cyan}=== ${msg} ===${COLOR.reset}`);
}

// ─────────────────────────────────────────────────────────────────────
// 9. Per-entity playbooks
// ─────────────────────────────────────────────────────────────────────

async function shouldSeedTable(slug) {
  if (!slug) return false;
  if (!allowed(slug)) return false;
  if (!(await tableExists(slug))) return false;
  if (!args.reset && (await tableCount(slug)) > 0) {
    // populate cache so downstream entities can still pick FKs
    const res = await pool.query(`SELECT * FROM "${slug}" LIMIT 200`);
    cache[slug] = res.rows;
    log(`~ ${slug}: skipped (already has ${(await tableCount(slug))} rows)`, 'dim');
    return false;
  }
  return true;
}

async function seedSites() {
  const slug = SLUGS.site;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  for (let i = 0; i < V.sites; i++) {
    const row = await insertRow(slug, {
      name: `${SITE_NAMES[i % SITE_NAMES.length]}${i >= SITE_NAMES.length ? ` #${i + 1}` : ''}`,
      code: `S${String(i + 1).padStart(3, '0')}`,
      site_type: pickOne(SITE_TYPES),
      location_type: pickOne(SITE_TYPES), // alt name
      type: pickOne(SITE_TYPES), // alt name
      address: makeAddress(),
      is_active: i === 0 ? true : rng() > 0.1,
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${V.sites} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedVendors() {
  const slug = SLUGS.vendor;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  for (let i = 0; i < V.vendors; i++) {
    const name = makeCompanyName();
    const row = await insertRow(slug, {
      name,
      code: `V${String(i + 1).padStart(3, '0')}`,
      email: makeEmail(name),
      phone: makePhone(),
      address: makeAddress(),
      contact_person: makeFullName(),
      status: pickOneWeighted([['Active', 70], ['Paused', 20], ['Blocked', 10]]),
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${V.vendors} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedClients(slug) {
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  const isStub = slug === 'customers' && STUB_CUSTOMERS;
  const count = isStub ? Math.min(V.clients, 10) : V.clients;
  for (let i = 0; i < count; i++) {
    const name = makeCompanyName();
    const row = await insertRow(slug, {
      name,
      code: `C${String(i + 1).padStart(4, '0')}`,
      email: makeEmail(name),
      phone: makePhone(),
      billing_address: makeAddress(),
      shipping_address: makeAddress(),
      tax_identifier: `TAX-${intBetween(100000, 999999)}`,
      payment_terms: pickOne(PAYMENT_TERMS),
      credit_limit: floatBetween(5000, 100000, 0),
      current_balance: 0,
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${count} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s${isStub ? ' (stub)' : ''}`);
}

async function seedDepartments() {
  const slug = SLUGS.department;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  const names = ['Operations', 'Finance', 'Sales', 'Engineering', 'HR', 'Logistics', 'Procurement', 'Quality'];
  for (let i = 0; i < V.units; i++) {
    const row = await insertRow(slug, {
      name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
      code: `D${String(i + 1).padStart(2, '0')}`,
      manager_id: null, // filled in pass 2
      location: pickOne(CITIES),
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${V.units} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedEmployees() {
  const slug = SLUGS.employee;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  const titles = ['Manager', 'Senior Specialist', 'Specialist', 'Coordinator', 'Analyst', 'Officer', 'Lead', 'Supervisor', 'Clerk'];
  for (let i = 0; i < V.staff; i++) {
    const first = makeFirstName();
    const last = makeLastName();
    const dep = pickFromCache(SLUGS.department);
    const row = await insertRow(slug, {
      first_name: first,
      last_name: last,
      email: `${first}.${last}.${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@demo.test',
      phone: makePhone(),
      department_id: dep ? dep.id : null,
      job_title: pickOne(titles),
      hire_date: isoDate(daysAgo(intBetween(30, 1500))),
      status: pickOneWeighted([['Active', 80], ['On Leave', 12], ['Terminated', 8]]),
      base_salary: floatBetween(20000, 120000, 0),
      manager_id: null, // pass 2
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${V.staff} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function fixSelfRefs() {
  // Departments → manager_id
  if (SLUGS.department && cache[SLUGS.department] && cache[SLUGS.employee]) {
    const cols = await getColumns(SLUGS.department);
    if (cols.find((c) => c.column_name === 'manager_id')) {
      for (const dep of cache[SLUGS.department]) {
        const emp = pickFromCache(SLUGS.employee);
        if (emp) await updateRow(SLUGS.department, dep.id, { manager_id: emp.id });
      }
    }
  }
  // Employees → manager_id (self-ref)
  if (SLUGS.employee && cache[SLUGS.employee]) {
    const cols = await getColumns(SLUGS.employee);
    if (cols.find((c) => c.column_name === 'manager_id')) {
      const employees = cache[SLUGS.employee];
      const managers = employees.slice(0, Math.max(1, Math.floor(employees.length / 5)));
      for (const e of employees) {
        if (rng() < 0.7 && managers.length > 0) {
          const mgr = managers[Math.floor(rng() * managers.length)];
          if (mgr.id !== e.id) await updateRow(SLUGS.employee, e.id, { manager_id: mgr.id });
        }
      }
    }
  }
}

async function seedDemoUsers() {
  const slug = '__erp_users';
  if (!allowed(slug)) return;
  if (!(await tableExists(slug))) return;
  // RBAC seed runs at backend boot — only top up with extra demo accounts if missing.
  const existing = await pool.query(`SELECT username FROM "${slug}"`);
  const have = new Set(existing.rows.map((r) => r.username));
  const password_hash = bcrypt.hashSync('demo', 10);
  const accounts = [
    { username: 'ops.demo', display_name: 'Demo Operations Manager' },
    { username: 'billing.demo', display_name: 'Demo Billing Clerk' },
    { username: 'hr.demo', display_name: 'Demo HR Manager' },
    { username: 'auditor.demo', display_name: 'Demo Read-Only Auditor' },
    { username: 'employee.demo', display_name: 'Demo Employee Login' },
  ];
  let added = 0;
  for (const acc of accounts) {
    if (have.has(acc.username)) continue;
    const row = await insertRow(slug, {
      username: acc.username,
      email: `${acc.username}@demo.test`,
      display_name: acc.display_name,
      password_hash,
      is_active: true,
    });
    pushCache(slug, row);
    added += 1;
  }
  // Always populate cache so downstream slugs can pick from it.
  if (!cache[slug] || cache[slug].length === 0) {
    const all = await pool.query(`SELECT * FROM "${slug}"`);
    cache[slug] = all.rows;
  }
  log(`✓ ${slug}: +${added} demo users (password = "demo"); total ${cache[slug].length}`);

  // Link the demo employee account to a workforce_member if the link column exists.
  const empSlug = SLUGS.employee;
  if (empSlug && cache[empSlug] && cache[empSlug].length) {
    const empCols = await getColumns(empSlug);
    if (empCols.find((c) => c.column_name === 'user_id')) {
      const linkUser = cache[slug].find((u) => u.username === 'employee.demo');
      const linkEmp = cache[empSlug][0];
      if (linkUser && linkEmp) {
        await updateRow(empSlug, linkEmp.id, { user_id: linkUser.id });
      }
    }
  }
}

async function seedStockArticles() {
  const slug = SLUGS.stock;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  for (let i = 0; i < V.articles; i++) {
    const onHand = intBetween(0, 500);
    const reserved = onHand > 0 ? intBetween(0, Math.min(50, Math.floor(onHand / 4))) : 0;
    const committed = onHand > 0 ? intBetween(0, Math.min(20, Math.floor(onHand / 8))) : 0;
    const available = Math.max(0, onHand - reserved - committed);
    const reorderPoint = intBetween(10, 80);
    const unitCost = floatBetween(2, 250);
    const salePrice = Number((unitCost * floatBetween(1.2, 2.4)).toFixed(2));
    const expiryDays = i % 4 === 0 ? null : intBetween(-15, 365); // mix expired/near/future
    const expiryDate = expiryDays === null ? null : isoDate(daysFromNow(expiryDays));
    const site = pickFromCache(SLUGS.site);
    const row = await insertRow(slug, {
      sku: makeSku(),
      name: `${makeItemName()} ${i + 1}`,
      description: 'Generated by mock-data seeder.',
      category: pickOne(ITEM_CATEGORIES),
      quantity: onHand,
      reserved_quantity: reserved,
      committed_quantity: committed,
      available_quantity: available,
      reorder_point: reorderPoint,
      unit_cost: unitCost,
      sale_price: salePrice,
      location_id: site ? site.id : null,
      batch_number: `B${intBetween(10000, 99999)}`,
      serial_number: `SN-${intBetween(1000000, 9999999)}`,
      expiry_date: expiryDate,
      is_active: true,
    });
    pushCache(slug, row);
  }
  log(`✓ ${slug}: ${V.articles} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedMovements() {
  const slug = SLUGS.movement;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  for (const article of cache[SLUGS.stock] || []) {
    const onHand = Number(article.quantity) || 0;
    if (onHand <= 0) continue;
    // Build a sequence of movements (IN events) whose net equals on-hand.
    const events = intBetween(1, 4);
    let remaining = onHand;
    for (let i = 0; i < events; i++) {
      const last = i === events - 1;
      const qty = last ? remaining : intBetween(1, Math.max(1, remaining - (events - i - 1)));
      remaining -= qty;
      const site = pickFromCache(SLUGS.site);
      const handler = pickFromCache(SLUGS.employee);
      const row = await insertRow(slug, {
        item_id: article.id,
        movement_type: 'IN',
        quantity: qty,
        movement_date: isoDt(daysAgo(intBetween(0, 90))),
        reference_number: `MV-${intBetween(100000, 999999)}`,
        reason: 'Initial stock receipt',
        location_id: site ? site.id : null,
        from_location_id: null,
        to_location_id: site ? site.id : null,
        handled_by_id: handler ? handler.id : null,
      });
      pushCache(slug, row);
      n += 1;
    }
    // Sprinkle a few outflows that keep net ≥ 0
    if (rng() < 0.6 && onHand > 5) {
      const outQty = Math.min(intBetween(1, 5), onHand);
      const site = pickFromCache(SLUGS.site);
      const row = await insertRow(slug, {
        item_id: article.id,
        movement_type: 'OUT',
        quantity: -outQty,
        movement_date: isoDt(daysAgo(intBetween(0, 30))),
        reference_number: `MV-${intBetween(100000, 999999)}`,
        reason: 'Issue to dispatch',
        location_id: site ? site.id : null,
        handled_by_id: (pickFromCache(SLUGS.employee) || {}).id,
      });
      pushCache(slug, row);
      n += 1;
    }
    if (rng() < 0.2) {
      const adjQty = (rng() > 0.5 ? 1 : -1) * intBetween(1, 3);
      const row = await insertRow(slug, {
        item_id: article.id,
        movement_type: 'ADJUSTMENT',
        quantity: adjQty,
        movement_date: isoDt(daysAgo(intBetween(0, 60))),
        reference_number: `MV-${intBetween(100000, 999999)}`,
        reason: pickOne(ADJUST_REASONS),
        location_id: (pickFromCache(SLUGS.site) || {}).id,
      });
      pushCache(slug, row);
      n += 1;
    }
  }
  log(`✓ ${slug}: ${n} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedHolds() {
  const slug = SLUGS.reservation;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < V.holds; i++) {
    const article = pickFromCache(SLUGS.stock);
    if (!article) break;
    const status = pickOneWeighted([['Pending', 40], ['Released', 25], ['Committed', 25], ['Cancelled', 10]]);
    const reservedAt = isoDt(daysAgo(intBetween(0, 30)));
    const row = await insertRow(slug, {
      reservation_number: `RES-${intBetween(10000, 99999)}-${i}`,
      item_id: article.id,
      quantity: intBetween(1, 20),
      status,
      source_reference: `SRC-${intBetween(1000, 9999)}`,
      note: 'Auto-seeded reservation.',
      reserved_at: reservedAt,
      released_at: status === 'Released' ? isoDt(daysAgo(intBetween(0, 5))) : null,
      committed_at: status === 'Committed' ? isoDt(daysAgo(intBetween(0, 3))) : null,
      reserved_quantity: status === 'Pending' ? intBetween(1, 20) : 0,
      committed_quantity: status === 'Committed' ? intBetween(1, 20) : 0,
      available_quantity: intBetween(1, 20),
    });
    pushCache(slug, row);
    n += 1;
  }
  log(`✓ ${slug}: ${n} rows in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedProcurement() {
  const orderSlug = SLUGS.po;
  const lineSlug = SLUGS.poItem;
  if (!orderSlug) return;
  if (!(await shouldSeedTable(orderSlug))) return;
  const t0 = Date.now();
  let nOrders = 0;
  let nLines = 0;
  const totalOrders = Math.min(V.invoices, 20);
  for (let i = 0; i < totalOrders; i++) {
    const vendor = pickFromCache(SLUGS.vendor);
    if (!vendor) break;
    const status = pickOneWeighted([['Draft', 15], ['Sent', 25], ['Partially Received', 20], ['Received', 30], ['Cancelled', 10]]);
    const orderDate = isoDate(daysAgo(intBetween(5, 90)));
    const order = await insertRow(orderSlug, {
      po_number: `PO-${10000 + i}`,
      supplier_id: vendor.id,
      order_date: orderDate,
      expected_date: isoDate(daysAgo(intBetween(-30, 30))),
      status,
      total_amount: 0,
      notes: 'Auto-generated procurement order.',
    });
    pushCache(orderSlug, order);
    nOrders += 1;

    if (lineSlug && (await tableExists(lineSlug))) {
      let total = 0;
      const lineCount = intBetween(1, 5);
      for (let j = 0; j < lineCount; j++) {
        const article = pickFromCache(SLUGS.stock);
        if (!article) continue;
        const ordered = intBetween(5, 100);
        const received = status === 'Received' ? ordered :
                         status === 'Partially Received' ? intBetween(0, ordered) :
                         status === 'Cancelled' ? 0 : 0;
        const unitPrice = Number(article.unit_cost) || floatBetween(5, 100);
        const lineTotal = Number((ordered * unitPrice).toFixed(2));
        total += lineTotal;
        const line = await insertRow(lineSlug, {
          purchase_order_id: order.id,
          item_id: article.id,
          ordered_quantity: ordered,
          received_quantity: received,
          unit_price: unitPrice,
          line_total: lineTotal,
          status: received >= ordered ? 'Received' : received > 0 ? 'Partially Received' : 'Open',
        });
        pushCache(lineSlug, line);
        nLines += 1;
      }
      await updateRow(orderSlug, order.id, { total_amount: Number(total.toFixed(2)) });
    }
  }
  log(`✓ ${orderSlug}: ${nOrders} orders, ${nLines} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedArrivals() {
  const grnSlug = SLUGS.grn;
  const grnItemSlug = SLUGS.grnItem;
  if (!grnSlug) return;
  if (!(await shouldSeedTable(grnSlug))) return;
  const t0 = Date.now();
  let nDockets = 0;
  let nLines = 0;
  for (const order of (cache[SLUGS.po] || []).slice(0, 12)) {
    if (order.status === 'Draft' || order.status === 'Cancelled') continue;
    const isPosted = order.status === 'Received' || rng() > 0.5;
    const status = isPosted ? 'Posted' : pickOneWeighted([['Draft', 30], ['Inspecting', 50], ['Cancelled', 20]]);
    const receiver = pickFromCache(SLUGS.employee);
    const docket = await insertRow(grnSlug, {
      grn_number: `GRN-${20000 + nDockets}`,
      purchase_order_id: order.id,
      receipt_date: isoDate(daysAgo(intBetween(0, 60))),
      status,
      received_by_id: receiver ? receiver.id : null,
      posted_at: isPosted ? isoDt(daysAgo(intBetween(0, 30))) : null,
      notes: 'Auto-generated arrival docket.',
    });
    pushCache(grnSlug, docket);
    nDockets += 1;
    if (grnItemSlug && (await tableExists(grnItemSlug))) {
      const linesForOrder = (cache[SLUGS.poItem] || []).filter((l) => l.purchase_order_id === order.id);
      for (const poLine of linesForOrder) {
        const received = Number(poLine.received_quantity) || intBetween(1, Number(poLine.ordered_quantity) || 10);
        const accepted = Math.max(0, received - intBetween(0, 2));
        const rejected = received - accepted;
        const line = await insertRow(grnItemSlug, {
          goods_receipt_id: docket.id,
          purchase_order_item_id: poLine.id,
          item_id: poLine.item_id,
          received_quantity: received,
          accepted_quantity: accepted,
          rejected_quantity: rejected,
          rejection_reason: rejected > 0 ? pickOne(['Damaged in transit', 'Wrong specification', 'Quality fail']) : null,
        });
        pushCache(grnItemSlug, line);
        nLines += 1;
      }
    }
  }
  log(`✓ ${grnSlug}: ${nDockets} dockets, ${nLines} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedDispatch() {
  const slug = SLUGS.dispatch;
  const lineSlug = SLUGS.dispatchLine;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let nOrders = 0;
  let nLines = 0;
  for (let i = 0; i < V.dispatch; i++) {
    const client = pickFromCache(SLUGS.client);
    if (!client) break;
    const status = pickOneWeighted([['Draft', 10], ['Confirmed', 25], ['Allocated', 15], ['Fulfilled', 40], ['Cancelled', 10]]);
    const order = await insertRow(slug, {
      order_number: `SO-${30000 + i}`,
      customer_id: client.id,
      customer: client.id, // legacy stub field
      order_date: isoDate(daysAgo(intBetween(0, 60))),
      status,
      total_amount: 0,
      notes: 'Auto-generated dispatch order.',
    });
    pushCache(slug, order);
    nOrders += 1;
    if (lineSlug && (await tableExists(lineSlug))) {
      let total = 0;
      const lineCount = intBetween(1, 4);
      for (let j = 0; j < lineCount; j++) {
        const article = pickFromCache(SLUGS.stock);
        if (!article) continue;
        const qty = intBetween(1, 25);
        const price = Number(article.sale_price) || floatBetween(10, 200);
        const lineTotal = Number((qty * price).toFixed(2));
        total += lineTotal;
        const line = await insertRow(lineSlug, {
          sales_order_id: order.id,
          sales_order: order.id, // legacy stub
          product_id: article.id,
          product: article.id, // legacy stub
          quantity: qty,
          ordered_qty: qty,
          shipped_qty: status === 'Fulfilled' ? qty : 0,
          unit_price: price,
          line_total: lineTotal,
        });
        pushCache(lineSlug, line);
        nLines += 1;
      }
      await updateRow(slug, order.id, { total_amount: Number(total.toFixed(2)) });
    }
  }
  log(`✓ ${slug}: ${nOrders} orders, ${nLines} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedSalesStub() {
  if (!STUB_SALES_ORDERS) return;
  if (!(await shouldSeedTable('sales_orders'))) return;
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < Math.min(V.dispatch, 8); i++) {
    const client = pickFromCache(STUB_CUSTOMERS ? 'customers' : SLUGS.client);
    if (!client) break;
    const order = await insertRow('sales_orders', {
      order_number: `STUB-SO-${i}`,
      customer: client.id,
      order_date: isoDate(daysAgo(intBetween(0, 60))),
      status: pickOne(['Draft', 'Confirmed', 'Fulfilled']),
      notes: 'Auto-generated stub.',
      total_amount: floatBetween(100, 5000, 0),
    });
    pushCache('sales_orders', order);
    n += 1;
    if (STUB_SALES_LINES && (await tableExists('sales_order_lines'))) {
      const lineCount = intBetween(1, 3);
      for (let j = 0; j < lineCount; j++) {
        const article = pickFromCache(SLUGS.stock);
        if (!article) continue;
        const qty = intBetween(1, 10);
        const price = floatBetween(10, 100);
        await insertRow('sales_order_lines', {
          sales_order: order.id,
          product: article.id,
          ordered_qty: qty,
          shipped_qty: qty,
          unit_price: price,
          line_total: Number((qty * price).toFixed(2)),
        });
      }
    }
  }
  log(`✓ sales_orders: ${n} stub orders in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedCycleCounts() {
  const sessionSlug = SLUGS.cycleSession;
  const lineSlug = SLUGS.cycleLine;
  if (!sessionSlug) return;
  if (!(await shouldSeedTable(sessionSlug))) return;
  const t0 = Date.now();
  let nSess = 0;
  let nLines = 0;
  for (let i = 0; i < V.cycle_sessions; i++) {
    const status = pickOneWeighted([['Posted', 50], ['Approved', 20], ['Pending Approval', 15], ['In Progress', 10], ['Cancelled', 5]]);
    const counter = pickFromCache(SLUGS.employee);
    const approver = pickFromCache(SLUGS.employee);
    const session = await insertRow(sessionSlug, {
      session_number: `CC-${40000 + i}`,
      count_date: isoDate(daysAgo(intBetween(0, 60))),
      location_id: (pickFromCache(SLUGS.site) || {}).id,
      status,
      counted_by_id: counter ? counter.id : null,
      approved_by_id: status === 'Approved' || status === 'Posted' ? (approver ? approver.id : null) : null,
      notes: 'Auto-generated cycle count session.',
    });
    pushCache(sessionSlug, session);
    nSess += 1;
    if (lineSlug && (await tableExists(lineSlug))) {
      const articles = (cache[SLUGS.stock] || []).slice().sort(() => rng() - 0.5).slice(0, intBetween(5, 12));
      for (const a of articles) {
        const expected = Number(a.quantity) || 0;
        const variance = rng() < 0.3 ? intBetween(-3, 3) : 0;
        const counted = Math.max(0, expected + variance);
        await insertRow(lineSlug, {
          cycle_count_session_id: session.id,
          item_id: a.id,
          expected_quantity: expected,
          counted_quantity: counted,
          variance_quantity: counted - expected,
          variance_reason: variance !== 0 ? pickOne(['Miscount', 'Damaged', 'Restocked', 'Lost']) : null,
          status: 'Counted',
        });
        nLines += 1;
      }
    }
  }
  log(`✓ ${sessionSlug}: ${nSess} sessions, ${nLines} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedBilling() {
  const slug = SLUGS.invoice;
  const lineSlug = SLUGS.invoiceItem;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let nInv = 0;
  let nLines = 0;
  for (let i = 0; i < V.invoices; i++) {
    const client = pickFromCache(SLUGS.client);
    if (!client) break;
    const status = pickOneWeighted([['Draft', 15], ['Sent', 25], ['Paid', 35], ['Overdue', 15], ['Cancelled', 10]]);
    const issueDate = daysAgo(intBetween(0, 90));
    const dueDate = new Date(issueDate); dueDate.setUTCDate(dueDate.getUTCDate() + 30);

    // Build lines first to compute totals
    const lineCount = intBetween(1, 5);
    const lines = [];
    let subtotal = 0;
    let discountTotal = 0;
    let chargeTotal = 0;
    let taxTotal = 0;
    for (let j = 0; j < lineCount; j++) {
      const qty = intBetween(1, 20);
      const unitPrice = floatBetween(10, 500);
      const subtotalLine = Number((qty * unitPrice).toFixed(2));
      const discountType = rng() < 0.3 ? pickOne(['percentage', 'fixed']) : null;
      const discountValue = discountType ? floatBetween(0, discountType === 'percentage' ? 15 : 50) : 0;
      const discountTotal_ = discountType === 'percentage'
        ? Number((subtotalLine * discountValue / 100).toFixed(2))
        : discountType === 'fixed' ? Number(discountValue.toFixed(2)) : 0;
      const taxRate = pickOne([0, 8, 10, 12, 18, 20]);
      const taxableBase = Math.max(0, subtotalLine - discountTotal_);
      const taxTotal_ = Number((taxableBase * taxRate / 100).toFixed(2));
      const charge = rng() < 0.2 ? floatBetween(0, 25) : 0;
      const lineTotal = Number((taxableBase + taxTotal_ + charge).toFixed(2));
      subtotal += subtotalLine;
      discountTotal += discountTotal_;
      chargeTotal += charge;
      taxTotal += taxTotal_;
      lines.push({
        description: makeItemName(),
        quantity: qty,
        unit_price: unitPrice,
        line_subtotal: subtotalLine,
        line_discount_type: discountType,
        line_discount_value: discountValue,
        line_discount_total: discountTotal_,
        line_tax_rate: taxRate,
        line_tax_total: taxTotal_,
        line_additional_charge: charge,
        line_total: lineTotal,
      });
    }
    const grand = Number((subtotal - discountTotal + chargeTotal + taxTotal).toFixed(2));
    const paid = status === 'Paid' ? grand : status === 'Overdue' ? Number((grand * floatBetween(0, 0.6)).toFixed(2)) : 0;
    const outstanding = Number((grand - paid).toFixed(2));

    const inv = await insertRow(slug, {
      invoice_number: `INV-${5000 + i}`,
      customer_id: client.id,
      issue_date: isoDate(issueDate),
      due_date: isoDate(dueDate),
      status,
      subtotal: Number(subtotal.toFixed(2)),
      discount_total: Number(discountTotal.toFixed(2)),
      additional_charges_total: Number(chargeTotal.toFixed(2)),
      tax_total: Number(taxTotal.toFixed(2)),
      grand_total: grand,
      paid_total: paid,
      outstanding_balance: outstanding,
      idempotency_key: `IDEMP-${uuid()}`,
      posted_at: status === 'Draft' ? null : isoDt(issueDate),
      cancelled_at: status === 'Cancelled' ? isoDt(daysAgo(intBetween(0, 30))) : null,
      currency: 'USD',
      terms_and_conditions: 'Standard demo terms.',
      internal_notes: '',
    });
    pushCache(slug, inv);
    nInv += 1;
    if (lineSlug && (await tableExists(lineSlug))) {
      for (const l of lines) {
        const row = await insertRow(lineSlug, { invoice_id: inv.id, ...l });
        pushCache(lineSlug, row);
        nLines += 1;
      }
    }
  }
  log(`✓ ${slug}: ${nInv} invoices, ${nLines} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedSettlements() {
  const slug = SLUGS.payment;
  const allocSlug = SLUGS.allocation;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let nP = 0;
  let nA = 0;
  const paidInvoices = (cache[SLUGS.invoice] || []).filter((i) => Number(i.paid_total) > 0);
  for (let i = 0; i < paidInvoices.length; i++) {
    const invRow = paidInvoices[i];
    const amount = Number(invRow.paid_total);
    const status = invRow.status === 'Paid' ? 'Posted' : pickOne(['Posted', 'Draft']);
    const settle = await insertRow(slug, {
      payment_number: `PMT-${6000 + i}`,
      customer_id: invRow.customer_id,
      payment_date: invRow.issue_date,
      amount,
      payment_method: pickOne(PAY_METHODS),
      reference: `RCP-${intBetween(10000, 99999)}`,
      reference_number: `RCP-${intBetween(10000, 99999)}`,
      allocated_amount: amount,
      unallocated_amount: 0,
      status,
      posted_at: status === 'Posted' ? isoDt(daysAgo(intBetween(0, 60))) : null,
      notes: 'Auto-generated settlement.',
      note: 'Auto-generated settlement.',
    });
    pushCache(slug, settle);
    nP += 1;
    if (allocSlug && (await tableExists(allocSlug))) {
      await insertRow(allocSlug, {
        payment_id: settle.id,
        invoice_id: invRow.id,
        allocated_amount: amount,
        allocation_date: invRow.issue_date,
      });
      nA += 1;
    }
  }
  log(`✓ ${slug}: ${nP} settlements, ${nA} splits in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedAdjustments() {
  const slug = SLUGS.note;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < V.adjustments; i++) {
    const invRow = pickFromCache(SLUGS.invoice);
    if (!invRow) break;
    const noteType = pickOne(['Credit', 'Debit']);
    await insertRow(slug, {
      note_number: `${noteType === 'Credit' ? 'CN' : 'DN'}-${7000 + i}`,
      source_invoice_id: invRow.id,
      note_type: noteType,
      amount: floatBetween(10, 500),
      status: pickOne(['Draft', 'Posted', 'Cancelled']),
      reason: pickOne(['Pricing adjustment', 'Goods returned', 'Service correction', 'Discount applied']),
    });
    n += 1;
  }
  log(`✓ ${slug}: ${n} adjustments in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedTimeOffBalances() {
  const slug = SLUGS.balance;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const year = new Date().getUTCFullYear();
  for (const emp of cache[SLUGS.employee] || []) {
    for (const lt of LEAVE_TYPES) {
      const entitlement = lt === 'Annual' ? 18 : lt === 'Sick' ? 10 : 5;
      const consumed = intBetween(0, Math.floor(entitlement / 2));
      const accrued = entitlement;
      const remaining = accrued - consumed;
      await insertRow(slug, {
        employee_id: emp.id,
        leave_type: lt,
        year,
        annual_entitlement: entitlement,
        accrued_days: accrued,
        consumed_days: consumed,
        carry_forward_days: 0,
        remaining_days: remaining,
      });
      n += 1;
    }
  }
  log(`✓ ${slug}: ${n} balances in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedTimeOff() {
  const slug = SLUGS.leave;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const employees = cache[SLUGS.employee] || [];
  const usersByCache = cache['__erp_users'] || [];
  for (let i = 0; i < Math.min(employees.length * 2, employees.length + 15); i++) {
    const emp = employees[i % employees.length];
    if (!emp) break;
    const days = intBetween(1, 7);
    const startDate = daysFromNow(intBetween(-90, 60));
    const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate() + days - 1);
    const status = pickOneWeighted([['Pending', 20], ['Approved', 50], ['Rejected', 15], ['Cancelled', 15]]);
    const approver = status === 'Approved' || status === 'Rejected'
      ? (usersByCache.length ? usersByCache[i % usersByCache.length] : null)
      : null;
    await insertRow(slug, {
      employee_id: emp.id,
      leave_type: pickOne(LEAVE_TYPES),
      start_date: isoDate(startDate),
      end_date: isoDate(endDate),
      requested_days: days,
      reason: pickOne(['Family event', 'Vacation', 'Medical appointment', 'Personal day', 'Conference']),
      approval_status: status,
      approved_by: approver ? approver.id : null,
      approved_at: status === 'Approved' ? isoDt(daysAgo(intBetween(0, 90))) : null,
      rejected_at: status === 'Rejected' ? isoDt(daysAgo(intBetween(0, 90))) : null,
      rejection_reason: status === 'Rejected' ? 'Conflict with project deadlines.' : null,
      decision_key: status === 'Pending' ? null : `DK-${uuid()}`,
    });
    n += 1;
  }
  log(`✓ ${slug}: ${n} requests in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedAttendance() {
  const slug = SLUGS.attendance;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const workDays = (hr.attendance_time && hr.attendance_time.work_days)
    || (sdf && sdf.modules && sdf.modules.hr && sdf.modules.hr.work_days)
    || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const workDaySet = new Set(workDays.map(String));
  const dailyHours = (hr.attendance_time && hr.attendance_time.daily_hours)
    || (sdf && sdf.modules && sdf.modules.hr && sdf.modules.hr.daily_hours)
    || 8;
  const dayKey = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  for (const emp of cache[SLUGS.employee] || []) {
    for (let i = 0; i < V.attendance_days; i++) {
      const d = daysAgo(i);
      if (!workDaySet.has(dayKey(d))) continue;
      const status = pickOneWeighted([['Present', 80], ['Absent', 5], ['Half Day', 5], ['On Leave', 10]]);
      const checkIn = new Date(d); checkIn.setUTCHours(9, intBetween(0, 30));
      const checkOut = new Date(checkIn); checkOut.setUTCHours(checkIn.getUTCHours() + dailyHours, intBetween(0, 30));
      const worked = status === 'Present' ? dailyHours
        : status === 'Half Day' ? Math.round(dailyHours / 2)
        : 0;
      await insertRow(slug, {
        employee_id: emp.id,
        work_date: isoDate(d),
        check_in_at: status === 'Absent' || status === 'On Leave' ? null : isoDt(checkIn),
        check_out_at: status === 'Absent' || status === 'On Leave' ? null : isoDt(checkOut),
        worked_hours: worked,
        status,
        note: status === 'On Leave' ? 'Approved leave' : null,
      });
      n += 1;
    }
  }
  log(`✓ ${slug}: ${n} entries in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedShifts() {
  const slug = SLUGS.shift;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  for (const emp of cache[SLUGS.employee] || []) {
    if (rng() > 0.6) continue; // not every employee gets shift rows
    const shifts = intBetween(2, 6);
    for (let i = 0; i < shifts; i++) {
      const start = daysAgo(intBetween(-7, 30));
      start.setUTCHours(intBetween(6, 14));
      const end = new Date(start); end.setUTCHours(start.getUTCHours() + intBetween(6, 10));
      await insertRow(slug, {
        employee_id: emp.id,
        shift_name: pickOne(SHIFT_NAMES),
        start_at: isoDt(start),
        end_at: isoDt(end),
        location: pickOne(CITIES),
        status: pickOneWeighted([['Scheduled', 30], ['Completed', 60], ['Cancelled', 10]]),
      });
      n += 1;
    }
  }
  log(`✓ ${slug}: ${n} shifts in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedTimesheets() {
  const slug = SLUGS.timesheet;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const sample = (cache[SLUGS.attendance] || []).slice(0, Math.min(500, (cache[SLUGS.attendance] || []).length));
  for (const att of sample) {
    if (att.status === 'Absent' || att.status === 'On Leave') continue;
    const reg = att.status === 'Half Day' ? 4 : 8;
    const ot = rng() < 0.2 ? intBetween(1, 3) : 0;
    await insertRow(slug, {
      employee_id: att.employee_id,
      work_date: att.work_date,
      regular_hours: reg,
      overtime_hours: ot,
      attendance_id: att.id,
      status: pickOneWeighted([['Draft', 10], ['Submitted', 20], ['Approved', 65], ['Rejected', 5]]),
      note: null,
    });
    n += 1;
  }
  log(`✓ ${slug}: ${n} timesheets in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedCompLedger() {
  const slug = SLUGS.ledger;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const periods = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - i);
    periods.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  for (const emp of cache[SLUGS.employee] || []) {
    const baseSal = Number(emp.base_salary) || 50000;
    const monthly = Math.round(baseSal / 12);
    for (const period of periods) {
      const isCurrent = period === periods[periods.length - 1];
      const status = isCurrent ? 'Draft' : 'Posted';
      const lines = [
        { component_type: 'Base', amount: monthly },
        { component_type: 'Overtime', amount: floatBetween(0, monthly * 0.1, 0) },
        { component_type: 'Bonus', amount: rng() < 0.3 ? floatBetween(100, 500, 0) : 0 },
        { component_type: 'Tax', amount: -Math.round(monthly * 0.18) },
        { component_type: 'Deduction', amount: -floatBetween(0, monthly * 0.05, 0) },
      ];
      for (const line of lines) {
        await insertRow(slug, {
          employee_id: emp.id,
          pay_period: period,
          component_type: line.component_type,
          amount: line.amount,
          status,
          posted_at: status === 'Posted' ? isoDt(daysAgo(intBetween(0, 60))) : null,
          note: null,
        });
        n += 1;
      }
    }
  }
  log(`✓ ${slug}: ${n} lines in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedCompSnapshots() {
  const slug = SLUGS.snapshot;
  if (!slug) return;
  if (!(await shouldSeedTable(slug))) return;
  const t0 = Date.now();
  let n = 0;
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - i);
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const headcount = (cache[SLUGS.employee] || []).length || V.staff;
    const gross = Math.round(headcount * 4500);
    const deductions = Math.round(gross * 0.22);
    await insertRow(slug, {
      pay_period: period,
      snapshot_date: isoDate(daysAgo(i * 30)),
      total_gross: gross,
      total_deductions: deductions,
      total_net: gross - deductions,
      status: i === 0 ? 'Draft' : 'Posted',
      posted_at: i === 0 ? null : isoDt(daysAgo(i * 30)),
    });
    n += 1;
  }
  log(`✓ ${slug}: ${n} snapshots in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedAuditLogs() {
  const slug = '__audit_logs';
  if (!allowed(slug)) return;
  if (!(await tableExists(slug))) return;
  if (!args.reset && (await tableCount(slug)) > 0) {
    log(`~ ${slug}: skipped (already populated)`, 'dim');
    return;
  }
  const t0 = Date.now();
  let n = 0;
  const trackable = ALL_SLUGS.filter((s) => !s.startsWith('__') && cache[s] && cache[s].length);
  const adminUser = (cache['__erp_users'] || []).find((u) => /admin/i.test(u.username || ''))
    || (cache['__erp_users'] || [])[0]
    || { id: null, username: 'system', display_name: 'System' };
  for (const slugName of trackable) {
    const rows = cache[slugName].slice(0, Math.min(20, cache[slugName].length));
    for (const r of rows) {
      const at = isoDt(daysAgo(intBetween(0, 30)));
      await insertRow(slug, {
        at,
        action: 'CREATE',
        entity: slugName,
        entity_id: r.id,
        user_id: adminUser.id,
        username: adminUser.username,
        user_display_name: adminUser.display_name,
        message: `Created ${slugName} record`,
        meta: JSON.stringify({ source: 'seed-mock-data', volume: args.volume }),
      });
      n += 1;
      if (rng() < 0.2) {
        await insertRow(slug, {
          at: isoDt(daysAgo(intBetween(0, 15))),
          action: 'UPDATE',
          entity: slugName,
          entity_id: r.id,
          user_id: adminUser.id,
          username: adminUser.username,
          user_display_name: adminUser.display_name,
          message: `Updated ${slugName} record`,
          meta: JSON.stringify({ source: 'seed-mock-data' }),
        });
        n += 1;
      }
    }
  }
  log(`✓ ${slug}: ${n} entries in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

async function seedReports() {
  const slug = '__reports';
  if (!allowed(slug)) return;
  if (!(await tableExists(slug))) return;
  if (!args.reset && (await tableCount(slug)) > 0) {
    log(`~ ${slug}: skipped (already populated)`, 'dim');
    return;
  }
  const t0 = Date.now();
  let n = 0;
  const reportType = sr.report_type || 'daily_summary';
  const trackedEntities = sr.entities || [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const reportDate = isoDate(d);
    const generatedAt = isoDt(d);
    const data = {};
    if (trackedEntities.length) {
      const counts = {};
      for (const ent of trackedEntities) {
        counts[ent] = cache[ent] ? cache[ent].length : 0;
      }
      data.entity_counts = counts;
    }
    if (sr.low_stock && sr.low_stock.entity && cache[sr.low_stock.entity]) {
      const slugN = sr.low_stock.entity;
      const qf = sr.low_stock.quantity_field || 'quantity';
      const rf = sr.low_stock.reorder_point_field || 'reorder_point';
      const low = (cache[slugN] || []).filter((r) => Number(r[qf]) <= Number(r[rf] || 0)).slice(0, sr.low_stock.limit || 10);
      data.low_stock = { entity: slugN, count: low.length, preview: low.map((r) => ({ id: r.id, quantity: r[qf], reorder_point: r[rf] })) };
    }
    if (sr.expiry && sr.expiry.entity && cache[sr.expiry.entity]) {
      const slugN = sr.expiry.entity;
      const ef = sr.expiry.expiry_field || 'expiry_date';
      const horizon = Date.now() + (sr.expiry.within_days || 30) * 86400000;
      const expiring = (cache[slugN] || []).filter((r) => {
        const t = new Date(r[ef] || '').getTime();
        return Number.isFinite(t) && t <= horizon;
      }).slice(0, sr.expiry.limit || 10);
      data.expiry = { entity: slugN, within_days: sr.expiry.within_days || 30, count: expiring.length, preview: expiring.map((r) => ({ id: r.id, expiry_date: r[ef] })) };
    }
    if (sr.inventory_value && sr.inventory_value.entity && cache[sr.inventory_value.entity]) {
      const slugN = sr.inventory_value.entity;
      const qf = sr.inventory_value.quantity_field || 'quantity';
      const pf = sr.inventory_value.unit_price_field || 'unit_cost';
      const rows = cache[slugN] || [];
      const totalQty = rows.reduce((s, r) => s + (Number(r[qf]) || 0), 0);
      const totalValue = rows.reduce((s, r) => s + (Number(r[qf]) || 0) * (Number(r[pf]) || 0), 0);
      data.inventory_value = { entity: slugN, quantity_field: qf, unit_price_field: pf, total_qty: totalQty, total_value: Number(totalValue.toFixed(2)) };
    }
    await insertRow(slug, {
      report_date: reportDate,
      report_type: reportType,
      generated_at: generatedAt,
      data: JSON.stringify(data),
    });
    n += 1;
  }
  log(`✓ ${slug}: ${n} report snapshots in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

// ─────────────────────────────────────────────────────────────────────
// 10. Run remaining unrecognised tables generically
// ─────────────────────────────────────────────────────────────────────

async function seedRemaining() {
  const HANDLED = new Set([
    SLUGS.site, SLUGS.vendor, SLUGS.client, SLUGS.department, SLUGS.employee,
    SLUGS.stock, SLUGS.movement, SLUGS.reservation,
    SLUGS.po, SLUGS.poItem, SLUGS.grn, SLUGS.grnItem,
    SLUGS.dispatch, SLUGS.dispatchLine,
    SLUGS.cycleSession, SLUGS.cycleLine,
    SLUGS.invoice, SLUGS.invoiceItem, SLUGS.payment, SLUGS.allocation, SLUGS.note,
    SLUGS.balance, SLUGS.leave, SLUGS.attendance, SLUGS.shift, SLUGS.timesheet,
    SLUGS.ledger, SLUGS.snapshot,
    'sales_orders', 'sales_order_lines', 'customers',
    '__audit_logs', '__reports',
    '__erp_users', '__erp_groups', '__erp_permissions',
    '__erp_user_groups', '__erp_group_permissions', '__erp_dashboard_preferences',
  ].filter(Boolean));
  for (const slug of ALL_SLUGS) {
    if (HANDLED.has(slug)) continue;
    if (slug.startsWith('__erp_')) continue;
    await seedGeneric(slug, intBetween(5, 15), 'fallback');
  }
}

// ─────────────────────────────────────────────────────────────────────
// 11. Summary
// ─────────────────────────────────────────────────────────────────────

function printSummary() {
  console.log('');
  header('Summary');
  const lines = [];
  for (const slug of ALL_SLUGS) {
    const n = (cache[slug] && cache[slug].length) || 0;
    lines.push([slug, n]);
  }
  const widest = Math.max(...lines.map(([s]) => s.length));
  for (const [s, n] of lines) {
    const pad = ' '.repeat(widest - s.length + 2);
    console.log(`  ${s}${pad}${String(n).padStart(5)}`);
  }
  const total = lines.reduce((sum, [, n]) => sum + n, 0);
  console.log('  ' + '-'.repeat(widest + 7));
  console.log(`  TOTAL${' '.repeat(widest - 5 + 2)}${String(total).padStart(5)}`);
  console.log('');
  log(`Done. Open the frontend (default http://localhost:5173) to explore the seeded ERP.`, 'cyan');
}

// ─────────────────────────────────────────────────────────────────────
// 12. Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  header(`CustomERP mock-data seeder`);
  console.log(`  project: ${ROOT}`);
  console.log(`  volume:  ${args.volume}`);
  console.log(`  reset:   ${args.reset}`);
  console.log(`  seed:    ${args.seed}`);
  console.log(`  dryRun:  ${args.dryRun}`);
  if (args.only) console.log(`  only:    ${[...args.only].join(', ')}`);
  if (args.skip.size) console.log(`  skip:    ${[...args.skip].join(', ')}`);

  // Connectivity probe
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error(`\n[seed-mock-data] Could not connect to PostgreSQL.`);
    console.error(`Set PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE or DATABASE_URL.`);
    console.error(`Underlying error: ${e.message}`);
    process.exit(2);
  }

  if (args.reset) {
    header('Reset');
    await reset();
  }

  header('Master data');
  await seedSites();
  await seedVendors();
  await seedClients(SLUGS.client);
  if (STUB_CUSTOMERS) await seedClients('customers');
  await seedDepartments();
  await seedEmployees();
  await seedDemoUsers();

  header('Stock');
  await seedStockArticles();
  await seedMovements();
  await seedHolds();

  header('Procurement & receiving');
  await seedProcurement();
  await seedArrivals();

  header('Sales / dispatch');
  await seedDispatch();
  await seedSalesStub();

  header('Cycle counts');
  await seedCycleCounts();

  header('Billing');
  await seedBilling();
  await seedSettlements();
  await seedAdjustments();

  header('HR');
  await seedTimeOffBalances();
  await seedTimeOff();
  await seedAttendance();
  await seedShifts();
  await seedTimesheets();
  await seedCompLedger();
  await seedCompSnapshots();

  header('Self-reference fixups');
  await fixSelfRefs();

  header('System');
  await seedAuditLogs();
  await seedReports();

  header('Generic fallback (unrecognised tables)');
  await seedRemaining();

  printSummary();

  await pool.end();
}

main().catch((err) => {
  console.error(`\n[seed-mock-data] FAILED: ${err.message}`);
  console.error(err.stack);
  pool.end().catch(() => {});
  process.exit(1);
});

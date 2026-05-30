// Postman/Newman test-data harness for the Tourism API.
//
// Makes the full collection runnable end-to-end (including the Payments &
// Reviews folders, which need real PAID bookings) WITHOUT a browser or the
// Stripe CLI. It:
//   1. Ensures two email-confirmed Supabase Auth users (customer + admin).
//   2. Ensures the `tourism-assets` storage bucket exists.
//   3. Creates a dedicated high-capacity OPEN departure on the seed tour.
//   4. Creates two PAID bookings by POSTing a self-signed Stripe webhook
//      (the exact HMAC-SHA256 scheme Stripe uses, keyed by
//      STRIPE_WEBHOOK_SECRET — so signature verification passes for real):
//        • refundBookingId  — paid with a REAL confirmed PaymentIntent so
//                             the admin refund (folder 14) hits Stripe and
//                             succeeds.
//        • reviewBookingCode — paid with a synthetic payment_intent (reviews
//                             don't touch Stripe).
//   5. Writes a gitignored Postman environment at .tmp/postman.env.json with
//      every value the collection needs.
//
// Usage (from repo root):  node docs/postman/seed-test-data.mjs
// Then:  pnpm dlx newman@6 run docs/postman/tourism-api.json -e .tmp/postman.env.json
//
// Reads secrets from apps/api/.env (gitignored). Prints no secret values.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_DIR = join(ROOT, 'apps', 'api');
const require = createRequire(join(API_DIR, 'package.json'));
const Stripe = require('stripe');

const API = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const TOUR = 'sa-pa-trek-2d1n';
const CUSTOMER_EMAIL = 'customer@example.com';
const ADMIN_EMAIL = 'admin@example.com';
const RUNTIME_ENV = join(ROOT, '.tmp', 'postman.env.json');
const TEMPLATE = join(ROOT, 'docs', 'postman', 'environments', 'local.postman_environment.json');

const env = Object.fromEntries(
  readFileSync(join(API_DIR, '.env'), 'utf8').split(/\r?\n/).map((l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    return m ? [m[1], m[2].trim()] : null;
  }).filter(Boolean),
);
const SUPA = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY, WHSEC = env.STRIPE_WEBHOOK_SECRET;
for (const [k, v] of Object.entries({ SUPABASE_URL: SUPA, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE, STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY })) {
  if (!v) throw new Error(`Missing ${k} in apps/api/.env`);
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const adminHdr = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

// ── Supabase users (idempotent; stable passwords across runs) ────────────────
function genPw(p) { return p + '-' + randomBytes(12).toString('base64url') + 'A1!'; }
let custPw = genPw('Cust'), admPw = genPw('Admn');
if (existsSync(RUNTIME_ENV)) {
  try {
    const v = Object.fromEntries(JSON.parse(readFileSync(RUNTIME_ENV, 'utf8')).values.map((x) => [x.key, x.value]));
    if (v.userPassword) custPw = v.userPassword;
    if (v.adminPassword) admPw = v.adminPassword;
  } catch { /* regenerate */ }
}
async function findUser(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: adminHdr });
  if (!r.ok) throw new Error(`list users ${r.status}`);
  const body = await r.json();
  return (body.users || body).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
}
async function upsertUser(email, password) {
  const ex = await findUser(email);
  const url = ex ? `${SUPA}/auth/v1/admin/users/${ex.id}` : `${SUPA}/auth/v1/admin/users`;
  const r = await fetch(url, { method: ex ? 'PUT' : 'POST', headers: adminHdr, body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!r.ok) throw new Error(`upsert ${email} ${r.status} ${await r.text()}`);
  return { id: ex ? ex.id : (await r.json()).id, action: ex ? 'updated' : 'created' };
}
async function ensureBucket(id) {
  const r = await fetch(`${SUPA}/storage/v1/bucket`, { method: 'POST', headers: adminHdr, body: JSON.stringify({ id, name: id, public: false }) });
  if (r.ok) return 'created';
  const t = await r.text();
  if (r.status === 409 || /already exists|Duplicate/i.test(t)) return 'exists';
  throw new Error(`bucket ${r.status} ${t}`);
}
const cust = await upsertUser(CUSTOMER_EMAIL, custPw);
const adm = await upsertUser(ADMIN_EMAIL, admPw);
const bucket = await ensureBucket('tourism-assets');
console.log(`users: customer=${cust.action} admin=${adm.action} | bucket=${bucket}`);

// ── API sign-in + sync ───────────────────────────────────────────────────────
async function signin(email, password) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const b = await r.json();
  if (!b.access_token) throw new Error('signin failed: ' + JSON.stringify(b));
  return b.access_token;
}
const bearer = (jwt) => ({ Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' });
const custAuth = bearer(await signin(CUSTOMER_EMAIL, custPw));
const admAuth = bearer(await signin(ADMIN_EMAIL, admPw));
await fetch(`${API}/auth/sync`, { method: 'POST', headers: custAuth });
await fetch(`${API}/auth/admin/sync`, { method: 'POST', headers: admAuth });

// ── Dedicated OPEN departure so paid bookings never contend on seats ─────────
const depBody = await (await fetch(`${API}/admin/tours/${TOUR}/departures`, {
  method: 'POST', headers: admAuth,
  body: JSON.stringify({ startDate: '2027-06-01', endDate: '2027-06-02', seatsTotal: 100, priceOverride: 119.0, status: 'OPEN' }),
})).json();
if (!depBody.data) throw new Error('departure create failed: ' + JSON.stringify(depBody));
const departureId = depBody.data.id;

// ── Pay a booking via a self-signed checkout.session.completed webhook ────────
async function mintRealPI() {
  const pi = await stripe.paymentIntents.create({
    amount: 5000, currency: 'usd', payment_method: 'pm_card_visa', confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });
  if (pi.status !== 'succeeded') throw new Error('PI status ' + pi.status);
  return pi.id;
}
async function payBooking(realPi) {
  const created = await (await fetch(`${API}/bookings`, {
    method: 'POST', headers: custAuth,
    body: JSON.stringify({ tourSlug: TOUR, departureId, numAdults: 2, numChildren: 1, contactName: 'Test Customer', contactEmail: CUSTOMER_EMAIL, contactPhone: '+84901234567' }),
  })).json();
  if (!created.data) throw new Error('booking create failed: ' + JSON.stringify(created));
  const { bookingId, bookingCode } = created.data;
  const piId = realPi ? await mintRealPI() : 'pi_test_synthetic_' + randomBytes(6).toString('hex');
  const payload = JSON.stringify({
    id: 'evt_' + randomBytes(10).toString('hex'), object: 'event', type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_' + randomBytes(10).toString('hex'), object: 'checkout.session', metadata: { bookingId, bookingCode }, payment_intent: piId } },
  });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', WHSEC).update(`${ts}.${payload}`, 'utf8').digest('hex');
  const wh = await fetch(`${API}/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, body: payload });
  if (wh.status !== 200) throw new Error('webhook ' + wh.status + ' ' + (await wh.text()));
  const detail = await (await fetch(`${API}/bookings/${bookingCode}`, { headers: custAuth })).json();
  if (detail.data?.status !== 'PAID') throw new Error(`${bookingCode} not PAID: ${detail.data?.status}`);
  return { bookingId, bookingCode };
}
const A = await payBooking(true);   // refund target (real PI)
const B = await payBooking(false);  // review target (synthetic PI)
console.log(`paid bookings: refund=${A.bookingCode} review=${B.bookingCode}`);

// ── Write runtime Postman env from the committed template ────────────────────
mkdirSync(join(ROOT, '.tmp'), { recursive: true });
const tmpl = JSON.parse(readFileSync(TEMPLATE, 'utf8'));
const overrides = {
  supabaseUrl: SUPA, supabaseAnonKey: ANON,
  userEmail: CUSTOMER_EMAIL, userPassword: custPw, adminEmail: ADMIN_EMAIL, adminPassword: admPw,
  refundBookingId: A.bookingId, reviewBookingCode: B.bookingCode,
};
tmpl.name = 'tourism-api · runtime (gitignored)';
tmpl.values = tmpl.values.map((v) => (v.key in overrides ? { ...v, value: overrides[v.key] } : v));
writeFileSync(RUNTIME_ENV, JSON.stringify(tmpl, null, 2));
console.log('wrote .tmp/postman.env.json — ready for newman.');

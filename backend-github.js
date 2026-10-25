// Live backend with NO server: all league data lives in one file, data.json, inside your GitHub repository.
// - Everyone can READ it (the repo is public). The page re-checks it every few seconds, so scores update by themselves.
// - Only the admin can WRITE it: the admin panel saves changes by committing to data.json with a private GitHub key
//   (a "personal access token") that stays in the admin's own browser.
import { GITHUB, ADMIN_EMAIL, LEAGUE } from "./config.js";

export const mode = "github";

// ---- where is the repo? (worked out from the site address: USERNAME.github.io/REPO/) ----
function where() {
  let owner = GITHUB.owner, repo = GITHUB.repo;
  if (!owner && location.hostname.endsWith(".github.io")) {
    owner = location.hostname.split(".")[0];
    repo = repo || location.pathname.split("/").filter(Boolean)[0] || `${owner}.github.io`;
  }
  return { owner, repo, branch: GITHUB.branch || "main", path: GITHUB.path || "data.json" };
}
const W = where();
const API = `https://api.github.com/repos/${W.owner}/${W.repo}/contents/${W.path}`;

// ---- the admin key ----
const TK = "epl_admin_key";
const getKey = () => { try { return localStorage.getItem(TK) || ""; } catch { return ""; } };
const setKey = (k) => { try { k ? localStorage.setItem(TK, k) : localStorage.removeItem(TK); } catch { /* blocked storage */ } };

const authSubs = new Set();
const adminUser = () => (getKey() ? { uid: "admin", email: ADMIN_EMAIL, name: "Admin", isAdmin: true } : null);
export function onAuth(cb) { authSubs.add(cb); setTimeout(() => cb(adminUser()), 0); return () => authSubs.delete(cb); }

// The "password" box on the admin page takes the GitHub key. We check it really can edit this repo.
export async function signInAdmin(_email, key) {
  key = String(key || "").trim();
  if (!key) throw new Error("Paste your admin key.");
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${W.owner}/${W.repo}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json" } });
  } catch { throw new Error("Cannot reach GitHub. Check your internet and try again."); }
  if (r.status === 401) throw new Error("GitHub does not accept this key. Make a new one and paste it again.");
  if (!r.ok) throw new Error("This key cannot see the league repository. When making the key, choose this repository.");
  const info = await r.json();
  if (!info.permissions || !info.permissions.push) throw new Error("This key can only read. Set Contents to “Read and write” when making it.");
  setKey(key);
  authSubs.forEach((cb) => cb(adminUser()));
}
export async function signOut() { setKey(""); authSubs.forEach((cb) => cb(null)); }

// ---- reading (shared by every page) ----
let db = { players: {}, fixtures: {}, meta: {} };
let etag = "";
const subs = new Set();
const emit = () => subs.forEach((cb) => cb());
const norm = (j) => ({ players: (j && j.players) || {}, fixtures: (j && j.fixtures) || {}, meta: (j && j.meta) || {} });

async function refresh() {
  const hdr = { Accept: "application/vnd.github.raw+json" };
  if (getKey()) hdr.Authorization = `Bearer ${getKey()}`;
  if (etag) hdr["If-None-Match"] = etag;
  try {
    const r = await fetch(`${API}?ref=${W.branch}`, { headers: hdr, cache: "no-store" });
    if (r.status === 304) return;           // nothing changed (these checks are free on GitHub's limits)
    if (r.ok) { etag = r.headers.get("ETag") || ""; db = norm(await r.json()); emit(); return; }
    throw new Error("api " + r.status);
  } catch {
    // fallback: the copy published with the site (a little slower to update)
    try { const r = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" }); if (r.ok) { db = norm(await r.json()); emit(); } } catch { /* offline */ }
  }
}
const ready = refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

export function onChange(cb) { subs.add(cb); return () => subs.delete(cb); }

// ---- writing: read latest file, change it, commit it (retry if someone else saved in between) ----
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
async function mutate(fn, message) {
  const key = getKey();
  if (!key) throw new Error("You are signed out. Sign in again.");
  const H = { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json" };
  for (let tries = 0; tries < 4; tries++) {
    let sha, cur = { players: {}, fixtures: {}, meta: {} };
    const g = await fetch(`${API}?ref=${W.branch}&t=${Date.now()}`, { headers: H, cache: "no-store" });
    if (g.ok) { const j = await g.json(); sha = j.sha; try { cur = norm(JSON.parse(unb64(j.content))); } catch { /* start fresh */ } }
    else if (g.status !== 404) throw new Error(g.status === 401 ? "Your admin key stopped working. Sign in again." : "GitHub error " + g.status);
    fn(cur);
    const body = { message, content: b64(JSON.stringify(cur, null, 1) + "\n"), branch: W.branch };
    if (sha) body.sha = sha;
    const p = await fetch(API, { method: "PUT", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (p.ok) { db = cur; etag = ""; emit(); return; }
    if (p.status === 409 || p.status === 422) continue; // file changed under us, try again
    throw new Error(p.status === 403 || p.status === 404 ? "This key is not allowed to save. It needs Contents: Read and write on this repository." : "GitHub error " + p.status);
  }
  throw new Error("Could not save, too many people saving at once. Try again.");
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const vals = (o) => Object.entries(o).map(([id, v]) => ({ id, ...v }));
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60);

export async function getPlayers() { await ready; return vals(db.players).map((p) => ({ ...p, uid: p.id })); }

export async function addPlayers(team, names) {
  const list = names.map(clean).filter(Boolean);
  if (!list.length) throw new Error("Type at least one name.");
  await mutate((d) => {
    const current = Object.values(d.players).filter((p) => p.team === team).length;
    if (current + list.length > LEAGUE.playersPerTeam) {
      throw new Error(`A team can have ${LEAGUE.playersPerTeam} players. This team has ${current}, so you can add ${LEAGUE.playersPerTeam - current} more.`);
    }
    list.forEach((name, i) => { d.players[uid()] = { name, team, ord: Date.now() + i }; });
  }, "Add players");
}

export async function renamePlayer(id, name) {
  const n = clean(name);
  if (!n) throw new Error("The name cannot be empty.");
  await mutate((d) => { if (d.players[id]) d.players[id].name = n; }, "Rename player");
}

export const removePlayer = (id) => mutate((d) => { delete d.players[id]; }, "Remove player");

export async function getFixtures() { await ready; return vals(db.fixtures); }

export async function saveFixture(fx) {
  const id = fx.id || uid();
  const { id: _omit, ...rest } = fx;
  await mutate((d) => { d.fixtures[id] = { ...(d.fixtures[id] || {}), ...rest }; }, "Update match");
  return id;
}

export const deleteFixture = (id) => mutate((d) => { delete d.fixtures[id]; }, "Delete match");

export async function seedFixtures(list) {
  await mutate((d) => { list.forEach((fx) => { d.fixtures[uid()] = fx; }); }, "Add fixtures");
}

export async function getMeta() { await ready; return db.meta || {}; }
export const saveMeta = (patch) => mutate((d) => { d.meta = { ...(d.meta || {}), ...patch }; }, "Update league settings");

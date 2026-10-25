// DEMO backend: everything is kept in this browser's localStorage so the site can be tried
// without GitHub. It is used only when the site is not on github.io.
import { ADMIN_EMAIL, LEAGUE } from "./config.js";

export const mode = "demo";
const K = "epl_demo_v2";
const mem = { data: null };

function load() {
  if (mem.data) return mem.data;
  try { mem.data = JSON.parse(localStorage.getItem(K)) || null; } catch { mem.data = null; }
  if (!mem.data) mem.data = { players: {}, fixtures: {}, meta: {}, user: null };
  return mem.data;
}
const changeSubs = new Set();
function save() { try { localStorage.setItem(K, JSON.stringify(mem.data)); } catch { /* storage full or blocked */ } changeSubs.forEach((cb) => cb()); }
window.addEventListener("storage", (e) => { if (e.key === K) { mem.data = null; changeSubs.forEach((cb) => cb()); } });
export function onChange(cb) { changeSubs.add(cb); return () => changeSubs.delete(cb); }
const listeners = new Set();
const emit = () => { const u = load().user; listeners.forEach((cb) => cb(u)); };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function onAuth(cb) {
  listeners.add(cb);
  setTimeout(() => cb(load().user), 0);
  return () => listeners.delete(cb);
}

export async function signInAdmin(email, password) {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) throw new Error("This account is not allowed in the admin panel.");
  if (!password) throw new Error("Type the password.");
  const d = load();
  d.user = { uid: "demo-admin", email: ADMIN_EMAIL.toLowerCase(), name: "Admin", isAdmin: true };
  save(); emit();
}

export async function signOut() { const d = load(); d.user = null; save(); emit(); }

const vals = (o) => Object.entries(o).map(([id, v]) => ({ id, ...v }));
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60);

export async function getPlayers() { return vals(load().players).map((p) => ({ ...p, uid: p.id })); }

export async function addPlayers(team, names) {
  const list = names.map(clean).filter(Boolean);
  if (!list.length) throw new Error("Type at least one name.");
  const d = load();
  const current = Object.values(d.players).filter((p) => p.team === team).length;
  if (current + list.length > LEAGUE.playersPerTeam) {
    throw new Error(`A team can have ${LEAGUE.playersPerTeam} players. This team has ${current}, so you can add ${LEAGUE.playersPerTeam - current} more.`);
  }
  list.forEach((name, i) => { d.players[uid()] = { name, team, ord: Date.now() + i }; });
  save();
}

export async function renamePlayer(id, name) {
  const n = clean(name);
  if (!n) throw new Error("The name cannot be empty.");
  const d = load();
  if (d.players[id]) d.players[id].name = n;
  save();
}

export async function removePlayer(id) { delete load().players[id]; save(); }

export async function getFixtures() { return vals(load().fixtures); }

export async function saveFixture(fx) {
  const d = load();
  const id = fx.id || uid();
  const { id: _omit, ...rest } = fx;
  d.fixtures[id] = { ...(d.fixtures[id] || {}), ...rest };
  save();
  return id;
}

export async function deleteFixture(id) { delete load().fixtures[id]; save(); }

export async function seedFixtures(list) {
  const d = load();
  list.forEach((fx) => { d.fixtures[uid()] = fx; });
  save();
}

export async function getMeta() { return load().meta || {}; }
export async function saveMeta(patch) { const d = load(); d.meta = { ...(d.meta || {}), ...patch }; save(); }

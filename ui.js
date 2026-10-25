import { LEAGUE, SLOTS, FAIRPLAY, FINES } from "./config.js";
import { TEAMS, teamById, badge } from "./teams.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, bad = false) {
  document.querySelectorAll(".toast").forEach((x) => x.remove());
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---- days, slots and times ----
export const DAYS = Array.from({ length: LEAGUE.matchDays }, (_, i) => i + 1);
export const fmtDay = (ds) => (ds ? new Date(ds + "T12:00:00+01:00").toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "");
export const t5 = (s) => (s && s.endsWith(":00") ? s.slice(0, 5) : s || "");
export const slotOf = (n) => SLOTS.find((s) => s.n === Number(n));
export const slotName = (n) => slotOf(n)?.name || "Match";
export const slotRange = (n) => { const s = slotOf(n); return s ? `${t5(s.start)} – ${t5(s.end)}` : ""; };

export const teamLabel = (id, size = 28) => `${badge(id, size)}<span>${esc(teamById[id]?.name || id)}</span>`;

export const sortFixtures = (list) => [...list].sort((a, b) => (a.matchDay || 99) - (b.matchDay || 99) || (a.slot || 9) - (b.slot || 9) || String(a.id).localeCompare(String(b.id)));
export const isStarted = (f) => f.status === "finished" || f.status === "live";

// the tabs "Match day 1 ... Match day 7" (used by the public Fixtures page and the admin panel)
export function dayTabs(cur, fixtures) {
  return `<div class="daytabs" role="tablist" aria-label="Match days">${DAYS.map((n) => {
    const live = fixtures.some((f) => f.matchDay === n && f.status === "live");
    return `<button role="tab" data-day="${n}" class="${cur === n ? "on" : ""}" aria-selected="${cur === n}">Match day ${n}${live ? ` <span class="dot"></span>` : ""}</button>`;
  }).join("")}</div>`;
}

// ---- league maths ----
const STATS = ["p", "w", "d", "l", "gf", "ga", "pts"];

function tieBreaker(group, done, byName) {
  const ids = new Set(group.map((g) => g.id));
  const h = Object.fromEntries(group.map((g) => [g.id, { pts: 0, gf: 0, ga: 0 }]));
  done.filter((f) => ids.has(f.homeId) && ids.has(f.awayId)).forEach((f) => {
    const a = h[f.homeId], b = h[f.awayId];
    a.gf += f.homeScore; a.ga += f.awayScore; b.gf += f.awayScore; b.ga += f.homeScore;
    if (f.homeScore > f.awayScore) a.pts += 3; else if (f.homeScore < f.awayScore) b.pts += 3; else { a.pts++; b.pts++; }
  });
  return (x, y) => h[y.id].pts - h[x.id].pts || (h[y.id].gf - h[y.id].ga) - (h[x.id].gf - h[x.id].ga) || h[y.id].gf - h[x.id].gf || x.fp - y.fp || byName(x, y);
}

// Order: points, goal difference, goals scored, head-to-head, fair play (fewest points), then A to Z.
export function computeTable(fixtures, meta = {}) {
  const rows = Object.fromEntries(TEAMS.map((t) => [t.id, { id: t.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, yc: 0, rc: 0, fp: 0 }]));
  const done = fixtures.filter((f) => f.status === "finished" && rows[f.homeId] && rows[f.awayId]);
  done.forEach((f) => {
    const h = rows[f.homeId], a = rows[f.awayId];
    h.p++; a.p++;
    h.gf += f.homeScore; h.ga += f.awayScore; a.gf += f.awayScore; a.ga += f.homeScore;
    if (f.homeScore > f.awayScore) { h.w++; a.l++; h.pts += 3; }
    else if (f.homeScore < f.awayScore) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  });
  fixtures.filter(isStarted).forEach((f) => (f.cards || []).forEach((c) => {
    const r = rows[c.teamId]; if (!r) return;
    if (c.type === "yellow") { r.yc++; r.fp += FAIRPLAY.yellow; }
    else if (c.type === "yellow2") { r.rc++; r.fp += FAIRPLAY.yellow2; }
    else { r.rc++; r.fp += FAIRPLAY.red; }
  }));
  Object.entries(meta.adjust || {}).forEach(([id, a]) => { if (rows[id]) STATS.forEach((k) => { rows[id][k] += Number(a?.[k] || 0); }); });
  const list = Object.values(rows).map((r) => ({ ...r, gd: r.gf - r.ga }));
  const byName = (x, y) => teamById[x.id].name.localeCompare(teamById[y.id].name);
  list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || byName(x, y));
  const out = [];
  for (let i = 0; i < list.length;) {
    let j = i + 1;
    while (j < list.length && list[j].pts === list[i].pts && list[j].gd === list[i].gd && list[j].gf === list[i].gf) j++;
    const group = list.slice(i, j);
    if (group.length > 1) group.sort(tieBreaker(group, done, byName));
    out.push(...group); i = j;
  }
  return out;
}

export function topScorers(fixtures) {
  const m = new Map();
  fixtures.filter(isStarted).forEach((f) => (f.scorers || []).forEach((s) => {
    const key = s.playerId || s.name;
    const cur = m.get(key) || { name: s.name, teamId: s.teamId, goals: 0 };
    cur.goals++; m.set(key, cur);
  }));
  return [...m.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

// one row per team: clean sheets (finished games where the other team did not score) plus any hand correction
export function cleanSheets(fixtures, meta = {}) {
  const rows = Object.fromEntries(TEAMS.map((t) => [t.id, { id: t.id, auto: 0, n: 0, keepers: [] }]));
  const add = (id, conceded, gk) => { if (rows[id] && conceded === 0) { rows[id].auto++; if (gk && !rows[id].keepers.includes(gk)) rows[id].keepers.push(gk); } };
  fixtures.filter((f) => f.status === "finished" && typeof f.homeScore === "number").forEach((f) => {
    add(f.homeId, f.awayScore, f.gk?.home); add(f.awayId, f.homeScore, f.gk?.away);
  });
  return Object.values(rows).map((r) => ({ ...r, n: Math.max(0, r.auto + Number(meta.cleanSheets?.[r.id] || 0)) }))
    .sort((a, b) => b.n - a.n || teamById[a.id].name.localeCompare(teamById[b.id].name));
}

// best player of a match is chosen by the admin; the league's best is the most awards (or the admin's pick)
export function bestPlayers(fixtures) {
  const m = new Map();
  fixtures.filter((f) => f.status === "finished" && f.best?.name).forEach((f) => {
    const key = (f.best.playerId || f.best.name) + "|" + f.best.teamId;
    const cur = m.get(key) || { name: f.best.name, teamId: f.best.teamId, awards: 0 };
    cur.awards++; m.set(key, cur);
  });
  return [...m.values()].sort((a, b) => b.awards - a.awards || a.name.localeCompare(b.name));
}

// cards per team (for the fair play table and fines)
export function disciplineByTeam(fixtures) {
  const rows = Object.fromEntries(TEAMS.map((t) => [t.id, { id: t.id, yellow: 0, red: 0, fp: 0, fine: 0 }]));
  fixtures.filter(isStarted).forEach((f) => (f.cards || []).forEach((c) => {
    const r = rows[c.teamId]; if (!r) return;
    if (c.type === "yellow") { r.yellow++; r.fp += FAIRPLAY.yellow; r.fine += FINES.yellow; }
    else if (c.type === "yellow2") { r.red++; r.fp += FAIRPLAY.yellow2; r.fine += FINES.red; }
    else { r.red++; r.fp += FAIRPLAY.red; r.fine += FINES.red; }
  }));
  return Object.values(rows).sort((a, b) => teamById[a.id].name.localeCompare(teamById[b.id].name));
}

export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
export const squadOf = (players, teamId) => players.filter((p) => p.team === teamId).sort((a, b) => (a.ord || 0) - (b.ord || 0) || a.name.localeCompare(b.name));

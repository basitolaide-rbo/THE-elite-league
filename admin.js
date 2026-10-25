import * as data from "./data.js";
import { TEAMS, teamById, badge } from "./teams.js";
import { LEAGUE, SLOTS, ADMIN_EMAIL, STARTING_SQUADS, DEFAULT_RULES, FINES } from "./config.js";
import {
  esc, $, $$, toast, DAYS, fmtDay, t5, slotName, slotRange, teamLabel, sortFixtures, dayTabs, squadOf,
  computeTable, topScorers, cleanSheets, disciplineByTeam, naira
} from "./ui.js";

const MAX = LEAGUE.playersPerTeam;
let tab = "fixtures";
let day = 1;

// Optional: the 16 games from the first poster, put into one match day.
const POSTER = [
  [["mun", "mci"], ["ars", "rma"], ["che", "bar"], ["liv", "bay"]],
  [["mun", "rma"], ["mci", "bar"], ["ars", "bay"], ["che", "liv"]],
  [["mun", "bar"], ["rma", "bay"], ["mci", "liv"], ["ars", "che"]],
  [["mun", "bay"], ["bar", "liv"], ["rma", "che"], ["mci", "ars"]]
];
export const posterFixtures = (matchDay) => POSTER.flatMap((games, i) => games.map(([homeId, awayId]) => ({
  matchDay, slot: i + 1, homeId, awayId, venue: LEAGUE.venue, status: "scheduled", homeScore: null, awayScore: null, scorers: [], cards: []
})));
const blank = () => ({ status: "scheduled", homeScore: null, awayScore: null, scorers: [], cards: [] });
const uid = () => Math.random().toString(36).slice(2, 10);

function dialog(html, onMount) {
  const d = document.createElement("dialog");
  d.innerHTML = html;
  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) d.close(); });
  d.showModal();
  onMount?.(d);
  return d;
}
const teamOpts = (sel) => `<option value="">Choose…</option>${TEAMS.map((t) => `<option value="${t.id}" ${sel === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}`;
const playerOpts = (players, team, sel) => squadOf(players, team).map((p) => `<option value="${esc(p.uid)}" ${sel === p.uid ? "selected" : ""}>${esc(p.name)}</option>`).join("");
const run = async (fn, ok, rerender) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, true); } rerender?.(); };
const wireDays = (el, rerender) => $$("[data-day]", el).forEach((b) => b.addEventListener("click", () => { day = Number(b.dataset.day); rerender(); }));

export async function admin(el, ctx) {
  const u = ctx.user;
  if (!u || !u.isAdmin) return login(el, ctx);
  await panel(el, ctx);
}

function login(el, ctx) {
  const u = ctx.user;
  el.innerHTML = `<h2>Admin sign-in</h2>
  ${u && !u.isAdmin ? `<div class="note bad" style="max-width:420px;margin-bottom:14px"><b>Not authorised.</b> ${esc(u.email)} is not an admin account.
    <div style="margin-top:10px"><button class="btn ghost sm" id="so">Sign out</button></div></div>` : ""}
  <form class="f" id="lf" style="max-width:420px" autocomplete="on">
    <p class="muted" style="margin:0">Only the league organiser can enter this area. Paste the admin key once; this device remembers it until you sign out.</p>
    <input type="hidden" name="email" value="${esc(ADMIN_EMAIL)}">
    <label>Admin key<input type="password" name="password" required autocomplete="off" placeholder="${data.mode === "demo" ? "anything" : "github_pat_..."}"></label>
    <div id="err" class="note bad" hidden></div>
    <button class="btn" type="submit">Sign in</button>
    ${data.mode === "demo" ? `<p class="small muted" style="margin:0">Demo mode: any key works. On the live site this is your GitHub admin key.</p>` : ""}
  </form>`;
  $("#so", el)?.addEventListener("click", () => data.signOut());
  $("#lf", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, err = $("#err", el);
    try { err.hidden = true; await data.signInAdmin(f.email.value, f.password.value); }
    catch (ex) { err.hidden = false; err.textContent = ex.message; }
  });
}

async function panel(el, ctx) {
  const [players, fixtures, meta] = await Promise.all([data.getPlayers(), data.getFixtures(), data.getMeta()]);
  const rerender = () => panel(el, ctx);
  const tabs = [["fixtures", "Fixtures"], ["live", "Live & results"], ["squads", "Squads"], ["discipline", "Cards & fines"], ["stats", "Stats & table"], ["rules", "Rules"]];
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <h2 style="margin:0">Admin panel</h2><span class="small muted">${esc(ctx.user.email)} · <button class="btn ghost sm" id="so">Sign out</button></span></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? "on" : ""}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
    <div id="tabbody"></div>`;
  $("#so", el).addEventListener("click", async () => { await data.signOut(); ctx.go("#/"); });
  $$("[data-tab]", el).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; rerender(); }));
  const env = { players, fixtures, meta, rerender };
  ({ fixtures: tabFixtures, live: tabLive, squads: tabSquads, discipline: tabDiscipline, stats: tabStats, rules: tabRules }[tab])($("#tabbody", el), env);
}

// ================= squads =================
function tabSquads(el, { players, rerender }) {
  const total = players.length;
  const starting = Object.values(STARTING_SQUADS || {}).some((l) => l?.length) && total === 0;
  el.innerHTML = `<p class="muted small" style="margin-top:0">Add the player names for each team (up to ${MAX} per team). ${total}/${TEAMS.length * MAX} players added.</p>
    ${starting ? `<div class="card" style="margin-bottom:14px"><h3>Starting squads are ready</h3><p class="muted small" style="margin:4px 0 10px">All 8 squads are already stored in the site. Load them with one click (it takes a moment).</p><button class="btn" id="loadsq">Load starting squads</button></div>` : ""}
    <div class="grid g2">${TEAMS.map((t) => {
      const sq = squadOf(players, t.id);
      const full = sq.length >= MAX;
      return `<article class="card"><div class="teamhead">${badge(t.id, 40)}<div><h3>${esc(t.name)}</h3><span class="pill ${full ? "ok" : ""}">${sq.length}/${MAX}${full ? " · full" : ""}</span></div></div>
        <ol class="names edit">${sq.map((p) => `<li><span>${esc(p.name)}</span><span class="rowbtns"><button class="btn ghost sm" data-ren="${esc(p.uid)}" data-name="${esc(p.name)}">Rename</button><button class="btn bad sm" data-remove="${esc(p.uid)}" data-name="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">✕</button></span></li>`).join("")}</ol>
        ${full ? `<p class="small muted" style="margin:10px 0 0">Squad is full.</p>` : `<form class="addp" data-team="${t.id}"><input type="text" name="n" maxlength="60" placeholder="Player name" aria-label="Add a player to ${esc(t.name)}"><button class="btn sm" type="submit">Add</button></form>
        <button class="btn ghost sm" style="margin-top:8px" data-paste="${t.id}">Paste a list of names</button>`}</article>`;
    }).join("")}</div>`;
  $("#loadsq", el)?.addEventListener("click", () => run(async () => {
    for (const [team, names] of Object.entries(STARTING_SQUADS)) if (names?.length) await data.addPlayers(team, names);
  }, "Starting squads loaded.", rerender));
  $$(".addp", el).forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!f.n.value.trim()) return;
    run(() => data.addPlayers(f.dataset.team, [f.n.value]), "Player added.", rerender);
  }));
  $$("[data-paste]", el).forEach((b) => b.addEventListener("click", () => {
    const team = b.dataset.paste, room = MAX - squadOf(players, team).length;
    dialog(`<form method="dialog" class="f" id="pf" style="max-width:none">
      <h3>${esc(teamById[team].name)}: paste names</h3>
      <p class="muted small" style="margin:0">One name per line. You can add up to ${room} more.</p>
      <textarea name="names" rows="8" placeholder="Player One&#10;Player Two&#10;Player Three" style="min-height:160px"></textarea>
      <div class="row"><button class="btn" type="submit">Add these players</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
      $("#pf", d).addEventListener("submit", (e) => {
        e.preventDefault();
        const names = e.target.names.value.split(/\r?\n/).map((x) => x.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean);
        d.close();
        run(() => data.addPlayers(team, names), `${names.length} player${names.length === 1 ? "" : "s"} added.`, rerender);
      });
    });
  }));
  $$("[data-ren]", el).forEach((b) => b.addEventListener("click", () => {
    const n = window.prompt("Player name:", b.dataset.name);
    if (n === null) return;
    run(() => data.renamePlayer(b.dataset.ren, n), "Name updated.", rerender);
  }));
  $$("[data-remove]", el).forEach((b) => b.addEventListener("click", () => {
    if (!window.confirm(`Remove ${b.dataset.name} from the squad?`)) return;
    run(() => data.removePlayer(b.dataset.remove), "Player removed.", rerender);
  }));
}

// ================= fixtures (match days 1 to 7) =================
function fixtureDialog(fx, all, rerender) {
  dialog(`<form method="dialog" class="f" id="ff" style="max-width:none" novalidate>
    <h3>${fx ? "Edit game" : "Add a game"}</h3>
    <div class="row"><label>Match day<select name="day">${DAYS.map((n) => `<option value="${n}" ${(fx?.matchDay || day) === n ? "selected" : ""}>Match day ${n}</option>`).join("")}</select></label>
      <label>Time slot<select name="slot">${SLOTS.map((s) => `<option value="${s.n}" ${(fx?.slot || 1) === s.n ? "selected" : ""}>${esc(s.name)} · ${esc(slotRange(s.n))}</option>`).join("")}</select></label></div>
    <div class="row"><label>Home team<select name="home">${teamOpts(fx?.homeId)}</select></label><label>Away team<select name="away">${teamOpts(fx?.awayId)}</select></label></div>
    <label>Venue<input type="text" name="venue" maxlength="60" value="${esc(fx?.venue ?? LEAGUE.venue)}"></label>
    <div id="derr" class="note bad" hidden></div>
    <div class="row"><button class="btn" type="submit">Save game</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
  </form>`, (d) => {
    $("#ff", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, err = $("#derr", d);
      const bad = (m) => { err.hidden = false; err.textContent = m; };
      if (!f.home.value || !f.away.value) return bad("Choose both teams.");
      if (f.home.value === f.away.value) return bad("A team cannot play itself.");
      const md = Number(f.day.value), sl = Number(f.slot.value);
      const clash = all.find((g) => g.id !== fx?.id && g.matchDay === md && g.slot === sl && [g.homeId, g.awayId].some((t) => t === f.home.value || t === f.away.value));
      if (clash) return bad(`${teamById[[clash.homeId, clash.awayId].find((t) => t === f.home.value || t === f.away.value)].name} already play in this slot.`);
      const next = { ...(fx || blank()), matchDay: md, slot: sl, homeId: f.home.value, awayId: f.away.value, venue: f.venue.value.trim() };
      try { await data.saveFixture(next); day = md; d.close(); toast("Game saved."); rerender(); } catch (ex) { bad(ex.message); }
    });
  });
}

function tabFixtures(el, { fixtures, players, meta, rerender }) {
  const dates = meta.dates || {};
  const list = sortFixtures(fixtures).filter((f) => f.matchDay === day);
  el.innerHTML = `<div class="card" style="margin-bottom:16px"><h3>Match day dates</h3>
      <p class="muted small" style="margin:4px 0 10px">Set the date of each match day. It shows on the Fixtures page.</p>
      <div class="grid g4">${DAYS.map((n) => `<label>Match day ${n}<input type="date" data-date="${n}" value="${esc(dates[n] || "")}"></label>`).join("")}</div>
      <button class="btn sm" id="sdates" style="margin-top:12px">Save dates</button></div>
    ${dayTabs(day, fixtures)}
    <div class="row" style="margin:8px 0 14px"><button class="btn" id="add" style="flex:0 0 auto">+ Add a game to Match day ${day}</button></div>
    ${SLOTS.map((s) => {
      const g = list.filter((f) => f.slot === s.n);
      return `<section class="round"><h3>${esc(s.name)} <small>${esc(slotRange(s.n))}</small></h3>${g.length ? g.map((f) => `<div class="fx" style="grid-template-columns:1fr auto 1fr">
        <div class="t h">${teamLabel(f.homeId, 26)}</div><div class="mid"><div class="score" style="font-size:20px">${f.status === "scheduled" || !f.status ? "vs" : `${f.homeScore ?? 0}–${f.awayScore ?? 0}`}</div></div><div class="t">${teamLabel(f.awayId, 26)}</div>
        <div class="meta">${f.venue ? esc(f.venue) : ""}${f.status === "finished" ? " · Full time" : f.status === "live" ? " · LIVE" : ""}
          <div style="margin-top:6px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><button class="btn ghost sm" data-edit="${esc(f.id)}">Edit</button><button class="btn ghost sm" data-lu="${esc(f.id)}">Line-up</button><button class="btn bad sm" data-del="${esc(f.id)}">Delete</button></div></div></div>`).join("") : `<div class="empty slim">No games in this slot yet.</div>`}</section>`;
    }).join("")}
    <details class="card" style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Optional: load the 16 poster games into a match day</summary>
      <p class="muted small">Adds the 16 games from the first poster (4 per slot). Skip this if you want to add every game yourself.</p>
      <div class="row"><label>Into<select id="seedday">${DAYS.map((n) => `<option value="${n}">Match day ${n}</option>`).join("")}</select></label><button class="btn ghost" id="seed" style="flex:0 0 auto">Load 16 games</button></div></details>`;
  wireDays(el, rerender);
  $("#sdates", el).addEventListener("click", () => {
    const next = {};
    $$("[data-date]", el).forEach((i) => { if (i.value) next[i.dataset.date] = i.value; });
    run(() => data.saveMeta({ dates: next }), "Dates saved.", rerender);
  });
  $("#add", el).addEventListener("click", () => fixtureDialog(null, fixtures, rerender));
  $("#seed", el).addEventListener("click", () => {
    const md = Number($("#seedday", el).value);
    if (fixtures.some((f) => f.matchDay === md) && !window.confirm(`Match day ${md} already has games. Add the 16 poster games as well?`)) return;
    run(() => data.seedFixtures(posterFixtures(md)), "16 games added.", rerender);
  });
  $$("[data-edit]", el).forEach((b) => b.addEventListener("click", () => fixtureDialog(fixtures.find((f) => f.id === b.dataset.edit), fixtures, rerender)));
  $$("[data-lu]", el).forEach((b) => b.addEventListener("click", () => lineupDialog(fixtures.find((f) => f.id === b.dataset.lu), players, rerender)));
  $$("[data-del]", el).forEach((b) => b.addEventListener("click", () => {
    if (!window.confirm("Delete this game? Any result on it is deleted too.")) return;
    run(() => data.deleteFixture(b.dataset.del), "Game deleted.", rerender);
  }));
}

// ================= line-up, goals, cards, walkover, full time =================
function lineupDialog(f, players, rerender) {
  const sq = (team) => squadOf(players, team);
  const has = f.lineup && ((f.lineup.home || []).length || (f.lineup.away || []).length);
  const col = (side, team) => {
    const chosen = new Set((f.lineup?.[side] || []).map((p) => p.id));
    return `<div><h3 style="font-size:18px;margin-bottom:6px">${esc(teamById[team].name)}</h3>${sq(team).map((p) => `<label><input type="checkbox" data-side="${side}" value="${esc(p.uid)}" ${!has || chosen.has(p.uid) ? "checked" : ""}>${esc(p.name)}</label>`).join("") || `<p class="muted small">No players in this squad yet. Add them on the Squads tab.</p>`}</div>`;
  };
  dialog(`<form method="dialog" class="f" id="luf" style="max-width:none"><h3>Line-up</h3>
    <p class="muted small" style="margin:0">Tick the players who start. Everyone is ticked by default.</p>
    <div class="lugrid">${col("home", f.homeId)}${col("away", f.awayId)}</div>
    <div class="row"><button class="btn" type="submit">Save line-up</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
    $("#luf", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const pick = (side, team) => $$(`input[data-side=${side}]:checked`, d).map((i) => { const p = sq(team).find((x) => x.uid === i.value); return p && { id: p.uid, name: p.name }; }).filter(Boolean);
      try { await data.saveFixture({ id: f.id, lineup: { home: pick("home", f.homeId), away: pick("away", f.awayId) } }); d.close(); toast("Line-up saved."); rerender(); }
      catch (ex) { toast(ex.message, true); }
    });
  });
}

function goalDialog(f, side, players, rerender) {
  const team = side === "home" ? f.homeId : f.awayId;
  const sq = squadOf(players, team);
  dialog(`<form method="dialog" class="f" id="gf" style="max-width:none"><h3>⚽ Goal for ${esc(teamById[team].name)}</h3>
    <label>Scorer<select name="p"><option value="">Not recorded</option>${sq.map((p) => `<option value="${esc(p.uid)}">${esc(p.name)}</option>`).join("")}</select></label>
    <label>Minute (optional)<input type="text" name="m" inputmode="numeric" maxlength="3" placeholder="e.g. 8"></label>
    <div class="row"><button class="btn" type="submit">Add goal</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
    $("#gf", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target, p = sq.find((x) => x.uid === form.p.value);
      const scorers = [...(f.scorers || [])];
      if (p) scorers.push({ playerId: p.uid, name: p.name, teamId: team, minute: form.m.value.trim() });
      try {
        await data.saveFixture({ id: f.id, status: "live", scorers, homeScore: (f.homeScore || 0) + (side === "home" ? 1 : 0), awayScore: (f.awayScore || 0) + (side === "away" ? 1 : 0) });
        d.close(); toast("Goal added. The scoreboard is updated."); rerender();
      } catch (ex) { toast(ex.message, true); }
    });
  });
}

async function undoGoal(f, side, rerender) {
  const team = side === "home" ? f.homeId : f.awayId;
  const cur = side === "home" ? f.homeScore || 0 : f.awayScore || 0;
  if (cur <= 0) return toast("That team has no goals to undo.", true);
  const scorers = [...(f.scorers || [])];
  const i = scorers.map((s) => s.teamId).lastIndexOf(team);
  if (i >= 0) scorers.splice(i, 1);
  await run(() => data.saveFixture({ id: f.id, scorers, [side === "home" ? "homeScore" : "awayScore"]: cur - 1 }), "Last goal undone.", rerender);
}

const CARD_TYPES = [["yellow", "Yellow card"], ["yellow2", "Second yellow"], ["red", "Red card"]];
function cardDialog(f, players, rerender) {
  dialog(`<form method="dialog" class="f" id="cf" style="max-width:none"><h3>Give a card</h3>
    <div class="row"><label>Team<select name="t"><option value="${f.homeId}">${esc(teamById[f.homeId].name)}</option><option value="${f.awayId}">${esc(teamById[f.awayId].name)}</option></select></label>
      <label>Card<select name="c">${CARD_TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label></div>
    <label>Player<select name="p"></select></label>
    <label>Minute (optional)<input type="text" name="m" inputmode="numeric" maxlength="3"></label>
    <div class="row"><button class="btn" type="submit">Save card</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
    const form = $("#cf", d);
    const fill = () => { form.p.innerHTML = playerOpts(players, form.t.value) || `<option value="">No players in this squad</option>`; };
    fill(); form.t.addEventListener("change", fill);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const p = squadOf(players, form.t.value).find((x) => x.uid === form.p.value);
      if (!p) return toast("Choose a player.", true);
      const cards = [...(f.cards || []), { playerId: p.uid, name: p.name, teamId: form.t.value, type: form.c.value, minute: form.m.value.trim() }];
      try { await data.saveFixture({ id: f.id, cards }); d.close(); toast("Card recorded."); rerender(); } catch (ex) { toast(ex.message, true); }
    });
  });
}

function walkoverDialog(f, rerender) {
  dialog(`<form method="dialog" class="f" id="wf" style="max-width:none"><h3>Walkover</h3>
    <p class="muted small" style="margin:0">A team not ready within 5 minutes of kick-off loses 3–0. The game is finished at once.</p>
    <label>Which team was not ready?<select name="t"><option value="home">${esc(teamById[f.homeId].name)}</option><option value="away">${esc(teamById[f.awayId].name)}</option></select></label>
    <div class="row"><button class="btn bad" type="submit">Record walkover</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
    $("#wf", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const lost = e.target.t.value;
      try {
        await data.saveFixture({ id: f.id, status: "finished", walkover: lost, homeScore: lost === "home" ? 0 : 3, awayScore: lost === "away" ? 0 : 3, scorers: [] });
        d.close(); toast("Walkover recorded. The table is updated."); rerender();
      } catch (ex) { toast(ex.message, true); }
    });
  });
}

function bestSelect(f, players, sel) {
  const pool = [...squadOf(players, f.homeId), ...squadOf(players, f.awayId)];
  return `<select name="best"><option value="">Not chosen</option>${pool.map((p) => `<option value="${esc(p.uid)}" ${sel === p.uid ? "selected" : ""}>${esc(p.name)} (${teamById[p.team].short})</option>`).join("")}</select>`;
}
const bestOf = (f, players, id) => { const p = players.find((x) => x.uid === id); return p ? { playerId: p.uid, name: p.name, teamId: p.team } : null; };

function fullTimeDialog(f, players, rerender) {
  dialog(`<form method="dialog" class="f" id="ftf" style="max-width:none"><h3>Full time: ${esc(teamById[f.homeId].short)} ${f.homeScore ?? 0} – ${f.awayScore ?? 0} ${esc(teamById[f.awayId].short)}</h3>
    <label>⭐ Best player of the game<span class="small muted" style="font-weight:500">optional</span>${bestSelect(f, players, f.best?.playerId)}</label>
    <div class="row"><label>${esc(teamById[f.homeId].short)} goalkeeper<input type="text" name="gh" maxlength="40" value="${esc(f.gk?.home || "")}" placeholder="for clean sheets"></label><label>${esc(teamById[f.awayId].short)} goalkeeper<input type="text" name="ga" maxlength="40" value="${esc(f.gk?.away || "")}" placeholder="for clean sheets"></label></div>
    <div class="row"><button class="btn bad" type="submit">Confirm full time</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`, (d) => {
    $("#ftf", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        await data.saveFixture({ id: f.id, status: "finished", best: bestOf(f, players, form.best.value), gk: { home: form.gh.value.trim(), away: form.ga.value.trim() } });
        d.close(); toast("Full time. The table is updated."); rerender();
      } catch (ex) { toast(ex.message, true); }
    });
  });
}

function resultDialog(f, players, rerender) {
  const pool = [...squadOf(players, f.homeId), ...squadOf(players, f.awayId)];
  const popts = (sel) => pool.length ? pool.map((p) => `<option value="${esc(p.uid)}" ${sel === p.uid ? "selected" : ""}>${esc(p.name)} (${teamById[p.team].short})</option>`).join("") : `<option value="">No players in the squads</option>`;
  const scorerRow = (s = {}) => `<div class="sc"><select aria-label="Scorer">${popts(s.playerId)}</select><input type="text" inputmode="numeric" maxlength="3" placeholder="Min" aria-label="Minute" value="${esc(s.minute || "")}"><button type="button" class="btn bad sm" data-rm aria-label="Remove">✕</button></div>`;
  const cardRow = (c = {}) => `<div class="sc cr"><select aria-label="Player">${popts(c.playerId)}</select><select aria-label="Card" style="max-width:130px">${CARD_TYPES.map(([v, l]) => `<option value="${v}" ${c.type === v ? "selected" : ""}>${l}</option>`).join("")}</select><input type="text" inputmode="numeric" maxlength="3" placeholder="Min" aria-label="Minute" value="${esc(c.minute || "")}"><button type="button" class="btn bad sm" data-rm aria-label="Remove">✕</button></div>`;
  dialog(`<form method="dialog" class="f" id="rf" style="max-width:none" novalidate>
    <h3>${f.status === "live" ? "Edit live score" : "Enter or edit result"}</h3>
    <div class="fx" style="margin:0"><div class="t h">${teamLabel(f.homeId, 26)}</div>
      <div class="mid inline" style="justify-content:center"><input type="number" min="0" max="99" name="hs" value="${f.homeScore ?? ""}" aria-label="${esc(teamById[f.homeId].name)} goals" required> <b>–</b> <input type="number" min="0" max="99" name="as" value="${f.awayScore ?? ""}" aria-label="${esc(teamById[f.awayId].name)} goals" required></div>
      <div class="t">${teamLabel(f.awayId, 26)}</div></div>
    <label>Match status<select name="st"><option value="finished" ${f.status !== "live" ? "selected" : ""}>Full time (final result)</option><option value="live" ${f.status === "live" ? "selected" : ""}>Still live</option></select></label>
    <div><div style="font-weight:600;font-size:13px;margin-bottom:6px">Goal scorers (optional)</div><div id="scs">${(f.scorers || []).map(scorerRow).join("")}</div>
      <button type="button" class="btn ghost sm" id="addsc" ${pool.length ? "" : "disabled"}>+ Add scorer</button></div>
    <div><div style="font-weight:600;font-size:13px;margin-bottom:6px">Cards (optional)</div><div id="cds">${(f.cards || []).map(cardRow).join("")}</div>
      <button type="button" class="btn ghost sm" id="addcd" ${pool.length ? "" : "disabled"}>+ Add card</button></div>
    <label>⭐ Best player${bestSelect(f, players, f.best?.playerId)}</label>
    <div class="row"><label>${esc(teamById[f.homeId].short)} goalkeeper<input type="text" name="gh" maxlength="40" value="${esc(f.gk?.home || "")}"></label><label>${esc(teamById[f.awayId].short)} goalkeeper<input type="text" name="ga" maxlength="40" value="${esc(f.gk?.away || "")}"></label></div>
    <div id="derr" class="note bad" hidden></div>
    <div class="row"><button class="btn" type="submit">Save</button>${f.status && f.status !== "scheduled" ? `<button class="btn bad" type="button" id="clr">Clear result</button>` : ""}<button class="btn ghost" type="button" data-close>Cancel</button></div>
  </form>`, (d) => {
    const wire = () => $$("[data-rm]", d).forEach((b) => (b.onclick = () => b.parentElement.remove()));
    wire();
    $("#addsc", d).addEventListener("click", () => { $("#scs", d).insertAdjacentHTML("beforeend", scorerRow()); wire(); });
    $("#addcd", d).addEventListener("click", () => { $("#cds", d).insertAdjacentHTML("beforeend", cardRow()); wire(); });
    $("#clr", d)?.addEventListener("click", async () => {
      if (!window.confirm("Clear the whole result and set the game back to not started?")) return;
      await data.saveFixture({ ...f, status: "scheduled", homeScore: null, awayScore: null, scorers: [], cards: [], best: null, walkover: null, gk: { home: "", away: "" } });
      d.close(); toast("Result cleared."); rerender();
    });
    $("#rf", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target, err = $("#derr", d);
      const hs = parseInt(form.hs.value, 10), as = parseInt(form.as.value, 10);
      if (!(hs >= 0) || !(as >= 0)) return (err.hidden = false, err.textContent = "Enter both scores (0 or more).");
      const scorers = $$("#scs .sc", d).map((row) => {
        const p = pool.find((x) => x.uid === $("select", row).value);
        return p ? { playerId: p.uid, name: p.name, teamId: p.team, minute: $("input", row).value.trim() } : null;
      }).filter(Boolean);
      const cards = $$("#cds .sc", d).map((row) => {
        const [ps, ts] = $$("select", row), p = pool.find((x) => x.uid === ps.value);
        return p ? { playerId: p.uid, name: p.name, teamId: p.team, type: ts.value, minute: $("input", row).value.trim() } : null;
      }).filter(Boolean);
      const hg = scorers.filter((s) => s.teamId === f.homeId).length, ag = scorers.filter((s) => s.teamId === f.awayId).length;
      if (hg > hs || ag > as) return (err.hidden = false, err.textContent = "More goal scorers than goals scored. Check the scores or remove a scorer.");
      try {
        await data.saveFixture({ ...f, status: form.st.value, homeScore: hs, awayScore: as, scorers, cards, best: bestOf(f, players, form.best.value), gk: { home: form.gh.value.trim(), away: form.ga.value.trim() } });
        d.close(); toast(form.st.value === "live" ? "Live score updated." : "Result saved. The table is updated."); rerender();
      } catch (ex) { err.hidden = false; err.textContent = ex.message; }
    });
  });
}

function tabLive(el, { fixtures, players, rerender }) {
  const list = sortFixtures(fixtures).filter((f) => f.matchDay === day);
  const liveAll = fixtures.filter((f) => f.status === "live");
  const byId = (id) => fixtures.find((f) => f.id === id);
  const card = (f) => {
    const st = f.status || "scheduled";
    const home = teamById[f.homeId], away = teamById[f.awayId];
    const mid = st === "scheduled" ? `<div class="score" style="font-size:20px">${esc(t5(SLOTS.find((s) => s.n === f.slot)?.start || "")) || "TBC"}</div>`
      : `<div class="score">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</div>${st === "live" ? `<div class="livetag"><span class="dot"></span>LIVE</div>` : `<div class="small muted">${f.walkover ? "WALKOVER" : "FT"}</div>`}`;
    const hasLu = f.lineup && ((f.lineup.home || []).length || (f.lineup.away || []).length);
    const id = esc(f.id);
    const luBtn = `<button class="btn ghost sm" data-lu="${id}">${hasLu ? "Line-up" : "Set line-up"}</button>`;
    const ctl = st === "scheduled"
      ? `<button class="btn sm" data-start="${id}">Start match</button>${luBtn}<button class="btn ghost sm" data-wo="${id}">Walkover</button><button class="btn ghost sm" data-res="${id}">Enter final result</button>`
      : st === "live"
        ? `<button class="btn sm" data-goal="home" data-id="${id}">⚽ ${esc(home.short)} goal</button><button class="btn sm" data-goal="away" data-id="${id}">⚽ ${esc(away.short)} goal</button>
           <button class="btn ghost sm" data-undo="home" data-id="${id}">Undo ${esc(home.short)}</button><button class="btn ghost sm" data-undo="away" data-id="${id}">Undo ${esc(away.short)}</button>
           <button class="btn ghost sm" data-card="${id}">🟨🟥 Card</button>${luBtn}<button class="btn ghost sm" data-res="${id}">Edit score</button><button class="btn bad sm" data-ft="${id}">Full time</button>`
        : `<button class="btn ghost sm" data-res="${id}">Edit result</button>${luBtn}`;
    return `<div class="fx${st === "live" ? " is-live" : ""}"><div class="t h">${teamLabel(f.homeId, 26)}</div><div class="mid">${mid}</div><div class="t">${teamLabel(f.awayId, 26)}</div>
      <div class="meta">${esc(slotName(f.slot))} · Match day ${f.matchDay}</div><div class="ctl">${ctl}</div></div>`;
  };
  el.innerHTML = `<p class="muted small" style="margin-top:0">Run a game: set the line-up, press <b>Start match</b>, tap <b>⚽ goal</b> each time a team scores, give cards, and press <b>Full time</b> at the end. Everyone watching sees every change within seconds.</p>
    ${liveAll.length ? `<div class="note" style="margin-bottom:12px"><b>${liveAll.length} game${liveAll.length === 1 ? " is" : "s are"} live now.</b> Match days with a red dot below.</div>` : ""}
    ${dayTabs(day, fixtures)}
    ${SLOTS.map((s) => {
      const g = list.filter((f) => f.slot === s.n);
      return g.length ? `<section class="round"><h3>${esc(s.name)} <small>${esc(slotRange(s.n))}</small></h3>${g.map(card).join("")}</section>` : "";
    }).join("") || `<div class="empty">No games on Match day ${day} yet. Add them on the Fixtures tab.</div>`}`;
  wireDays(el, rerender);
  $$("[data-res]", el).forEach((b) => b.addEventListener("click", () => resultDialog(byId(b.dataset.res), players, rerender)));
  $$("[data-lu]", el).forEach((b) => b.addEventListener("click", () => lineupDialog(byId(b.dataset.lu), players, rerender)));
  $$("[data-goal]", el).forEach((b) => b.addEventListener("click", () => goalDialog(byId(b.dataset.id), b.dataset.goal, players, rerender)));
  $$("[data-undo]", el).forEach((b) => b.addEventListener("click", () => undoGoal(byId(b.dataset.id), b.dataset.undo, rerender)));
  $$("[data-card]", el).forEach((b) => b.addEventListener("click", () => cardDialog(byId(b.dataset.card), players, rerender)));
  $$("[data-wo]", el).forEach((b) => b.addEventListener("click", () => walkoverDialog(byId(b.dataset.wo), rerender)));
  $$("[data-ft]", el).forEach((b) => b.addEventListener("click", () => fullTimeDialog(byId(b.dataset.ft), players, rerender)));
  $$("[data-start]", el).forEach((b) => b.addEventListener("click", () => {
    const f = byId(b.dataset.start);
    run(() => data.saveFixture({ id: f.id, status: "live", homeScore: 0, awayScore: 0, scorers: f.scorers || [] }), "Match started. It now shows LIVE on the site.", rerender);
  }));
}

// ================= cards, suspensions and fines =================
function tabDiscipline(el, { fixtures, players, meta, rerender }) {
  const susp = meta.suspensions || [];
  const dis = disciplineByTeam(fixtures);
  const paid = meta.paid || {};
  el.innerHTML = `<div class="card" style="margin-bottom:16px"><h3>⛔ Suspended players</h3>
    <p class="muted small" style="margin:4px 0 10px">Shown on the Stats page and on the club page. Remove a name when the suspension ends.</p>
    ${susp.length ? `<ul class="plain">${susp.map((s) => `<li class="spl"><span>${badge(s.teamId, 20)} <b>${esc(s.name)}</b> <span class="muted">· ${esc(teamById[s.teamId]?.short || "")}${s.reason ? " · " + esc(s.reason) : ""}</span></span><button class="btn bad sm" data-unsusp="${esc(s.id)}">Remove</button></li>`).join("")}</ul>` : `<p class="muted small">No suspensions.</p>`}
    <form class="row" id="sf" style="margin-top:12px"><label>Team<select name="t">${teamOpts("")}</select></label><label>Player<input type="text" name="n" list="sqlist" maxlength="60" placeholder="Name" required><datalist id="sqlist"></datalist></label><label>Reason (optional)<input type="text" name="r" maxlength="80" placeholder="e.g. red card, 1 game"></label><button class="btn sm" type="submit" style="flex:0 0 auto">Suspend</button></form></div>
    <div class="card"><h3>Cards and fines</h3>
    <p class="muted small" style="margin:4px 0 10px">Yellow ${naira(FINES.yellow)}, red or second yellow ${naira(FINES.red)}. Cards come from the results you record. Type what each team has paid.</p>
    <div class="tablewrap"><table style="min-width:0"><thead><tr><th class="team">Team</th><th>🟨</th><th>🟥</th><th>Owed</th><th>Paid (₦)</th><th>Balance</th></tr></thead>
    <tbody>${dis.map((r) => { const p = Number(paid[r.id] || 0); return `<tr><td class="team">${badge(r.id, 22)}<span>${esc(teamById[r.id].name)}</span></td><td>${r.yellow}</td><td>${r.red}</td><td>${naira(r.fine)}</td>
      <td><input type="number" min="0" step="50" data-paid="${r.id}" value="${p || ""}" style="width:90px;min-height:36px"></td><td style="color:${r.fine - p > 0 ? "var(--bad)" : "var(--ok)"}">${naira(r.fine - p)}</td></tr>`; }).join("")}</tbody></table></div>
    <button class="btn sm" id="spaid" style="margin-top:12px">Save payments</button></div>`;
  const sf = $("#sf", el);
  sf.t.addEventListener("change", () => { $("#sqlist", el).innerHTML = squadOf(players, sf.t.value).map((p) => `<option value="${esc(p.name)}">`).join(""); });
  sf.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!sf.t.value) return toast("Choose the team.", true);
    run(() => data.saveMeta({ suspensions: [...susp, { id: uid(), name: sf.n.value.trim(), teamId: sf.t.value, reason: sf.r.value.trim() }] }), "Suspension added.", rerender);
  });
  $$("[data-unsusp]", el).forEach((b) => b.addEventListener("click", () => run(() => data.saveMeta({ suspensions: susp.filter((s) => s.id !== b.dataset.unsusp) }), "Suspension removed.", rerender)));
  $("#spaid", el).addEventListener("click", () => {
    const next = {};
    $$("[data-paid]", el).forEach((i) => { if (Number(i.value) > 0) next[i.dataset.paid] = Number(i.value); });
    run(() => data.saveMeta({ paid: next }), "Payments saved.", rerender);
  });
}

// ================= stats overrides and table fixes =================
function tabStats(el, { fixtures, players, meta, rerender }) {
  const auto = topScorers(fixtures)[0];
  const cs = cleanSheets(fixtures, meta);
  const adj = meta.adjust || {};
  const all = [...players].sort((a, b) => teamById[a.team].name.localeCompare(teamById[b.team].name) || (a.ord || 0) - (b.ord || 0));
  const popts = (sel) => `<option value="">Choose a player…</option>${all.map((p) => `<option value="${esc(p.uid)}" ${sel === p.uid ? "selected" : ""}>${esc(p.name)} (${teamById[p.team].short})</option>`).join("")}`;
  const cols = ["p", "w", "d", "l", "gf", "ga", "pts"];
  el.innerHTML = `<p class="muted small" style="margin-top:0">Everything here updates by itself from your results. Use these boxes only to fix or set something by hand.</p>
    <div class="grid g2" style="margin-bottom:16px">
      <form class="card f" id="tsf" style="max-width:none"><h3>⚽ Top scorer</h3>
        <p class="muted small" style="margin:0">Automatic now: ${auto ? `<b>${esc(auto.name)}</b> (${auto.goals})` : "nobody yet"}${meta.topScorer ? `<br>Set by hand: <b>${esc(meta.topScorer.name)}</b> (${meta.topScorer.goals})` : ""}</p>
        <label>Player<select name="p">${popts(meta.topScorer?.playerId)}</select></label><label>Goals<input type="number" name="g" min="0" value="${meta.topScorer?.goals ?? ""}"></label>
        <div class="row"><button class="btn sm" type="submit">Set by hand</button><button class="btn ghost sm" type="button" id="tsc">Use automatic</button></div></form>
      <form class="card f" id="bpf" style="max-width:none"><h3>⭐ Best player of the league</h3>
        <p class="muted small" style="margin:0">${meta.bestPlayer ? `Set by hand: <b>${esc(meta.bestPlayer.name)}</b>` : "Automatic: the player with the most best-player awards."}</p>
        <label>Player<select name="p">${popts(meta.bestPlayer?.playerId)}</select></label>
        <div class="row"><button class="btn sm" type="submit">Set by hand</button><button class="btn ghost sm" type="button" id="bpc">Use automatic</button></div></form>
    </div>
    <form class="card f" id="csf" style="max-width:none;margin-bottom:16px"><h3>🧤 Clean sheets</h3>
      <p class="muted small" style="margin:0">Counted automatically from finished games. Type +1 or -1 to correct a team.</p>
      <div class="grid g4">${cs.map((r) => `<label>${esc(teamById[r.id].name)} <span class="muted small">(auto ${r.auto})</span><input type="number" data-cs="${r.id}" value="${meta.cleanSheets?.[r.id] || 0}"></label>`).join("")}</div>
      <button class="btn sm" type="submit" style="justify-self:start">Save clean sheets</button></form>
    <form class="card f" id="adf" style="max-width:none"><h3>📊 Fix the table by hand</h3>
      <p class="muted small" style="margin:0">These numbers are <b>added</b> to what the results already give. Use a minus for a deduction, for example -3 points. Leave 0 for no change.</p>
      <div class="adjscroll"><div class="adj h"><span></span>${cols.map((c) => `<span>${c.toUpperCase()}</span>`).join("")}</div>
      ${TEAMS.map((t) => `<div class="adj"><span class="tn">${badge(t.id, 20)}${esc(t.short)}</span>${cols.map((c) => `<input type="number" data-adj="${t.id}.${c}" value="${adj[t.id]?.[c] || 0}" aria-label="${esc(t.name)} ${c}">`).join("")}</div>`).join("")}</div>
      <button class="btn sm" type="submit" style="justify-self:start">Save table fixes</button></form>`;
  const who = (id) => { const p = players.find((x) => x.uid === id); return p && { playerId: p.uid, name: p.name, teamId: p.team }; };
  $("#tsf", el).addEventListener("submit", (e) => { e.preventDefault(); const w = who(e.target.p.value); if (!w) return toast("Choose a player.", true); run(() => data.saveMeta({ topScorer: { ...w, goals: Number(e.target.g.value) || 0 } }), "Top scorer set.", rerender); });
  $("#tsc", el).addEventListener("click", () => run(() => data.saveMeta({ topScorer: null }), "Top scorer is automatic again.", rerender));
  $("#bpf", el).addEventListener("submit", (e) => { e.preventDefault(); const w = who(e.target.p.value); if (!w) return toast("Choose a player.", true); run(() => data.saveMeta({ bestPlayer: w }), "Best player set.", rerender); });
  $("#bpc", el).addEventListener("click", () => run(() => data.saveMeta({ bestPlayer: null }), "Best player is automatic again.", rerender));
  $("#csf", el).addEventListener("submit", (e) => {
    e.preventDefault();
    const next = {};
    $$("[data-cs]", el).forEach((i) => { const v = parseInt(i.value, 10) || 0; if (v) next[i.dataset.cs] = v; });
    run(() => data.saveMeta({ cleanSheets: next }), "Clean sheets saved.", rerender);
  });
  $("#adf", el).addEventListener("submit", (e) => {
    e.preventDefault();
    const next = {};
    $$("[data-adj]", el).forEach((i) => { const [t, c] = i.dataset.adj.split("."), v = parseInt(i.value, 10) || 0; if (v) (next[t] ||= {})[c] = v; });
    run(() => data.saveMeta({ adjust: next }), "Table fixes saved.", rerender);
  });
}

// ================= rules =================
function tabRules(el, { meta, rerender }) {
  el.innerHTML = `<form class="f" id="rlf" style="max-width:none"><p class="muted small" style="margin:0">Edit the rules page. A line starting with <b>## </b> is a heading and a line starting with <b>- </b> is a point.</p>
    <textarea class="big" name="t">${esc(meta.rules || DEFAULT_RULES)}</textarea>
    <div class="row"><button class="btn" type="submit">Save rules</button><button class="btn ghost" type="button" id="rst">Reset to the original rules</button></div></form>`;
  $("#rlf", el).addEventListener("submit", (e) => { e.preventDefault(); run(() => data.saveMeta({ rules: e.target.t.value }), "Rules saved.", rerender); });
  $("#rst", el).addEventListener("click", () => { if (window.confirm("Replace your text with the original rules?")) run(() => data.saveMeta({ rules: null }), "Rules reset.", rerender); });
}

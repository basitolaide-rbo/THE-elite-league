import * as data from "./data.js";
import { TEAMS, teamById, badge } from "./teams.js";
import { LEAGUE, SLOTS, DEFAULT_RULES } from "./config.js";
import {
  esc, $, $$, DAYS, fmtDay, t5, slotName, slotRange, slotOf, teamLabel, sortFixtures, isStarted, dayTabs,
  computeTable, topScorers, cleanSheets, bestPlayers, disciplineByTeam, squadOf
} from "./ui.js";

const MAX = LEAGUE.playersPerTeam;

// ---------- shared pieces ----------
export function fixtureCard(f) {
  const done = f.status === "finished", live = f.status === "live";
  const started = done || live;
  const start = slotOf(f.slot)?.start;
  const mid = started
    ? `<div class="score" aria-label="${live ? "Live score" : "Final score"} ${f.homeScore ?? 0} to ${f.awayScore ?? 0}">${f.homeScore ?? 0} – ${f.awayScore ?? 0}</div>${live ? `<div class="livetag"><span class="dot"></span>LIVE</div>` : `<div class="small muted">${f.walkover ? "WALKOVER" : "FT"}</div>`}`
    : `<div class="score">${start ? esc(t5(start)) : "TBC"}</div><div class="small muted">vs</div>`;
  const sc = f.scorers || [];
  const side = (id) => sc.filter((s) => s.teamId === id).map((s) => `${esc(s.name)}${s.minute ? ` ${esc(s.minute)}'` : ""}`).join(", ");
  const cards = f.cards || [];
  const lu = f.lineup || {};
  const hasLu = (lu.home || []).length || (lu.away || []).length;
  const col = (list) => `<ol class="names">${(list || []).map((p) => `<li>${esc(p.name)}</li>`).join("") || "<li class='muted'>Not announced</li>"}</ol>`;
  return `<div class="fx${live ? " is-live" : ""}">
    <div class="t h">${teamLabel(f.homeId, 30)}</div>
    <div class="mid">${mid}</div>
    <div class="t">${teamLabel(f.awayId, 30)}</div>
    <div class="meta">${f.matchDay ? `Match day ${f.matchDay}` : ""}${f.slot ? ` · ${esc(slotName(f.slot))}` : ""}${f.venue ? " · " + esc(f.venue) : ""}</div>
    ${started && sc.length ? `<div class="gs"><span>⚽ ${side(f.homeId) || "—"}</span><span>${side(f.awayId) || "—"} ⚽</span></div>` : ""}
    ${started && cards.length ? `<div class="cds">${cards.map((c) => `<span class="cdn"><i class="${c.type === "yellow" ? "yc" : "rc"}"></i>${esc(c.name)}${c.minute ? ` ${esc(c.minute)}'` : ""}</span>`).join("")}</div>` : ""}
    ${done && f.best?.name ? `<div class="best">⭐ Best player: <b>${esc(f.best.name)}</b> <span class="muted">(${esc(teamById[f.best.teamId]?.short || "")})</span></div>` : ""}
    ${hasLu ? `<details class="lu" ${live ? "open" : ""}><summary>Line-ups</summary><div class="lucols"><div><b>${esc(teamById[f.homeId]?.name || "")}</b>${col(lu.home)}</div><div><b>${esc(teamById[f.awayId]?.name || "")}</b>${col(lu.away)}</div></div></details>` : ""}
  </div>`;
}

const nextOf = (list) => sortFixtures(list).find((f) => f.status !== "finished" && f.status !== "live");

// ---------- pages ----------
export async function home(el) {
  const [fixtures, players, meta] = await Promise.all([data.getFixtures(), data.getPlayers(), data.getMeta()]);
  const liveNow = sortFixtures(fixtures).filter((f) => f.status === "live");
  const next = nextOf(fixtures);
  const rows = computeTable(fixtures, meta);
  const played = fixtures.filter((f) => f.status === "finished").length;
  const goals = fixtures.filter(isStarted).reduce((s, f) => s + (f.homeScore || 0) + (f.awayScore || 0), 0);
  const ts = meta.topScorer || topScorers(fixtures)[0];
  const bp = meta.bestPlayer || bestPlayers(fixtures)[0];
  const cs = cleanSheets(fixtures, meta)[0];
  const leader = rows[0].p ? rows[0] : null;
  const hl = (icon, label, big, small) => `<div class="card hl"><div class="ic">${icon}</div><span>${label}</span><b>${big}</b><small>${small}</small></div>`;
  el.innerHTML = `
  <section class="hero">
    <img src="logo.png" alt="Elite Premier League crest">
    <p class="kicker">Season ${esc(LEAGUE.season)}</p>
    <h1>Welcome to the Elite Premier League</h1>
    <p>Eight clubs. Seven match days. One champion. Follow every game, every goal and the table live, and cheer on your team.</p>
    <div class="btns"><a class="btn" href="#/fixtures">Fixtures &amp; live scores</a><a class="btn ghost" href="#/table">League table</a></div>
  </section>
  ${liveNow.length ? `<h2><span class="livetag big"><span class="dot"></span>LIVE NOW</span></h2>${liveNow.map(fixtureCard).join("")}` : ""}
  ${next ? `<h2 style="margin-top:6px">Next match</h2>${fixtureCard(next)}` : (!liveNow.length ? `<div class="empty">The match days will appear here as soon as the committee adds the games. Get your boots ready! ⚽</div>` : "")}
  <h2 style="margin-top:24px">League highlights</h2>
  <div class="grid g4 hls">
    ${hl("👑", "Leaders", leader ? esc(teamById[leader.id].name) : "To be decided", leader ? `${leader.pts} points` : "After the first game")}
    ${hl("⚽", "Top scorer", ts ? esc(ts.name) : "To be decided", ts ? `${esc(teamById[ts.teamId]?.short || "")} · ${ts.goals} goal${ts.goals === 1 ? "" : "s"}` : "No goals yet")}
    ${hl("⭐", "Best player", bp ? esc(bp.name) : "To be decided", bp ? esc(teamById[bp.teamId]?.short || "") : "Chosen after each game")}
    ${hl("🧤", "Clean sheets", cs && cs.n ? esc(teamById[cs.id].name) : "None yet", cs && cs.n ? `${cs.n} clean sheet${cs.n === 1 ? "" : "s"}` : "Keep it tight")}
  </div>
  <p class="muted small" style="margin:10px 0 0">${played} game${played === 1 ? "" : "s"} played · ${goals} goal${goals === 1 ? "" : "s"} scored</p>
  <h2 style="margin-top:24px">The clubs</h2>
  <div class="grid g4">${rows.map((r, i) => `<a class="card stat club" href="#/team/${r.id}">${badge(r.id, 58)}<div class="cn">${esc(teamById[r.id].name)}</div><span>Position ${i + 1} · ${r.pts} pts</span></a>`).join("")}</div>`;
}

let curDay = 1, picked = false;
export async function fixtures(el) {
  const [list, meta] = await Promise.all([data.getFixtures(), data.getMeta()]);
  if (!picked) {
    const live = sortFixtures(list).find((f) => f.status === "live");
    curDay = ((live || nextOf(list) || {}).matchDay) || 1;
  }
  const day = sortFixtures(list).filter((f) => f.matchDay === curDay);
  const date = meta.dates?.[curDay];
  el.innerHTML = `<h2>Fixtures &amp; live scores</h2>
    ${dayTabs(curDay, list)}
    <p class="daydate">${date ? esc(fmtDay(date)) : "Date to be announced"} · ${esc(LEAGUE.venue)}</p>
    ${SLOTS.map((s) => {
      const g = day.filter((f) => f.slot === s.n);
      return `<section class="round"><h3>${esc(s.name)} <small>${esc(t5(s.start))} – ${esc(t5(s.end))}</small></h3>${g.length ? g.map(fixtureCard).join("") : `<div class="empty slim">No games added yet.</div>`}</section>`;
    }).join("")}
    ${day.filter((f) => !slotOf(f.slot)).map(fixtureCard).join("")}`;
  $$("[data-day]", el).forEach((b) => b.addEventListener("click", () => { curDay = Number(b.dataset.day); picked = true; fixtures(el); }));
}

export async function table(el) {
  const [list, meta] = await Promise.all([data.getFixtures(), data.getMeta()]);
  const rows = computeTable(list, meta);
  const any = rows.some((r) => r.p);
  el.innerHTML = `<h2>League table</h2>
  ${any ? "" : `<p class="muted small" style="margin-top:-6px">Teams are listed alphabetically until the first results are recorded.</p>`}
  <div class="tablewrap"><table><thead><tr><th>#</th><th class="team">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
  <tbody>${rows.map((r, i) => `<tr class="${i === 0 && r.p ? "p1" : ""}"><td>${i + 1}</td><td class="team"><a href="#/team/${r.id}">${badge(r.id, 28)}<span>${esc(teamById[r.id].name)}</span></a></td>
    <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts">${r.pts}</td></tr>`).join("")}</tbody></table></div>
  <div class="card" style="margin-top:16px"><h3>How ties are broken</h3>
    <p class="muted small" style="margin:4px 0 8px">Teams level on points are ranked using these criteria, in order:</p>
    <ol class="rules"><li>Points (win 3, draw 1, loss 0)</li><li>Goal difference</li><li>Goals scored</li><li>Head-to-head result between the tied teams</li>
    <li>Fair play record, with the fewest disciplinary points (yellow card 1, second yellow 3, straight red 4)</li><li>Walkovers</li></ol>
    <p class="muted small" style="margin:8px 0 0">A team that is not ready to play within 5 minutes of kick-off loses by walkover. A walkover counts as a 3–0 win for the opposing team.</p></div>`;
}

export async function teams(el) {
  const [players, list, meta] = await Promise.all([data.getPlayers(), data.getFixtures(), data.getMeta()]);
  const rows = computeTable(list, meta);
  el.innerHTML = `<h2>Teams &amp; squads</h2><p class="muted small" style="margin-top:-6px">Tap a club to see its squad and results.</p><div class="grid g2">${TEAMS.map((t) => {
    const n = squadOf(players, t.id).length, pos = rows.findIndex((r) => r.id === t.id) + 1, r = rows[pos - 1];
    return `<a class="card clubcard" href="#/team/${t.id}" style="--c1:${t.c1}"><div class="teamhead">${badge(t.id, 50)}<div><h3>${esc(t.name)}</h3>
      <span class="pill ${n >= MAX ? "ok" : ""}">${n}/${MAX} players</span> <span class="pill">Position ${pos}</span> <span class="pill">${r.pts} pts</span></div></div></a>`;
  }).join("")}</div>`;
}

export async function team(el, _ctx, id) {
  const t = teamById[id];
  if (!t) { el.innerHTML = `<div class="empty">Club not found. <a href="#/teams">All teams</a></div>`; return; }
  const [players, list, meta] = await Promise.all([data.getPlayers(), data.getFixtures(), data.getMeta()]);
  const rows = computeTable(list, meta);
  const pos = rows.findIndex((r) => r.id === id) + 1, r = rows[pos - 1];
  const sq = squadOf(players, id);
  const susp = (meta.suspensions || []).filter((s) => s.teamId === id);
  const mine = sortFixtures(list).filter((f) => f.homeId === id || f.awayId === id);
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  el.innerHTML = `<p><a href="#/teams">← All teams</a></p>
  <section class="teamhero" style="--c1:${t.c1};--c2:${t.c2}">${badge(id, 84)}<div><h1>${esc(t.name)}</h1><span class="muted">Elite Premier League · Season ${esc(LEAGUE.season)}</span></div></section>
  <div class="grid g4" style="margin:16px 0">
    <div class="card stat"><b>${pos}</b><span>Position</span></div>
    <div class="card stat"><b>${r.pts}</b><span>Points</span></div>
    <div class="card stat"><b>${r.w}-${r.d}-${r.l}</b><span>W-D-L</span></div>
    <div class="card stat"><b>${sq.length}</b><span>Players</span></div>
  </div>
  <h2>Squad</h2><p class="muted small" style="margin-top:-8px">Up to ${MAX} players</p>
  ${sq.length ? `<div class="shirts">${sq.map((p, i) => {
    const out = susp.some((s) => s.name === p.name);
    return `<div class="shirt${out ? " out" : ""}" style="--c1:${t.c1};--c2:${t.c2};--ink:${t.ink}"><div class="no">${i + 1}</div><div class="pn"><b>${esc(p.name)}</b>${out ? `<small>Suspended</small>` : ""}</div></div>`;
  }).join("")}</div>` : `<div class="empty">Squad will be announced soon.</div>`}
  <h2 style="margin-top:22px">Games</h2>
  ${mine.length ? mine.map(fixtureCard).join("") : `<div class="empty">No games added yet.</div>`}`;
}

export async function stats(el) {
  const [list, meta] = await Promise.all([data.getFixtures(), data.getMeta()]);
  const scorers = topScorers(list);
  const ts = meta.topScorer ? { ...meta.topScorer } : scorers[0];
  const best = bestPlayers(list);
  const bp = meta.bestPlayer || best[0];
  const cs = cleanSheets(list, meta);
  const dis = disciplineByTeam(list);
  const susp = meta.suspensions || [];
  const goals = list.filter(isStarted).reduce((s, f) => s + (f.homeScore || 0) + (f.awayScore || 0), 0);
  const played = list.filter((f) => f.status === "finished").length;
  el.innerHTML = `<h2>Stats</h2><p class="muted small" style="margin-top:-6px">Goals, cards and suspensions, updated as results are confirmed.</p>
  <div class="grid g4" style="margin-bottom:18px">
    <div class="card stat"><b>${played}</b><span>Games played</span></div>
    <div class="card stat"><b>${goals}</b><span>Goals scored</span></div>
    <div class="card stat"><b>${played ? (goals / played).toFixed(1) : "0.0"}</b><span>Goals per game</span></div>
  </div>
  <div class="grid g2">
    <section class="card"><h3>⚽ Top scorers</h3>${scorers.length || ts ? `<ol class="rank">${(meta.topScorer ? [ts, ...scorers.filter((s) => s.name !== ts.name)] : scorers).slice(0, 10).map((s) => `<li><b>${esc(s.name)}</b> <span class="muted">· ${esc(teamById[s.teamId]?.name || "")}</span> <b class="gl">${s.goals}</b></li>`).join("")}</ol>` : `<p class="muted">No goals recorded yet.</p>`}</section>
    <section class="card"><h3>⭐ Best player</h3>${bp ? `<p class="bigname">${esc(bp.name)}</p><p class="muted" style="margin:0">${esc(teamById[bp.teamId]?.name || "")}${bp.awards ? ` · ${bp.awards} best-player award${bp.awards === 1 ? "" : "s"}` : ""}</p>` : `<p class="muted">Chosen by the committee after each game.</p>`}
      ${best.length > 1 || (best.length && meta.bestPlayer) ? `<ol class="rank" style="margin-top:10px">${best.slice(0, 5).map((s) => `<li>${esc(s.name)} <span class="muted">· ${esc(teamById[s.teamId]?.short || "")}</span> <b class="gl">${s.awards}</b></li>`).join("")}</ol>` : ""}</section>
    <section class="card"><h3>🧤 Clean sheets</h3>${cs.some((r) => r.n) ? `<ol class="rank">${cs.filter((r) => r.n).map((r) => `<li><b>${esc(teamById[r.id].name)}</b>${r.keepers.length ? ` <span class="muted">· ${esc(r.keepers.join(", "))}</span>` : ""} <b class="gl">${r.n}</b></li>`).join("")}</ol>` : `<p class="muted">No clean sheets yet.</p>`}</section>
    <section class="card"><h3>🟨🟥 Fair play</h3><div class="tablewrap"><table style="min-width:0"><thead><tr><th class="team">Team</th><th>Yellow</th><th>Red</th></tr></thead>
      <tbody>${dis.map((r) => `<tr><td class="team">${badge(r.id, 22)}<span>${esc(teamById[r.id].name)}</span></td><td>${r.yellow}</td><td>${r.red}</td></tr>`).join("")}</tbody></table></div></section>
  </div>
  <section class="card" style="margin-top:14px"><h3>⛔ Suspensions</h3>${susp.length ? TEAMS.filter((t) => susp.some((s) => s.teamId === t.id)).map((t) => `<div class="susp"><div class="sh">${badge(t.id, 22)}<b>${esc(t.name)}</b></div><ul>${susp.filter((s) => s.teamId === t.id).map((s) => `<li>${esc(s.name)}${s.reason ? ` <span class="muted">· ${esc(s.reason)}</span>` : ""}</li>`).join("")}</ul></div>`).join("") : `<p class="muted">No suspensions at the moment.</p>`}</section>`;
}

export async function rules(el) {
  const meta = await data.getMeta();
  const text = (meta.rules || DEFAULT_RULES).replace(/\r/g, "");
  let html = "", open = false;
  text.split("\n").forEach((line) => {
    const l = line.trim();
    if (!l) return;
    if (l.startsWith("## ")) { if (open) html += "</ul>"; open = false; html += `<h3>${esc(l.slice(3))}</h3>`; }
    else if (l.startsWith("- ")) { if (!open) { html += `<ul>`; open = true; } html += `<li>${esc(l.slice(2))}</li>`; }
    else { if (open) html += "</ul>"; open = false; html += `<p>${esc(l)}</p>`; }
  });
  if (open) html += "</ul>";
  el.innerHTML = `<p class="kicker" style="text-align:left">Official rules · ${esc(LEAGUE.season)} season</p><h2>Rules</h2><p class="muted" style="margin-top:-6px">Elite Premier League football rules summary.</p><div class="card rulesbox">${html}</div>`;
}

let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
export function install(el) {
  el.innerHTML = `<h2>Get the app</h2>
  <p class="muted">Put Elite Premier League on your home screen. It opens like an app, with no app store.</p>
  ${deferred ? `<p><button class="btn" id="inst">Install now</button></p>` : ""}
  <div class="grid g2">
    <div class="card"><h3>Android (Chrome)</h3><ol class="steps"><li>Open this site in Chrome.</li><li>Tap the ⋮ menu.</li><li>Tap “Install app” or “Add to Home screen”.</li><li>Tap Install.</li></ol></div>
    <div class="card"><h3>iPhone (Safari)</h3><ol class="steps"><li>Open this site in Safari.</li><li>Tap the Share button.</li><li>Tap “Add to Home Screen”.</li><li>Tap Add.</li></ol></div>
  </div>`;
  $("#inst", el)?.addEventListener("click", async () => { deferred.prompt(); await deferred.userChoice; deferred = null; });
}

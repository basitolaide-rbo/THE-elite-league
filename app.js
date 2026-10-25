import * as data from "./data.js";
import * as pages from "./pages.js";
import { admin } from "./admin.js";
import { esc, $, $$ } from "./ui.js";

const ROUTES = {
  "/": pages.home, "/fixtures": pages.fixtures, "/table": pages.table, "/teams": pages.teams,
  "/stats": pages.stats, "/rules": pages.rules, "/install": pages.install,
  "/admin": admin
};
const NAV = [["/", "Home"], ["/fixtures", "Fixtures"], ["/table", "Table"], ["/teams", "Teams"], ["/stats", "Stats"], ["/rules", "Rules"]];

const ctx = { user: undefined, go: (h) => { location.hash = h; } };
const view = $("#view");
let seq = 0;
let unsub = null;
const LIVE_PAGES = new Set(["/", "/fixtures", "/table", "/teams", "/stats", "/rules"]);

function path() { return (location.hash.replace(/^#/, "") || "/").split("?")[0]; }

const on = (p, href) => p === href || (href === "/teams" && p.startsWith("/team/"));
function drawNav() {
  const p = path();
  $("#nav").innerHTML = NAV.map(([href, label, cls]) => `<a href="#${href}" class="${cls || ""} ${on(p, href) ? "on" : ""}" ${on(p, href) ? 'aria-current="page"' : ""}>${esc(label)}</a>`).join("");
}

async function render(silent = false) {
  const mine = ++seq;
  drawNav();
  if (ctx.user === undefined) return; // wait for the first auth answer
  const p = path();
  const fn = ROUTES[p] || (p.startsWith("/team/") ? (el, c) => pages.team(el, c, p.slice(6)) : ROUTES["/"]);
  if (!silent) {
    view.innerHTML = `<p class="loading">Loading…</p>`;
    // public pages refresh by themselves when the admin changes a score, line-up or squad
    unsub?.(); unsub = null;
    if ((LIVE_PAGES.has(path()) || path().startsWith("/team/")) && data.onChange) {
      let t;
      unsub = data.onChange(() => { clearTimeout(t); t = setTimeout(() => render(true), 150); });
    }
  }
  try {
    const keep = silent ? window.scrollY : 0;
    await fn(view, ctx);
    if (mine === seq) window.scrollTo({ top: keep });
  } catch (e) {
    console.error(e);
    if (mine === seq) view.innerHTML = `<div class="note bad"><b>Something went wrong.</b> ${esc(e.message || "Please refresh and try again.")}</div>`;
  }
}

if (data.mode === "demo") $("#demo-banner").hidden = false;
window.addEventListener("hashchange", () => render());
data.onAuth((u) => { const first = ctx.user === undefined; ctx.user = u; render(); if (first) $("#nav").dataset.ready = "1"; });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

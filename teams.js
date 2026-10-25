// The 8 league teams. Badges are original designs in each club's colours (real crests are trademarked).
export const TEAMS = [
  { id: "mun", name: "Manchester United", short: "MUN", c1: "#c8102e", c2: "#111111", ink: "#ffffff" },
  { id: "ars", name: "Arsenal",           short: "ARS", c1: "#e11b22", c2: "#ffffff", ink: "#ffffff" },
  { id: "che", name: "Chelsea",           short: "CHE", c1: "#0a4db3", c2: "#0a2a66", ink: "#ffffff" },
  { id: "liv", name: "Liverpool",         short: "LIV", c1: "#b5121b", c2: "#f6eb61", ink: "#ffffff" },
  { id: "mci", name: "Manchester City",   short: "MCI", c1: "#6cabdd", c2: "#1c2c5b", ink: "#0b1a3a" },
  { id: "rma", name: "Real Madrid",       short: "RMA", c1: "#f4f1e8", c2: "#c9a227", ink: "#1b1b3a" },
  { id: "bar", name: "Barcelona",         short: "BAR", c1: "#a50044", c2: "#004d98", ink: "#ffffff" },
  { id: "bay", name: "Bayern Munich",     short: "BAY", c1: "#dc052d", c2: "#0066b2", ink: "#ffffff" }
];

export const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]));

let n = 0;
export function badge(teamId, size = 40) {
  const t = teamById[teamId];
  if (!t) return "";
  const id = `b${teamId}${n++}`;
  return `<svg class="badge" width="${size}" height="${Math.round(size * 1.18)}" viewBox="0 0 100 118" role="img" aria-label="${t.name} badge">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset=".62" stop-color="${t.c1}"/><stop offset=".63" stop-color="${t.c2}"/><stop offset="1" stop-color="${t.c2}"/></linearGradient></defs>
<path d="M50 3 L93 14 V60 C93 88 74 106 50 115 C26 106 7 88 7 60 V14 Z" fill="url(#${id})" stroke="#ffffff" stroke-opacity=".85" stroke-width="3.5" stroke-linejoin="round"/>
<text x="50" y="66" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="29" letter-spacing=".5" fill="${t.ink}" stroke="rgba(0,0,0,.35)" stroke-width=".6">${t.short}</text>
</svg>`;
}

// ELITE PREMIER LEAGUE - site settings.
// The site finds its own GitHub repo from its address (USERNAME.github.io/REPO). Nothing to fill in.
// Opened from a computer folder or localhost it runs in DEMO MODE (data kept only in that browser).

export const GITHUB = { owner: "", repo: "", branch: "main", path: "data.json" };

// Shown in the admin panel.
export const ADMIN_EMAIL = "solomonoladimeji18@gmail.com";

export const LEAGUE = {
  name: "Elite Premier League",
  season: "2026",
  playersPerTeam: 8,
  matchDays: 7,
  venue: "Crescendo Sports"
};

// The four match slots of every match day.
export const SLOTS = [
  { n: 1, name: "First match",  start: "07:45:00", end: "08:48:45" },
  { n: 2, name: "Second match", start: "08:48:45", end: "09:52:30" },
  { n: 3, name: "Third match",  start: "09:52:30", end: "10:56:15" },
  { n: 4, name: "Fourth match", start: "10:56:15", end: "12:00:00" }
];

// Fair play points used to break ties in the table, and the fines (naira).
export const FAIRPLAY = { yellow: 1, yellow2: 3, red: 4 };
export const FINES = { yellow: 200, red: 500 };

// Put each team's player names here (up to 8 per team) and the admin gets a one-click
// "Load starting squads" button on the Squads tab. Team ids: mun ars che liv mci rma bar bay.
export const STARTING_SQUADS = {
  mun: ["Marcus Baleba", "Cubrasi", "Bush", "Adebayo", "Ope", "Rico", "Tee-Jay", "Lumi"],
  ars: ["Kenny", "Baashh", "Bayern", "Baron Finest", "Mr. Denis", "Showon", "Mr Tolu", "Ozil"],
  che: ["Oju", "DJ Meen", "Radap", "Tiger", "Walexxy", "Muller", "Ope Biggy", "MC"],
  liv: ["Ori Owo", "Oluwatosin", "Pepe", "Friz", "SHK", "HMD", "Coded", "Flawless"],
  mci: ["Cash", "Kelvin", "Kusa", "Wolfgang", "Sam Dee", "Wizzy", "Gucci", "Papi"],
  rma: ["Walex Bnxn", "Kenny", "King", "Flames", "Sheriff", "Seun", "Bidemi", "Deji"],
  bar: ["Big Tanny", "Sodiq", "Opzy", "Promo", "Gtee", "Surpass", "Jubril", "Marthins"],
  bay: ["Jolex", "Tee Smart", "Don Lilpent", "Dada", "Soft", "Ajanbadan", "Maka", "AY Promo"]
};

// The rules page. The admin can edit this text on the Rules tab. "## " starts a heading, "- " starts a point.
export const DEFAULT_RULES = `## 1. Players & Kit
- 8 players per team maximum: 6 on the pitch, one of whom must be the goalkeeper.
- Minimum 4 players to start a game.
- Same colour shirts, with the goalkeeper in a different colour. Bibs are available.
- Shin guards and knee socks are advised.
- Teams must take pictures before or after the 2nd match.
## 2. Referee
- Respect the referee. No dissent. All decisions are final.
## 3. Match Time
- 10 minutes per half.
- 5 minutes late coming = walkover. The opponent gets 3 points.
## 4. Substitutions
- Unlimited substitutions, but the referee must be informed.
- Substitutions are only made when play has stopped, and at the referee's signal.
## 5. Fouls, Kicks & Goals
- All fouls are punished by the referee.
- Free kicks can be direct or indirect. Defenders stand 5 yards away.
- NO OFFSIDES.
- Goal kick: short or long, with opponents out of the box.
- Corner kick: short or long, with opponents 5 yards away.
- Throw-in: kick or throw with both hands within 5 seconds. Opponents stand 5 yards away.
- A goal can be scored directly from kick-off.
## 6. Discipline & Fans
- Teams are responsible for their fans' behaviour. Troublesome teams or fans will be expelled from the league.
- All cards are reported to the coordinator.
## 7. Fines
- Yellow card: ₦200
- Red card: ₦500
- Fines must be paid`;

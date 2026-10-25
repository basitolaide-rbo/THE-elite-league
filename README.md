# Elite Premier League 2026

Live site for the Elite Premier League: Match day 1 to 7, live scores, league table, club pages, stats and rules.
No server and no database. All league data is in `data.json` in this repository.

## Files
| File | What it is |
|---|---|
| `index.html` | The page |
| `app.css` | All the styling |
| `app.js`, `pages.js`, `admin.js`, `ui.js`, `teams.js` | The site code |
| `config.js` | League settings, time slots, starting squads and the default rules |
| `data.js`, `backend-github.js`, `backend-demo.js` | Where the data is read and saved |
| `data.json` | The league data (squads, games, scores, cards, settings) |
| `sw.js`, `manifest.webmanifest` | Lets people install it on their phone |
| `logo.png`, `favicon.png`, `icon-192.png`, `icon-512.png`, `og.png` | Images |

## Put it online
1. Upload every file in this folder to the repository root.
2. Settings > Pages > Deploy from a branch > `main` / `(root)` > Save.
3. After about 2 minutes the site is at `https://USERNAME.github.io/REPOSITORY/`.

## Admin
1. Make a key: GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate.
   Choose only this repository and set Contents to Read and write.
2. Open the site address with `#/admin` on the end, paste the key, sign in.
3. **Squads:** click Load starting squads (all 8 teams), or add names by hand (8 max per team).
4. **Fixtures:** set the date of each match day, then add games. Each game has a match day (1 to 7), a time slot
   (First to Fourth match), two teams and the venue (Crescendo Sports).
5. **Live & results:** Start match, goal, card, Full time (with best player), walkover (3-0), edit anything afterwards.
6. **Cards & fines:** suspended players per team, and what each team has paid in fines.
7. **Stats & table:** set top scorer, best player and clean sheets by hand, or fix table rows (+ or - points/goals).
8. **Rules:** edit the rules text.

Viewers see changes within about 15 seconds. Keep the admin key private. Anyone who has it can change the league.

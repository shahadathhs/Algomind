# Algomind — Game App Screens

Concept renders of every screen in the Android game, in both themes (light and dark). They are design targets, not final art: fonts are placeholders and values will be tuned when the visual-design doc and tokens are written.

Overview sheets: [overview-light.png](overview-light.png) · [overview-dark.png](overview-dark.png)

Individual screens (390 × 844, 2x): `screens/light/` and `screens/dark/`.

| # | Screen | Purpose and states |
|---|---|---|
| 01 | Menu | Wordmark, hero board, Play (primary), Levels, Settings, Account |
| 02 | Worlds | List of worlds: solved, current, locked, and not-downloaded states; continue button |
| 03 | World | One world: its chapters, each with level tiles (solved, current, locked) |
| 04 | Tutorial | Level 1 with a coach callout teaching the first command |
| 05 | Game, ready | Editing a program: tape, command palette, Step / Run / Reset |
| 06 | Game, running | Tape slides under the read-head; Continue, Step, Reset |
| 07 | Game, failed | Plain-language reason, hit wall marked, failing command marked, Edit program |
| 08 | Game, solved | Result stats (commands, steps, best), Next level, Replay, Levels |
| 09 | Hint | Hint text over the game, Next hint, Close |
| 10 | Pause | Resume (primary), Restart, How to play, Settings, Back to levels |
| 11 | Settings | Sound, music, vibration, reduce motion, run speed, theme (system / light / dark) |
| 12 | Sign in | Optional account; guest play is the default |
| 13 | Account | Signed in: sync status, progress summary, Sync now, Sign out, Delete account |
| 14 | Load error | Level could not load; Retry, play a downloaded level |
| 15 | Update required | Level needs a newer app version (unsupported mechanic or schema) |

## Not in this set

- **Leaderboard:** out of scope until the score and verification design exists.
- **Admin dashboard:** five key screens are rendered under `dashboard/` (below); the remaining dashboard screens (sign in, home, capabilities, import, audit log, settings) are listed in the dashboard plan and not yet rendered.
- **Motion:** the tape sliding, the read-head, and run animation are described in the design doc, not shown in still images.

## Web renders

The public site is planned in [../README_WEB_PLAN.md](../README_WEB_PLAN.md). Renders (placeholders for version, size, hash, release notes, and QR):

| Page | Light | Dark |
|---|---|---|
| Landing, desktop | [web/light/landing-desktop.png](web/light/landing-desktop.png) | [web/dark/landing-desktop.png](web/dark/landing-desktop.png) |
| Landing, mobile | [web/light/landing-mobile.png](web/light/landing-mobile.png) | [web/dark/landing-mobile.png](web/dark/landing-mobile.png) |
| Download, desktop | [web/light/download-desktop.png](web/light/download-desktop.png) | [web/dark/download-desktop.png](web/dark/download-desktop.png) |
| Download, mobile | [web/light/download-mobile.png](web/light/download-mobile.png) | [web/dark/download-mobile.png](web/dark/download-mobile.png) |

## Dashboard renders

The dashboard is planned in [../README_DASHBOARD_PLAN.md](../README_DASHBOARD_PLAN.md). Renders at 1440 px wide (names and numbers are placeholders):

| Screen | Light | Dark |
|---|---|---|
| Levels | [dashboard/light/01-levels.png](dashboard/light/01-levels.png) | [dashboard/dark/01-levels.png](dashboard/dark/01-levels.png) |
| Level editor (Board tab) | [dashboard/light/02-editor.png](dashboard/light/02-editor.png) | [dashboard/dark/02-editor.png](dashboard/dark/02-editor.png) |
| Publish review | [dashboard/light/03-publish.png](dashboard/light/03-publish.png) | [dashboard/dark/03-publish.png](dashboard/dark/03-publish.png) |
| Version history | [dashboard/light/04-history.png](dashboard/light/04-history.png) | [dashboard/dark/04-history.png](dashboard/dark/04-history.png) |
| Campaign structure | [dashboard/light/05-campaign.png](dashboard/light/05-campaign.png) | [dashboard/dark/05-campaign.png](dashboard/dark/05-campaign.png) |

# Algomind — Game App Screens

Concept renders of every screen in the Android game, in both themes (light and dark). They are design targets, not final art: fonts are placeholders and values will be tuned when the visual-design doc and tokens are written.

Overview sheets: [overview-light.png](overview-light.png) · [overview-dark.png](overview-dark.png)

Individual screens (390 × 844, 2x): `screens/light/` and `screens/dark/`.

| # | Screen | Purpose and states |
|---|---|---|
| 01 | Menu | Wordmark, hero board, Play (primary), Levels, Settings, Account |
| 02 | Levels | Campaign grid. Solved, current, locked, and not-downloaded states; offline note |
| 03 | Tutorial | Level 1 with a coach callout teaching the first command |
| 04 | Game, ready | Editing a program: tape, command palette, Step / Run / Reset |
| 05 | Game, running | Tape slides under the read-head; Continue, Step, Reset |
| 06 | Game, failed | Plain-language reason, hit wall marked, failing command marked, Edit program |
| 07 | Game, solved | Result stats (commands, steps, best), Next level, Replay, Levels |
| 08 | Hint | Hint text over the game, Next hint, Close |
| 09 | Pause | Resume (primary), Restart, How to play, Settings, Back to levels |
| 10 | Settings | Sound, music, vibration, reduce motion, run speed, theme (system / light / dark) |
| 11 | Sign in | Optional account; guest play is the default |
| 12 | Account | Signed in: sync status, progress summary, Sync now, Sign out, Delete account |
| 13 | Load error | Level could not load; Retry, play a downloaded level |
| 14 | Update required | Level needs a newer app version (unsupported mechanic or schema) |

## Not in this set

- **Leaderboard:** out of scope until the score and verification design exists.
- **Web screens:** the public website and the admin dashboard are separate sets, to be designed next.
- **Motion:** the tape sliding, the read-head, and run animation are described in the design doc, not shown in still images.

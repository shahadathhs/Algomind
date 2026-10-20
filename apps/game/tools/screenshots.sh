#!/bin/sh
# Debug-only screenshots of every game screen at the three phone sizes in both themes.
# Run through `make game-shots`. Needs a window and a GPU (not headless); output goes to
# apps/game/build/shots/<screen>-<theme>-<size>.png, which is git-ignored.
# The shot arguments are read by scripts/main.gd and exist only in debug builds.
set -e
GODOT="${GODOT:-godot}"
OUT="${OUT:-build/shots}"
cd "$(dirname "$0")/.."
mkdir -p "$OUT"

shot() {
	name="$1"
	screen="$2"
	theme="$3"
	size="$4"
	shift 4
	# A bad argument can leave Godot running; a watchdog ends it after a minute.
	"$GODOT" --path . --resolution 200x200 -- \
		--shot="$OUT/$name-$theme-$size.png" --screen="$screen" --theme="$theme" --size="$size" "$@" >/dev/null &
	pid=$!
	(sleep 60 && kill -9 "$pid" 2>/dev/null) &
	watchdog=$!
	wait "$pid" || true
	kill "$watchdog" 2>/dev/null || true
}

for size in 390x844 360x640 412x915; do
	for theme in light dark; do
		shot home home "$theme" "$size"
		shot worlds worlds "$theme" "$size" --done=4
		shot world world "$theme" "$size" --done=4 --world=1
		shot world-stars world "$theme" "$size" --done=6 --world=0
		shot settings settings "$theme" "$size"
		shot how-to-play how_to_play "$theme" "$size"
		shot load-error load_error "$theme" "$size" --title="Loops"
		shot update-required update_required "$theme" "$size" --title="Level 14"
		shot sign-in sign_in "$theme" "$size"
		shot account account "$theme" "$size" --done=4 --account=you@example.com
		shot play-tutorial play "$theme" "$size" --level=first-step
		shot play-hint play "$theme" "$size" --level=first-step --overlay=hint
		# first-turn: start (0,4) facing north; MMMRMMM is its shortest solution.
		shot play-pause play "$theme" "$size" --level=first-turn --program=MMMRM --overlay=pause
		shot play-ready play "$theme" "$size" --level=first-turn --program=MMMRM
		shot play-running play "$theme" "$size" --level=first-turn --program=MMMRMMM --steps=5
		shot play-failed play "$theme" "$size" --level=first-turn --program=MMMMMM --steps=-1
		shot play-solved play "$theme" "$size" --level=first-turn --program=MMMRMMM --steps=-1
		# The social screens answer from canned data (ShotServer), no network.
		who="--account=you@example.com"
		shot profile profile "$theme" "$size" $who
		shot profile-notopted profile "$theme" "$size" $who --fake=notopted
		shot profile-offline profile "$theme" "$size" $who --fake=offline
		shot profile-error profile "$theme" "$size" $who --fake=error
		shot badges badges "$theme" "$size" $who --newbadges=1
		shot badges-offline badges "$theme" "$size" $who --fake=offline
		shot leaderboard leaderboard "$theme" "$size" $who
		shot leaderboard-off-page leaderboard "$theme" "$size" $who --fake=off_page --period=week
		shot leaderboard-level leaderboard "$theme" "$size" $who --scope=level --key=first-turn --title="First turn"
		shot leaderboard-daily leaderboard "$theme" "$size" $who --scope=daily --key=2026-10-20 --fake=off_page
		shot leaderboard-notopted leaderboard "$theme" "$size" $who --fake=notopted
		shot leaderboard-empty leaderboard "$theme" "$size" $who --fake=empty
		shot leaderboard-offline leaderboard "$theme" "$size" $who --fake=offline
		shot leaderboard-signed-out leaderboard "$theme" "$size"
		shot daily daily "$theme" "$size" $who --daily-slots=9 --streak=3,5
		shot daily-fresh daily "$theme" "$size" $who
		shot daily-signed-out daily "$theme" "$size"
		shot daily-offline-cached daily "$theme" "$size" $who --cached --fake=offline
		shot daily-offline-empty daily "$theme" "$size" $who --fake=offline
		shot play-daily play "$theme" "$size" --daily=2026-10-20 --program=MMMRM
		shot play-daily-solved play "$theme" "$size" --daily=2026-10-20 --program=MMMRMMM --steps=-1 $who
		shot play-big play "$theme" "$size" --level=gauntlet --program=MMMMMM
	done
done
echo "Screenshots written to apps/game/$OUT"

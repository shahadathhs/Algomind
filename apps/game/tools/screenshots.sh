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
	"$GODOT" --path . --resolution 200x200 -- \
		--shot="$OUT/$name-$theme-$size.png" --screen="$screen" --theme="$theme" --size="$size" "$@" >/dev/null
}

for size in 390x844 360x640 412x915; do
	for theme in light dark; do
		shot home home "$theme" "$size"
		shot worlds worlds "$theme" "$size" --done=4
		shot world world "$theme" "$size" --done=4 --world=1
		shot settings settings "$theme" "$size"
		shot how-to-play how_to_play "$theme" "$size"
		shot load-error load_error "$theme" "$size" --title="Loops"
		shot update-required update_required "$theme" "$size" --title="Level 14"
		shot sign-in sign_in "$theme" "$size"
		shot account account "$theme" "$size" --done=4 --account=you@example.com
		shot play-tutorial play "$theme" "$size" --level=straight-ahead
		shot play-hint play "$theme" "$size" --level=straight-ahead --overlay=hint
		shot play-pause play "$theme" "$size" --level=the-wall --program=MMMRM --overlay=pause
		# the-wall: start (0,4) facing north; MMMRMMMRM is its shortest solution.
		shot play-ready play "$theme" "$size" --level=the-wall --program=MMMRM
		shot play-running play "$theme" "$size" --level=the-wall --program=MMMRMMMRM --steps=5
		shot play-failed play "$theme" "$size" --level=the-wall --program=MMRMMLMM --steps=-1
		shot play-solved play "$theme" "$size" --level=the-wall --program=MMMRMMMRM --steps=-1
	done
done
echo "Screenshots written to apps/game/$OUT"

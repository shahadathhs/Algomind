#!/bin/sh
# Dev server: SWC rebuilds on change and Node restarts on the rebuilt output.
# (The Nest CLI needs the TypeScript compiler API, which TypeScript 7 does not have.)
set -e
swc_build="swc src -d dist --strip-leading-paths --config-file .swcrc"

pnpm generate
$swc_build
$swc_build --watch &
swc_pid=$!
trap 'kill $swc_pid 2>/dev/null' EXIT INT TERM
node --watch dist/main.js

# Command surface for the whole monorepo. CI runs the same targets.
#
#   TypeScript apps and packages   pnpm
#   API database                   Docker Compose (db service)
#   Game checks and tests          host Godot, or `make game-docker-*` in a container
#   Everything in containers       make up

COMPOSE := docker compose
GODOT   := godot
GAME    := apps/game
# Pinned GDScript tooling, run from the host via uv (no Docker needed).
GDTOOLKIT := gdtoolkit==4.5.0
GDLINT    := uvx --from $(GDTOOLKIT) gdlint
GDFORMAT  := uvx --from $(GDTOOLKIT) gdformat
GDPATHS   := $(GAME)/scripts $(GAME)/tests

.DEFAULT_GOAL := help
.PHONY: help setup env install lint format typecheck test check tokens tokens-check colors-check \
        db-up db-down db-reset db-psql \
        api-generate api-dev api-build api-start api-migrate api-migration \
        web-dev web-build web-start \
        game-import game-check game-test game-lint game-format game-run \
        game-docker-image game-docker-check game-docker-test game-apk android-key \
        up down build logs ps clean version release

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-20s %s\n", $$1, $$2}'

# ── Setup ─────────────────────────────────────────────────────────────

setup: env install db-up api-generate api-migrate game-import ## One-time local setup: env, deps, database, migrations, Godot cache
	@echo ""
	@echo "Setup complete. Start what you need:"
	@echo "  make api-dev   API at http://localhost:8000 (docs at /docs)"
	@echo "  make web-dev   web at http://localhost:3000"
	@echo "  make game-run  the game on this machine"
	@echo "  make up        everything in containers instead"

env: ## Create .env from .env.example if it does not exist (never overwrites)
	@if [ -f .env ]; then echo ".env already exists, keeping it"; else cp .env.example .env && echo "Created .env from .env.example"; fi

install: ## Install dependencies and git hooks (pnpm)
	pnpm install

# ── Quality gates (all apps) ──────────────────────────────────────────

lint: ## Lint (oxlint) and check formatting (prettier)
	pnpm lint

format: ## Format TypeScript, JSON, Markdown, CSS in place (prettier)
	pnpm format

typecheck: ## Type-check every TypeScript package (tsc)
	pnpm typecheck

test: ## Run every TypeScript package's tests
	pnpm test

check: tokens-check colors-check lint typecheck test game-lint game-check game-test ## Everything CI runs

tokens: ## Regenerate the Godot palette and web CSS from design tokens
	pnpm tokens

tokens-check: ## Fail if generated token files are out of date
	pnpm tokens:check

colors-check: ## Fail if a color is hand-written outside the design tokens
	pnpm colors:check

# ── Database (Docker Compose) ─────────────────────────────────────────

db-up: ## Start PostgreSQL in Docker and wait until it accepts connections
	$(COMPOSE) up -d --wait db

db-down: ## Stop PostgreSQL (data is kept in the pgdata volume)
	$(COMPOSE) stop db

db-reset: ## Delete the local database volume and start a fresh one (destroys local data)
	$(COMPOSE) --profile app --profile tools down -v
	$(COMPOSE) up -d --wait db
	$(MAKE) api-migrate

db-psql: ## Open psql in the database container
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-algomind} -d $${POSTGRES_DB:-algomind}

# ── API ───────────────────────────────────────────────────────────────

api-generate: ## Generate the Prisma client
	pnpm --filter @algomind/api generate

api-dev: db-up ## Run the API with rebuild-on-change at http://localhost:8000
	pnpm --filter @algomind/api dev

api-build: ## Build the API
	pnpm --filter @algomind/api build

api-start: ## Run the built API
	pnpm --filter @algomind/api start

api-migrate: ## Apply migrations to DATABASE_URL (prisma migrate deploy)
	pnpm --filter @algomind/api migrate

api-migration: ## Create a migration from schema changes: make api-migration name=add_x
	@test -n "$(name)" || { echo 'Usage: make api-migration name=add_something'; exit 1; }
	pnpm --filter @algomind/api migrate:dev --name $(name)

# ── Web ───────────────────────────────────────────────────────────────

web-dev: ## Run the web app at http://localhost:3000
	pnpm --filter @algomind/web dev

web-build: ## Build the web app
	pnpm --filter @algomind/web build

web-start: ## Run the built web app
	pnpm --filter @algomind/web start

# ── Game (host Godot) ─────────────────────────────────────────────────

game-import: ## Import assets and build the Godot cache
	$(GODOT) --headless --path $(GAME) --import

game-check: game-import ## Load the project headless; fails on parse or script errors
	$(GODOT) --headless --path $(GAME) --quit-after 1

game-test: game-import ## Run the game tests (GUT)
	$(GODOT) --headless --path $(GAME) -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit

game-lint: ## GDScript style gate: gdlint + gdformat --check (config: gdlintrc)
	$(GDLINT) $(GDPATHS)
	$(GDFORMAT) --check $(GDPATHS)

game-format: ## Fix GDScript style in place (gdformat)
	$(GDFORMAT) $(GDPATHS)

game-run: ## Play the game on this machine
	$(GODOT) --path $(GAME)

# ── Game (headless Godot in Docker, same result as the host targets) ──

game-docker-image: ## Build the headless Godot image
	$(COMPOSE) --profile tools build godot

game-docker-check: ## Import and load the project inside the Godot container
	$(COMPOSE) --profile tools run --rm godot sh -c 'godot --headless --path . --import && godot --headless --path . --quit-after 1'

game-docker-test: ## Run the game tests inside the Godot container
	$(COMPOSE) --profile tools run --rm godot sh -c 'godot --headless --path . --import && godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit'

game-apk: ## Export a debug APK to apps/game/build/ (inside the Godot container)
	@mkdir -p $(GAME)/build
	$(COMPOSE) --profile tools run --rm godot bash -c 'android-setup && godot --headless --path . --import && godot --headless --path . --export-debug "Android" build/algomind-debug.apk'
	@echo "Built $(GAME)/build/algomind-debug.apk"

android-key: ## Print a new debug signing key as base64 (the CI secret; see docs/CI.md)
	@$(COMPOSE) --profile tools run --rm godot bash -c 'keytool -genkeypair -keyalg RSA -alias androiddebugkey -keypass android -keystore /tmp/k.ks -storepass android -dname "CN=Algomind Debug" -validity 9999 -deststoretype pkcs12 >/dev/null 2>&1 && base64 -w0 /tmp/k.ks' 2>/dev/null | tail -1

# ── Everything in containers ──────────────────────────────────────────

up: ## Build and start the database, API, and web in containers
	$(COMPOSE) --profile app up -d --build --wait
	@echo "web http://localhost:3000   api http://localhost:8000 (docs at /docs)"

down: ## Stop all containers (data is kept)
	$(COMPOSE) --profile app --profile tools down

build: ## Build the API and web images
	$(COMPOSE) --profile app build

logs: ## Follow container logs
	$(COMPOSE) --profile app logs -f

ps: ## List containers
	$(COMPOSE) --profile app ps

clean: ## Remove containers and volumes, and build output (destroys local data)
	$(COMPOSE) --profile app --profile tools down -v --remove-orphans
	rm -rf apps/api/dist apps/web/.next apps/game/.godot

# ── Versions and releases ─────────────────────────────────────────────

version: ## Write a new version into every file that carries it (no git): make version v=0.2.0
	@v=$(v) ./scripts/bump-version.sh version

release: ## Bump, commit, and push a release: make release v=0.2.0 (run by you, never automatic)
	@v=$(v) ./scripts/bump-version.sh release

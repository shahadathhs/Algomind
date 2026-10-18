# Command surface for the whole monorepo. CI runs the same targets.
# TypeScript apps and packages use pnpm; later phases add Godot (Docker) and API targets.

.DEFAULT_GOAL := help
.PHONY: help install lint format typecheck test check tokens tokens-check

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: ## Install dependencies and git hooks (pnpm)
	pnpm install

lint: ## Lint (oxlint) and check formatting (prettier)
	pnpm lint

format: ## Format everything in place (prettier)
	pnpm format

typecheck: ## Type-check every TypeScript package (tsc)
	pnpm typecheck

test: ## Run every package's tests
	pnpm test

check: tokens-check lint typecheck test ## Everything CI runs

tokens: ## Regenerate the Godot palette and web CSS from design tokens
	pnpm tokens

tokens-check: ## Fail if generated token files are out of date
	pnpm tokens:check

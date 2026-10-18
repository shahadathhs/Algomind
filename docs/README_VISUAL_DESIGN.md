# Algomind — Visual Design Guide

> **Goal:** Give Algomind a coherent visual identity across the Godot game, the public website, and the admin dashboard (the latter two live in one Next.js app). These are implementation guidelines, not a requirement to copy a particular reference game's artwork.

## 1. Design direction

**Direction:** Friendly miniature machinery meets a clean puzzle notebook.

The game should feel tactile, calm, and intelligent. The visual style should help players read the board at a glance and understand cause and effect. It should not look like a generic enterprise dashboard squeezed into a game, nor a noisy arcade game full of gradients and effects.

### Design principles

- **Legibility before decoration.** Board state, instructions, and the goal must be immediately clear.
- **One focal point.** The board is the focus during play; the instruction sequence is the second most important element.
- **Tactile, not skeuomorphic.** Use subtle depth, layered tiles, and clear pressed states without imitating realistic metal panels.
- **Consistent feedback.** A visual symbol means the same thing in gameplay, tutorials, previews, and dashboard controls.
- **Accessible contrast.** Pair color with shape, icon, label, or motion where practical.
- **Designed for touch.** Controls must be easy to hit one-handed on a phone.

## 2. Suggested color palette

Use this as a starting palette. Verify text contrast in the actual UI before shipping.

| Token | Hex | Intended use |
|---|---|---|
| `ink` | `#19252E` | Main text, dark surfaces, outlines |
| `paper` | `#F5F2E9` | Main light background |
| `panel` | `#FFFFFF` | Cards, command tray, modal surfaces |
| `teal` | `#39A995` | Primary action, active/selected state |
| `teal-dark` | `#247968` | Stronger teal for text/icons on light backgrounds |
| `amber` | `#F2BD63` | Goal tile, rewards, important neutral highlight |
| `coral` | `#E87568` | Error or blocked state; use sparingly |
| `blue` | `#6E9FC4` | Informational state, secondary mechanics |
| `muted` | `#687780` | Secondary text and disabled controls |
| `line` | `#D7DDD8` | Borders, grid dividers, separators |
| `board` | `#E6E9E2` | Board background and empty tiles |
| `wall` | `#46535C` | Obstacles and blocked cells |

### Dark mode

A dark theme can be added after the light theme is stable. Do not simply invert every color. Keep the goal/selected states distinct, ensure board grid lines remain visible, and test every status color against the dark surface.

## 3. Typography

- Use one highly legible sans-serif family across the game UI.
- Use a monospaced face only for command labels, coordinates, or technical metadata where it improves alignment.
- Keep body copy short and readable at typical mobile viewing distance.
- Use clear type hierarchy rather than many font weights.
- Avoid all-caps for long text. Short command labels may use compact uppercase labels if legible.
- Use numeric tabular alignment for level numbers, command counts, and result stats.

Suggested hierarchy (adjust to actual viewport):

| Role | Starting size |
|---|---:|
| Game screen title | 24–30 px equivalent |
| Level name | 20–24 px equivalent |
| Body/instructions | 15–17 px equivalent |
| Command label | 14–16 px equivalent |
| Secondary/helper text | 12–14 px equivalent, never essential-only text |

Godot's UI units and device scaling may differ from CSS pixels. Treat these as design references, then test on actual phones.

## 4. Game screen layout

### Main gameplay screen

Use a portrait-first composition:

1. **Top bar:** Back/level navigation, level title or number, pause/settings entry.
2. **Goal/context strip:** One short sentence explaining the objective, plus optional command budget.
3. **Board area:** Centered and given the majority of available space. Keep cell size large enough to read state and tap targets.
4. **Program panel:** A clear sequence of command blocks or slots; the sequence should remain visible while building the solution.
5. **Command tray:** Available commands as large, distinct controls.
6. **Run controls:** A prominent primary Run button, with Reset and Step/Pause as secondary actions.
7. **Feedback region:** Short success/failure explanation and retry/continue action.

The exact arrangement may adapt to smaller devices, but avoid hiding the board behind stacked panels. If needed, let the command editor scroll independently while preserving the run controls.

### Board

- Use subtle spacing between cells; avoid thick high-contrast lines on every edge.
- Make the automaton visually distinct from the background tiles.
- Show orientation clearly (for example, a directional nose, arrow, or eyes) so turns are readable.
- The goal tile should be unmistakable but not visually louder than the automaton.
- Use a consistent visual language for walls and other objects.
- Highlight the last executed action or current cell briefly; do not leave the entire board flashing.
- Make reachable, blocked, active, and goal states distinguishable without relying on color alone.

### Command blocks

- Give each command a recognizable icon plus text or a clear accessible label.
- Keep command order unambiguous.
- Use a selected/focused treatment that is visible against both panel and board colors.
- Provide empty slots/placeholders where that helps players understand how to build a program.
- Avoid drag-only interaction; tapping a command and then a slot should also work where feasible.

## 5. Motion and interaction

Use animation to explain the simulation, not to delay it.

- Movement should feel short, consistent, and easy to track.
- Turning should visually communicate the new facing direction.
- A blocked action should have a brief, restrained response (small nudge, icon, or message), not a large shake that feels punitive.
- Level completion can use a warm highlight and a short celebratory motion.
- Provide a way to reduce or skip long animations.
- Do not play large celebratory animations after every small action.
- Stop or pause gameplay animations when the app loses focus.

### Interaction states to define

Every important control needs normal, pressed, focused/selected, disabled, loading, and error states as applicable. Avoid using opacity alone to indicate disabled state if it makes text unreadable.

## 6. Onboarding and feedback copy

Use direct, respectful language. Explain what happened and what the player can do next.

Good examples:

- “The automaton hit a wall. Change the program and try again.”
- “Program complete. The goal is still ahead.”
- “Level solved.”
- “This level could not load. Retry, or play a downloaded level.”
- “This command is not available in this level.”

Avoid:

- “Wrong!” or “You failed!”
- Cryptic error identifiers.
- Long tutorial paragraphs over the board.
- Tooltips as the only way to learn an essential control on mobile.

## 7. Level selection and progression screens

- Use a simple level list or compact grid with clear locked, available, and completed states.
- Display title/number and optional difficulty; do not put too many statistics on each level card.
- The player should know which level is next and how to return to the current puzzle.
- Keep locked levels visually subdued but still readable.
- If remote content is unavailable, distinguish “not downloaded” from “locked by progression.”
- Avoid making level-completion badges look like purchase or premium labels.

## 8. Dashboard design

The dashboard serves an authoring workflow. Optimize it for clarity and safe publishing rather than visual spectacle.

### Main areas

- **Navigation:** Levels, Create Level, and Settings (add sections only when they are needed).
- **Level list:** Name, status (Draft/Published/Archived), last updated, difficulty, and actions.
- **Level editor:** Metadata, board setup, initial state, allowed commands, constraints, goal, and hints.
- **Preview:** A readable preview of how the level will appear in the game, using the same visual semantics where practical.
- **Validation panel:** Human-readable errors and warnings linked to the relevant field.
- **Publish panel:** A summary of the version about to be published, with a clear confirmation step.

### Publishing safety

- Draft and published states must be visually distinct.
- Saving a draft must never publish it implicitly.
- Publishing should explain that it creates a new version.
- If validation fails, disable Publish and show actionable errors.
- Unpublishing should require confirmation and explain that new fetches will no longer list the level; do not imply that already cached copies disappear from devices.
- Clearly show which version is currently published.

## 9. Public website

The public site shares the game's palette, type, and cell-based spacing so it reads as the same product.

- Pages: landing, level catalog and detail, play (browser build), download, privacy, contact.
- Content is short and plain; the game and its levels are the visuals. Show real board renderings of published levels, using the same visual semantics as the game.
- One primary action per screen (for example Play or Download); secondary actions are quiet text links.
- Pages must be readable and complete without JavaScript. The browser game loads only after the visitor presses Play.
- Respect reduced-motion settings; no looping or idle animation.
- The dashboard under `/admin` uses the same tokens but is denser and utilitarian. Never expose admin styling or controls on public pages.

## 10. Responsive web behavior

- Support desktop layouts first for the full editor, with usable tablet behavior.
- On narrow screens, stack metadata and validation panels rather than squeezing them into tiny columns.
- Use keyboard navigation for fields and dashboard actions.
- Preserve unsaved edits when switching editor sections, and warn before discarding them.
- Provide visible save status: Unsaved, Saving, Saved, or Save failed.
- Keep primary actions obvious and destructive actions separated.

## 11. Accessibility and usability

- Text and icons must have sufficient contrast on their backgrounds.
- Controls must have accessible names.
- Touch targets should generally be at least about 44 × 44 CSS-pixel-equivalent in the game/dashboard where practical.
- Provide visible focus states in the web dashboard.
- Avoid color-only meaning; pair color with shape, labels, or position.
- Support reduced motion where possible.
- Do not use sound as the only feedback for any state.
- Test the game on real phone-sized screens, not only in a desktop game window.

## 12. Visual-design acceptance checklist

- [ ] The board is the clear focal point of the gameplay screen.
- [ ] The automaton's orientation is clear at a glance.
- [ ] Every command has a distinct and understandable visual treatment.
- [ ] Success, failure, blocked, locked, and loading states are visually distinct.
- [ ] Controls are usable with touch, without precision dragging being mandatory.
- [ ] Essential instructions remain readable at a typical phone size.
- [ ] The dashboard can distinguish drafts from published versions immediately.
- [ ] A failed save or invalid publication is visible and actionable.
- [ ] The public site matches the game's visual language and works without JavaScript.
- [ ] Animations clarify actions and can be reduced or skipped where appropriate.

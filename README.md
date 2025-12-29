# Sky Dash

Play it on GitHub Pages: https://engineerturph.github.io/plane_game

I built Sky Dash during Insider AI Weekend (27-28 December) as a three-hour experiment to see how far the AI Studio vibe-coding workflow could be pushed before it started fighting back. Sure enough, once the project crossed a certain scope the automated builder began injecting bugs, so this repository captures the hand-polished version that actually flies.

You pilot a futuristic interceptor through an asteroid field, dodge debris, vaporise hostile meteors, and clear three escalating boss encounters that test different skills: pursuit, sustained DPS, and precision strikes.

## Gameplay Highlights

- Three selectable player fighters with distinct speed, nitro, and turn characteristics defined in [constants.ts](constants.ts).
- Dense procedural asteroid field with moving hazards, including high-value red asteroids that can be shot for bonus points and explosions (handled in [components/GameCanvas.tsx](components/GameCanvas.tsx)).
- Phase-based campaign: chase the rival ace, dismantle a Death Star analogue with a draining HP bar, then cripple a planet fortress by targeting its mansion weak point.
- Dynamic mission chatter: AI-generated briefs, taunts, and victory debriefs via Gemini with safe fallbacks in [services/geminiService.ts](services/geminiService.ts).
- Persistent high-score tracking stored in `localStorage` so best runs survive refreshes.

## Controls

- Mouse to aim the reticle; left click fires lasers on cooldown.
- `W` / `S` or arrow keys pitch the nose; `A` / `D` handle yaw.
- `Q` / `E` roll the airframe to weave through debris.
- Spacebar engages nitro for short bursts—useful for catching the rival ace or dodging turrets.

## Hangar

- **X-15 Interceptor**: balanced stats and forgiving handling.
- **V-22 Viper**: raw speed and nitro for pursuits at the cost of agility.
- **F-99 Phantom**: slower but highly responsive, ideal for threading asteroid gaps.

## Tech Stack

- React 19 with Vite for fast iteration and modern JSX transforms.
- Three.js powering the scene graph, lighting, and particle effects.
- Tailwind CSS served via CDN for HUD styling.
- Google Gemini (Flash Preview) for flavour text, guarded so builds succeed even without an API key.

## Getting Started

```bash
npm install
cp .env.local.example .env.local  # if you keep a template
```

Populate `GEMINI_API_KEY` in `.env.local` if you want fresh mission briefings; otherwise the fallback copy keeps the narrative moving. Launch the simulation:

```bash
npm run dev -- --host
```

The dev server prints the local and LAN URLs (for example `http://localhost:3000/plane_game/`).

## Production Build & Deployment

- `npm run build` generates the static bundle under `dist/` with the GitHub Pages base path set in [vite.config.ts](vite.config.ts).
- The workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds on every push to `main`, uploads the artifact, and publishes it through GitHub Pages.
- Ensure the repository’s Pages settings point to the **GitHub Actions** source so the workflow controls releases.

## Project Layout

- [App.tsx](App.tsx) orchestrates the UI states (menu, briefing, gameplay, victory) and wires callbacks into the renderer.
- [components/GameCanvas.tsx](components/GameCanvas.tsx) hosts the entire 3D world: entity spawning, physics-ish updates, boss phases, and particle effects.
- [services/geminiService.ts](services/geminiService.ts) wraps Gemini requests with defensive fallbacks to keep the game narrative working offline.
- [types.ts](types.ts) centralises enums and shared interfaces for clean data flow between systems.

## Known Limits

- The Three.js scene pushes a large single bundle; code-splitting could shrink initial load, but was skipped to keep the jam build simple.
- enemy AI uses lightweight heuristics instead of full pathfinding—expect some cinematic chaos when the asteroid density spikes.

Have fun chasing the rival ace, and definitely watch out for the mansion laser grid once you reach the planet phase.

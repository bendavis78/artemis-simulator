# Artemis II Simulator

An interactive 3D visualization of NASA's Artemis II mission built with Three.js and TypeScript.

**[View Live Demo](https://bendavis78.github.io/artemis-simulator/)**

![Artemis Simulator](https://github.com/user-attachments/assets/fffdbb65-7120-4b2b-bc0f-67b7d4987ef5)

Explore the Artemis II mission trajectory as the Orion spacecraft travels from Earth orbit to the Moon and back. The simulator uses real ephemeris data from NASA/JPL Horizons to accurately plot the spacecraft's path, with photo-realistic textures, day/night lighting, and an interactive timeline that lets you scrub through the mission.

## Features

- **Accurate trajectory** sourced from JPL Horizons ephemeris data
- **Photo-realistic Earth and Moon** with day/night shading and atmospheric effects
- **Interactive timeline** to scrub through mission phases
- **Orbit camera controls** with mouse drag and scroll-wheel zoom
- **Orion spacecraft model** tracking the flight path in real time
- **Mission waypoints** marking key events (ICPS separation, lunar flybys, splashdown)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the simulator.

## Build

```bash
npm run build    # Production build (fetches latest trajectory data automatically)
npm run preview  # Preview the production build locally
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `L` | Toggle live mode |
| `←` / `→` | Scrub timeline (step size scales with speed) |
| `Shift+←` / `Shift+→` | Scrub timeline in 1-minute increments |
| `↑` / `↓` | Increase / decrease playback speed |
| `E` | Focus Earth |
| `M` | Focus Moon |
| `O` | Focus Orion |
| `Page Up` / `Page Down` | Zoom in / out |
| `Shift+Page Up` / `Shift+Page Down` | Fine-grain zoom in / out |
| `Home` / `End` | Zoom all the way in / out |
| `Shift+E` | Toggle Earth POV (view Moon from Earth) |
| `Shift+O` | Toggle Orion POV (view Moon from Orion) |
| `?` | Keyboard shortcut reference |

Mouse: drag to orbit, scroll to zoom.

# AGENTS.md

## Cursor Cloud specific instructions

### Overview

A static single-page dark-themed comparison website showing feature-by-feature "Air vs Cursor" comparison. No build tools, no dependencies.

### Running the app

Serve with any HTTP server:
```
python3 -m http.server 8001
```
Then open http://localhost:8001.

### Key notes

- Fully self-contained static site: inline CSS and JS in `index.html`.
- References local font (`src/fonts/KomunaVar.ttf`) and SVG assets (`src/svg/`).
- No package manager, no build step, no tests.
- Designed for GitHub Pages deployment.

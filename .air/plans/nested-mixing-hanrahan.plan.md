# Air vs Cursor — Comparison Table (Single-Page Website)

## Context
The user wants to turn an existing Notion comparison table (Air vs Cursor) into a polished single-page website. The site will be hosted on GitHub Pages from the `cursor-vs-air` repo. The repo is currently empty.

---

## Goal
Create a single `index.html` file (vanilla HTML/CSS/JS, no build step) that renders a beautiful dark-themed comparison table of Air vs Cursor, grouped by category, with row hover highlight and a filter bar.

---

## Approach
Single self-contained `index.html` with inlined `<style>` and `<script>` tags — zero dependencies, zero build tooling, deployable to GitHub Pages by enabling it on the `main` branch root. Interactivity is driven by toggling CSS classes via vanilla JS. Data is stored as a JS array of objects so rows can be added or edited easily.

---

## Comparison Data (from Notion screenshot)

### Agent Capabilities
| Feature | Air | Cursor |
|---|---|---|
| Multi-agent support | ✓ | ✗ |
| Run many agents in parallel | ✓ | ✓ |
| Multi-workspaces | ✗ | ✓ |
| Comments | ✓ | ✗ |

### Platform & Access
| Feature | Air | Cursor |
|---|---|---|
| Start from Desktop | ✓ | ✓ |
| Start from Web | ✓ | ✓ |
| Start from Mobile | ✗ | ✓ |
| Start from Slack/GitHub | ✗ | ✓ |
| Windows support | ✗ | ✓ |
| Linux support | ✗ | ✓ |

### Task Management
| Feature | Air | Cursor |
|---|---|---|
| Move tasks from Local → Cloud | ✗ | ✓ |
| Move tasks from Cloud → Local | ✗ | ✓ |
| Create PR | ✗ | ✓ |
| Commit & Push | ✗ | ✓ |

### Integrations
| Feature | Air | Cursor | Note |
|---|---|---|---|
| Editor with LSPs | ✓ | ✓ | |
| Integrated browser | ✓ | ✓ | Not nearly on the same level though |
| Plugins | ✗ | ✓ | |

### Chat
| Feature | Air | Cursor | Note |
|---|---|---|---|
| Voice input | ✗ | ✓ | |

---

## File Changes

| File | Action | Description |
|---|---|---|
| `index.html` | **Create** | Single self-contained page with all HTML, CSS, and JS |

---

## Implementation Steps

### Task 1 — HTML skeleton
- `index.html`: `<head>` with charset/viewport/title, `<body>` with:
  - Header section: "Air vs Cursor" title + subtitle
  - Filter bar: "All" · "Air wins" · "Cursor wins" · "Tied" buttons
  - `<table>` with `<thead>` (Feature / Air / Cursor / Notes) and `<tbody>` populated by JS

### Task 2 — Data model (inline JS)
- JS array at the top of `<script>`:
  ```js
  const rows = [
    { category: "Agent Capabilities", feature: "Multi-agent support", air: true, cursor: false },
    ...
  ];
  ```
- `renderTable()` function: groups rows by category, injects `<tr class="category-header">` separators, sets `data-winner` attribute (`air`, `cursor`, `tie`) on each `<tr>` for CSS-driven filtering.

### Task 3 — Dark theme CSS
- CSS variables: `--bg: #0f0f0f`, `--surface: #1a1a1a`, `--border: #2a2a2a`, `--text: #e5e5e5`, `--muted: #888`, `--air: #7c6af7` (purple accent), `--cursor: #3b82f6` (blue accent), `--green: #22c55e`, `--red: #ef4444`
- Table: full-width, `border-collapse`, sticky `<thead>`, alternating row bg
- Row hover: `transition background 150ms`, subtle `--surface` highlight
- ✓ / ✗ cells: colored SVG icons or Unicode with `color: var(--green/--red)`
- Category header rows: full-width, muted uppercase label, distinct bg

### Task 4 — Filter bar JS
- Filter buttons toggle `aria-pressed` and add `.active` class
- On click: iterate all `<tr[data-winner]>`, toggle `hidden` class based on filter value
- "All" always shows everything

### Task 5 — Score summary
- Above the table, compute and display totals from the source data: "Air: 7 · Cursor: 16 · Tied: 5"
- Two mini scorecards styled as pills

### Task 6 — GitHub Pages config
- No extra files needed — GitHub Pages works with `index.html` at repo root
- Just need to enable Pages on `main` branch in GitHub repo settings (documented in plan, not code)

---

## Acceptance Criteria
1. Opening `index.html` locally in any modern browser shows the full table without errors
2. All 18 rows from the Notion screenshot are present, correctly assigned ✓/✗
3. Category group headers visually separate the four categories
4. Clicking "Air wins" hides all rows where Cursor wins or it's a tie; "Cursor wins" hides Air-only rows; "All" restores all rows
5. Hovering any data row produces a visible background change
6. Score summary correctly counts the source data totals: Air=7, Cursor=16, Tied=5
7. Page looks correct on a 1280px viewport and remains readable on 768px (mobile-friendly)
8. No external network requests (fully offline-capable)

---

## Verification Steps
1. Open `index.html` in browser → check all rows/categories render
2. Click each filter button → verify correct rows show/hide
3. Hover rows → confirm highlight effect
4. Check score values against the source data totals: Air=7, Cursor=16, Tied=5
5. Resize to ~375px → confirm the comparison stays readable without an internal horizontal table scroller
6. Push to GitHub, enable Pages on `main` branch root → confirm live URL loads correctly

---

## Risks & Mitigations
- **Table readability on mobile**: Switch to a stacked responsive layout on small screens instead of relying on an internal horizontal scroller.
- **Data typos**: Cross-check every row against the screenshot before shipping.
- **"Integrated browser" note**: Render the note text in a small muted `<span>` inside the Notes column — don't lose this nuance.

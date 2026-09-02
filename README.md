# spike-3d — the engine build

The working world-layer prototype: Three.js (vendored, no build step), first-person,
flat-shaded procedural worlds, KaTeX mathematics anchored to world points, content as
JSON, everything logged.

## Run

```
python3 serve.py 8792 .
```

from this folder, then open http://localhost:8792.
No install, no build — Three.js and KaTeX are vendored. Use `serve.py` (not plain
`http.server`): it sends no-cache headers, without which Chrome serves STALE module
mixes across reloads during iteration.

## Play

Click to look (drag works where pointer lock is blocked) · **W A S D** move ·
**E** act on what you're looking at · **Space** throw · **R** re-cast the sight ·
**Tab** architect view · **Esc** close panel.

The landing page offers the worlds; each is its own HTML page over one shared engine.

## Honesty flags

- All player-facing strings in `content/*.json` and `js/panels.js` are **placeholders**;
  the author writes real content.
- Player-facing math register is first-course by rule; `js/fmt.js` is the one place that
  encodes it. Symbolic forms appear only in architect view.
- This is a spike: collision is flat-ground circles/boxes, saves don't exist, chip
  layout can collide at some angles. Known and accepted.

# Residence in 3D

An interactive reconstruction of a house from a front elevation, floor plan and roof sketch. The furnished model includes 18 interior spaces, exterior views and a cutaway floor plan.

**Open the viewer:** https://eaglish-fam.github.io/residence-3d-viewer/

## Language and controls

The first visit opens in English. Use **Language** at the top right to switch to **繁體中文** (Traditional Chinese). The viewer remembers the selection without changing the current room or camera. Add `?lang=en` to a shared link to explicitly open the English interface.

- **Exterior:** drag to orbit; scroll or pinch to zoom. Choose the front, rear, left or right view, or use **Floor plan** to inspect the furnished interior.
- **Walk inside:** choose any of the 18 spaces, drag to look around, and move with the on-screen buttons. A computer keyboard also supports W, A, S and D.
- **Compare floor plans:** compare the supplied drawing with the reconstructed wall layout. Reconstructed labels follow the selected language.
- Download the GLB model or editable Blender file from the desktop control panel.

## Model scope

The model follows the readable dimensions and proportions in the supplied photographs. Furniture, finishes, some heights, and details absent from the drawings are illustrative. This is a visualization model, not a construction drawing. The principal width reference is 54 ft 2 in (approximately 16.510 m); geometry is stored in meters.

## Hosting

GitHub Pages serves the static files in `docs/` from the `main` branch. Rendering happens in the visitor's browser. The site has no application backend and makes no requests to a personal computer or private network. The published website and its downloadable files are public.

All required Three.js modules are included locally. No external CDN, analytics or login is required. A WebGL-capable browser is needed. Third-party Three.js code retains its MIT license at `docs/vendor/three/LICENSE`. Original model and drawing assets are supplied for this project; no additional reuse license is granted here.

## Files

- `docs/index.html`, `style.css`: responsive interface
- `docs/viewer.js`: Three.js scene and movement controls
- `docs/i18n.js`, `strings.js`: language handling and English / Traditional Chinese copy
- `docs/assets/`: model, source Blender file, room camera metadata, original drawing and translated floor plans

## Validation

Checked all 18 room presets in both languages, language persistence, camera preservation, translated floor-plan labels and load failures, desktop layout, and 390 px / 320 px mobile layouts. Full-height and cutaway wall meshes were checked for open and non-manifold edges; both counts are zero.

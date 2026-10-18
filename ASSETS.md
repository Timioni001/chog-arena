# Assets

| Asset | Where | Creator | License |
|---|---|---|---|
| Chog character art: Wild Chog, Forest Ranger, Desert Nomad, Crystal Mage, Cyber Ninja, Ice Guardian, Ocean Diver, Speed Runner, Cozy Hoodie and Space Explorer sheets: hero art, storyboards, turnarounds, expressions (cut to `public/art/*.webp` with `scripts/art/`, plus `public/icons/*`, `public/og.jpg`) | Supplied by the project owner | Project owner (original designs) | All rights reserved by the project owner; used with permission in this project |
| 3D Chog model (procedural geometry in `src/components/three/ChogModel.tsx`) | Code | Chog Arena | Same as repo |
| 2D Chog portraits (`src/components/ChogSprite.tsx`) | Code | Chog Arena | Same as repo |
| Bot sprites (`src/components/BotSprite.tsx`) | Code | Chog Arena | Same as repo |
| Scenery (islands, clouds, UFO, neon city, ember rift) | Code | Chog Arena | Same as repo |
| `public/icon.svg` | Hand-written SVG | Chog Arena | Same as repo |
| Sound effects | Synthesised at runtime with WebAudio (`src/lib/sound.ts`) | Chog Arena | Same as repo |
| Fonts: Outfit, Inter Tight, Lilita One | Google Fonts via `next/font` | Rodrigo Fuenzalida; Rasmus Andersson; Juan Montoreano | SIL Open Font License 1.1 |
| Icons | `lucide-react` | Lucide contributors | ISC |
| Card glyph emoji (enemy cards only) | System emoji font | Platform vendor | Rendered by the OS, not shipped |

No Chog Genesis NFT image or official Chog artwork is copied, hosted, traced or used as a texture. NFT images are only reachable through the OpenSea, Magic Eden and explorer links in the Chog Lab.

## Art pipeline

`scripts/art/` rebuilds `public/art` from the owner's sheets:

1. `spec.py` holds the crop boxes for every sheet (hero, five storyboard frames, turnaround front, expressions).
2. `run.py` upscales each crop 4x with Real-ESRGAN x4plus (ONNX, CPU, tiled with overlap so there are no seams), then downsamples with Lanczos. Nothing in the UI is shown above its native pixels.
3. Turnaround fronts go through `rembg` (isnet-general-use) to make the transparent `cut-*.webp` character cutouts used on cards.
4. `publish.py` writes WebP (heroes 1400px wide, q80; stories 640px; expressions 320px; cutouts 900px tall with alpha).

```bash
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow
curl -L -o scripts/art/esrgan.onnx https://huggingface.co/imgdesignart/realesrgan-x4-onnx/resolve/main/onnx/model.onnx
SHEETS=/path/to/sheets .venv/bin/python scripts/art/run.py && .venv/bin/python scripts/art/publish.py
```

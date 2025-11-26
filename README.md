# Hologlyph.js

A lightweight, universally embeddable voxel-animation system designed for the open web. Hologlyph provides a complete pipeline for creating, editing, and displaying holographic voxel animations in the browser using WebGL.

## Overview

Hologlyph is designed to make **tiny holographic voxel animations** as easy to use as images or GIFs — but with full 3D depth, alpha, HSBA colors, and an open, hackable pipeline.

### Core Features

- **WebGL Rendering**: Proper 3D cube voxels with lighting and depth testing
- **HSBA Color Model**: Intuitive Hue-Saturation-Brightness-Alpha color space (0-255 for H, 0-100% for S/B/A)
- **Animation Support**: Multi-frame animations with configurable duration and looping
- **Orbital Camera**: Drag to rotate, mouse wheel to zoom, pinch to zoom on touch devices
- **Visual Editor**: Professional editor with shape generators, interactive color picker, and project management
- **File Format**: Compact binary `.glyf` format with optional compression
- **LocalStorage Projects**: Save and auto-save projects locally in your browser

## Quick Start

### 1. View the Demo

Open `index.html` in a modern browser to see a procedural floating pyramid animation with orbital controls.

### 2. Create Your Own Animation

1. Open `editor.html` in your browser
2. Use the **Project Settings** (⚙️) panel to configure grid size and frame count
3. Click **"Create New Project"**
4. Use the **Shape Generator** (📦) to create basic shapes, or
5. Use the **Voxel Editor** (✏️) with the **Color Picker** (🎨) to place individual voxels
6. Navigate between frames using the timeline at the bottom
7. Use **Camera** (📷) controls or drag on canvas to adjust the view
8. **Save** your project (💾) or export as a `.glyf` file

### 3. Using the Library

```javascript
import { HologlyphPlayer } from './hologlyph.js';

// Load your .glyf file data
const response = await fetch('myanimation.glyf');
const data = await response.arrayBuffer();

// Create player with WebGL
const canvas = document.getElementById('myCanvas');
const player = new HologlyphPlayer({
    canvas,
    data,
    autoPlay: true,
    useWebGL: true,
    orbitalDrag: true,
    initialRotationX: 0.3,
    initialRotationY: 0.6
});
```

## Files

- **`hologlyph.js`** - Core library with player, renderer, and utilities
- **`editor.html`** - Professional visual editor with full toolset
- **`index.html`** - Demo with procedural pyramid animation
- **`agents.md`** - System architecture and design philosophy

## API Reference

### HologlyphPlayer

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `canvas` | HTMLCanvasElement | *required* | Canvas element to render to |
| `data` | Uint8Array/ArrayBuffer | *required* | Hologlyph binary data |
| `dataGenerator` | Function | `null` | Function to regenerate data with view rotation (for 2D mode) |
| `autoPlay` | Boolean | `true` | Start playing immediately |
| `voxelSize` | Number | `8` | Size of each voxel in pixels (2D mode only) |
| `orbitalDrag` | Boolean | `false` | Enable drag-to-orbit camera |
| `useWebGL` | Boolean | `false` | Use WebGL renderer (recommended) |
| `showGrid` | Boolean | `false` | Show wireframe grid (editor mode) |
| `initialRotationX` | Number | `0.3` | Initial camera X rotation (radians) |
| `initialRotationY` | Number | `0.6` | Initial camera Y rotation (radians) |

#### Methods

- **`play()`** - Start animation playback
- **`pause()`** - Pause animation
- **`stop()`** - Stop and reset to frame 0
- **`render()`** - Manually render current frame
- **`destroy()`** - Clean up resources and event listeners

#### Properties

- **`currentFrame`** - Get/set current frame index
- **`viewRotationX`** - Camera X rotation (radians)
- **`viewRotationY`** - Camera Y rotation (radians)
- **`zoomLevel`** - Camera zoom (0.3 to 3.0, default: 1.0)

### HSBAUtil

#### `encodePixel(input)`

Convert HSBA values to 4-byte pixel data.

**Input formats:**
- Object: `{h, s, b, a}`
- Array: `[h, s, b, a]`
- String: `"h,s,b,a"`

**Returns:** `Uint8Array(4)`

#### `decodePixel(bytes)`

Convert 4-byte pixel data to HSBA object.

**Input:** `Uint8Array(4)`  
**Returns:** `{h, s, b, a}`

### Header Functions

#### `createHologlyphHeader(options)`

Create a binary header for a `.glyf` file.

**Options:**
- `width`, `height`, `depth` - Grid dimensions (default: 32)
- `frameCount` - Number of frames (default: 1)
- `frameDurationMs` - Duration per frame in milliseconds (default: 100)
- `loop` - Whether to loop animation (default: true)
- `loopStartFrame` - Frame to loop back to (default: 0)
- `bytesPerVoxel` - Bytes per voxel (default: 4)
- `colorModel` - Color model (default: HSBA_255_100)

**Returns:** `Uint8Array` header (28 bytes)

#### `parseHologlyphHeader(data)`

Parse header from binary data.

**Returns:** Header object with all properties

## File Format (`.glyf`)

The `.glyf` format is a compact binary format for voxel animations.

### Header (28 bytes)

| Offset | Size | Type   | Description |
|--------|------|--------|-------------|
| 0      | 4    | char   | Magic "HGLY" |
| 4      | 1    | uint8  | Version (1) |
| 5      | 1    | uint8  | Header size (28) |
| 6      | 1    | uint8  | Flags (bit 0: loop) |
| 7      | 1    | uint8  | Bytes per voxel (4) |
| 8      | 1    | uint8  | Width (1-255) |
| 9      | 1    | uint8  | Height (1-255) |
| 10     | 1    | uint8  | Depth (1-255) |
| 11     | 1    | uint8  | Color model (0=HSBA) |
| 12     | 4    | uint32 | Frame count (little-endian) |
| 16     | 4    | uint32 | Frame duration (ms, little-endian) |
| 20     | 4    | uint32 | Reserved |
| 24     | 4    | uint32 | Loop start frame (little-endian) |

### Voxel Data

Following the 28-byte header, voxel data is stored sequentially:

**Frame order:** Frame 0 → Frame N  
**Spatial order per frame:** Z → Y → X (Z varies slowest, X fastest)  
**Per voxel:** 4 bytes `[H, S, B, A]`

- **H (Hue):** 0-255 (maps to 0-360°)
- **S (Saturation):** 0-100%, stored as 0-255
- **B (Brightness):** 0-100%, stored as 0-255
- **A (Alpha):** 0-100%, stored as 0-255

**Example:** 16×16×16 grid with 10 frames = 28 + (16×16×16×4×10) = 163,868 bytes

## Editor Features

### Icon-Based Tool Panels

- **⚙️ Project** - Grid size, frame count, duration, loop settings
- **📦 Shape** - Generate cubes, boxes, spheres, pyramids, cones, cylinders
- **🎨 Color** - Interactive 2D color picker with hue/saturation canvas
- **✏️ Voxel** - Edit individual voxels with position sliders
- **📷 Camera** - Control view rotation and zoom
- **📊 Stats** - View voxel counts and file size estimates
- **💾 File** - Save/load projects, export/import `.glyf` files

### Advanced Features

- **Resizable panels** - Drag handles to adjust panel heights
- **Multiple panels** - Open multiple panels simultaneously
- **Auto-save** - Configurable auto-save with interval settings
- **Project management** - Save multiple projects to localStorage
- **Interactive color picker** - Click on rainbow gradient to select colors
- **Shape positioning** - Set exact center position for generated shapes
- **Filled/hollow modes** - Generate solid or wireframe shapes
- **Camera presets** - Save and restore view angles

### Keyboard/Mouse Controls

- **Drag on canvas** - Orbit camera around scene
- **Mouse wheel** - Zoom in/out
- **Pinch gesture** - Zoom on touch devices
- **Click color picker** - Select hue & saturation visually
- **Slider inputs** - All sliders have companion number inputs for precision

## Creating Animations Programmatically

```javascript
import { createHologlyphHeader, HSBAUtil } from './hologlyph.js';

// Create header
const header = createHologlyphHeader({
    width: 16,
    height: 16,
    depth: 16,
    frameCount: 10,
    frameDurationMs: 100,
    loop: true,
});

// Allocate buffer
const voxelsPerFrame = 16 * 16 * 16;
const bytesPerFrame = voxelsPerFrame * 4;
const totalSize = header.length + (bytesPerFrame * 10);
const buffer = new Uint8Array(totalSize);

// Copy header
buffer.set(header, 0);

// Fill with voxel data
let offset = header.length;
for (let frame = 0; frame < 10; frame++) {
    for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                // Example: animated gradient
                const pixel = HSBAUtil.encodePixel({
                    h: (x + frame * 8) * 8,
                    s: 80,
                    b: 60,
                    a: 100
                });
                buffer.set(pixel, offset);
                offset += 4;
            }
        }
    }
}

// Use with player
const player = new HologlyphPlayer({
    canvas: myCanvas,
    data: buffer,
    useWebGL: true
});
```

## Browser Requirements

- **Modern browser** with ES6 module support
- **WebGL support** (for 3D rendering mode)
- **Canvas 2D support** (for fallback mode)
- **LocalStorage** (for editor project saving)

## Design Philosophy

### Extreme Lightweightness
- No frameworks, no bundlers required
- Pure ES6 modules
- Small enough to drop into static HTML
- Compact `.glyf` files

### Binary Format First
- Everything revolves around the `.glyf` binary format
- Stable, documented, versioned
- Easy to parse in any language

### Fully Open & Interoperable
- Anyone can write their own renderer or tools
- Deterministic format
- No vendor lock-in

### Decouple Representation from Rendering
- `.glyf` describes only voxel data + timing
- WebGL / CPU rendering is pluggable
- Authoring complexity never leaks into player

## Performance Tips

- Use **WebGL mode** for better performance and visual quality
- Keep grid sizes reasonable for web (16×16×16 is ideal, 32×32×32 is maximum)
- Use **filled: false** in shape generator for hollow shapes (fewer voxels)
- Monitor file size in the Stats panel
- Consider frame count vs. file size tradeoffs

## Examples

See `index.html` for a procedural animation showing:
- Rotating and bobbing pyramid
- Dynamic shadow that grows/shrinks
- Orbital camera controls
- Smooth 60-frame animation

## License

GNU GPL v3 - Feel free to use in your projects!

## Contributing

This is an open system designed for extension:
- Write custom shape generators
- Create animation interpolation tools
- Build alternate renderers (CPU, ray-traced, etc.)
- Develop compression schemes
- Add new color models

The format is yours to extend!

---

**Made with ❤️ for the open web**

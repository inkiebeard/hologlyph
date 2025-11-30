# agents.md — Hologlyph AI Agent Guide

**Purpose:** This document guides AI agents making changes to the Hologlyph codebase. Follow these principles, patterns, and constraints to maintain system integrity.

---

## Core Principles (NEVER VIOLATE)

### 1. **The Binary Format is Sacred**
- **RULE:** Never change the `.glyf` format without versioning
- **RULE:** All format changes MUST be backward compatible
- **RULE:** The 28-byte header structure is immutable for version 1
- **WHY:** `.glyf` files must work everywhere, forever

### 2. **Player Must Stay Lean**
- **RULE:** No new dependencies in `hologlyph.js`
- **RULE:** Keep runtime code minimal and fast
- **RULE:** Editor complexity NEVER leaks into player
- **WHY:** Players must embed anywhere with near-zero overhead

### 3. **Magic Numbers Are Banned**
- **RULE:** Extract ALL numeric constants into named variables
- **RULE:** Use ALL_CAPS for constants
- **RULE:** Document units (pixels, radians, milliseconds, percentages)
- **WHY:** Code must be self-documenting and maintainable

### 4. **Only one canvas is allowed**
- **RULE:** Only one canvas is allowed in the DOM
- **RULE:** The canvas must be the only child of the parent element
- **WHY:** This is to ensure that the canvas is the only element that can be used to render the animation

```javascript
// ❌ BAD
if (rotation > 1.57) { ... }

// ✅ GOOD
const MAX_ROTATION_X = Math.PI / 2; // radians - prevent camera flip
if (rotation > MAX_ROTATION_X) { ... }
```

### 4. **WebGL and 2D Must Coexist**
- **RULE:** All features must work in both rendering modes when possible
- **RULE:** WebGL is preferred, 2D is fallback
- **RULE:** Never assume WebGL is available
- **WHY:** Universal compatibility is core to the mission

### 5. **Deterministic Output Always**
- **RULE:** Same input data = same visual output
- **RULE:** No randomness unless explicitly seeded
- **RULE:** Frame timing must be consistent across devices
- **WHY:** Animations must be reproducible

---

## Architecture Layers (RESPECT BOUNDARIES)

### Layer 1: Binary Format (Bottom)
**Files:** Header constants in `hologlyph.js`  
**Purpose:** Define `.glyf` structure  
**Rules:**
- Changes require version bump
- Must be parseable in any language
- No runtime logic here

### Layer 2: Encoding/Decoding (Data)
**Files:** `HSBAUtil`, `createHologlyphHeader`, `parseHologlyphHeader`  
**Purpose:** Convert between binary and usable data  
**Rules:**
- Pure functions only
- No side effects
- No rendering logic
- Thoroughly validate input

### Layer 3: Player Runtime (Core)
**Files:** `HologlyphPlayer` class  
**Purpose:** Animation control and rendering  
**Rules:**
- Accept data, emit pixels
- No editor-specific code
- Minimal dependencies
- Performance-critical

### Layer 4: Editor Tools (Top)
**Files:** `editor.html`  
**Purpose:** Authoring interface  
**Rules:**
- Can be complex
- Can use frameworks (Bulma)
- Must produce standard `.glyf`
- Never modify player internals

**BOUNDARY RULE:** Higher layers can call lower layers. Lower layers NEVER call higher layers.

---

## File Structure (MAINTAIN ORGANIZATION)

### `hologlyph.js` Structure
```javascript
// 1. CONSTANTS (always first)
const HOLOGLYPH_MAGIC = "HGLY";
const HOLOGLYPH_VERSION = 1;
// ... all constants grouped

// 2. UTILITIES (pure functions)
export const HSBAUtil = { ... };
export function createHologlyphHeader() { ... }
export function parseHologlyphHeader() { ... }

// 3. PLAYER CLASS (single export)
export class HologlyphPlayer {
  constructor() { ... }
  // Public methods first
  play() { ... }
  pause() { ... }
  // Private methods last (prefixed with _)
  _renderWebGL() { ... }
  _initShaders() { ... }
}
```

### `editor.html` Structure
```html
<!-- 1. HEAD: Styles (Bulma + custom) -->
<!-- 2. BODY: UI structure (semantic HTML) -->
<!-- 3. SCRIPT: Logic (ES6 module) -->
<script type="module">
  // Order:
  // 1. Imports
  // 2. Constants
  // 3. State object
  // 4. Helper functions
  // 5. UI functions
  // 6. Event listeners
  // 7. Initialization
</script>
```

---

## Code Patterns (FOLLOW THESE)

### Pattern 1: Constant Extraction
```javascript
// Define at top of file or function
const BYTES_PER_VOXEL = 4;
const HEADER_SIZE = 28;
const GRID_MIN_SIZE = 1;
const GRID_MAX_SIZE = 32;
const DEFAULT_FRAME_DURATION = 100; // milliseconds

// Use throughout code
const frameSize = width * height * depth * BYTES_PER_VOXEL;
```

### Pattern 2: Voxel Indexing
```javascript
// ALWAYS use this order: Z → Y → X
for (let z = 0; z < depth; z++) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (z * height * width + y * width + x) * BYTES_PER_VOXEL;
      // ... process voxel
    }
  }
}
```

**WHY:** Z-major order is the canonical `.glyf` layout. Never deviate.

### Pattern 3: HSBA Encoding/Decoding
```javascript
// ALWAYS use HSBAUtil for consistency
import { HSBAUtil } from './hologlyph.js';

// Encoding
const pixel = HSBAUtil.encodePixel({ h: 128, s: 80, b: 60, a: 100 });

// Decoding
const { h, s, b, a } = HSBAUtil.decodePixel(bytes);
```

**WHY:** Single source of truth for color conversion.

### Pattern 4: WebGL State Management
```javascript
// ALWAYS clean up WebGL state after use
function _renderVoxels() {
  const gl = this.gl;
  
  // Set state
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
  
  try {
    // ... rendering
  } finally {
    // Restore state (even on error)
    gl.depthMask(true);
  }
}
```

### Pattern 5: Input Validation
```javascript
// ALWAYS validate at boundaries
function createHologlyphHeader(options = {}) {
  const width = Math.max(GRID_MIN_SIZE, Math.min(GRID_MAX_SIZE, options.width || DEFAULT_GRID_SIZE));
  const height = Math.max(GRID_MIN_SIZE, Math.min(GRID_MAX_SIZE, options.height || DEFAULT_GRID_SIZE));
  // ... clamp all inputs
}
```

**WHY:** Prevent invalid data from propagating.

---

## Anti-Patterns (NEVER DO THIS)

### ❌ Anti-Pattern 1: Magic Numbers
```javascript
// BAD
if (x > 32) { ... }

// GOOD
const GRID_MAX_SIZE = 32;
if (x > GRID_MAX_SIZE) { ... }
```

### ❌ Anti-Pattern 2: Editor Code in Player
```javascript
// BAD - in HologlyphPlayer
if (document.getElementById('projectName')) { ... }

// GOOD - editor manages its own state
// Player receives only data parameter
```

### ❌ Anti-Pattern 3: Breaking Format
```javascript
// BAD - changing existing header bytes
header[7] = 5; // Changed bytes per voxel

// GOOD - add new header bytes at end, version bump
// Or use reserved bytes with feature flag
```

### ❌ Anti-Pattern 4: Assume WebGL
```javascript
// BAD
const gl = canvas.getContext('webgl');
gl.enable(...); // crashes if gl is null

// GOOD
if (this.useWebGL && this.gl) {
  this.gl.enable(...);
} else {
  // 2D fallback
}
```

### ❌ Anti-Pattern 5: Nested Conditionals
```javascript
// BAD
if (useWebGL) {
  if (showGrid) {
    if (hasVoxels) { ... }
  }
}

// GOOD - early returns
if (!useWebGL) return this._render2D();
if (!showGrid) return this._renderVoxelsOnly();
if (!hasVoxels) return;
// ... main logic
```

---

## WebGL Rendering Rules

### Shader Invariants
- **Vertex shader** transforms voxel cubes with MVP matrices
- **Fragment shader** applies lighting to colors
- **Never** put game logic in shaders
- **Always** use uniform variables for configuration

### Geometry Rules
- **Cube:** 24 vertices (4 per face), 36 indices (2 triangles per face)
- **Normals:** Per-face, not per-vertex (for flat shading)
- **Winding:** Counter-clockwise for outward-facing triangles
- **Grid:** Separate geometry, rendered after voxels with `depthMask(false)`

### Matrix Rules
```javascript
// Order matters!
// 1. Projection (orthographic)
const projectionMatrix = this._createOrthographicMatrix(...);

// 2. View (camera position from orbital rotation)
const viewMatrix = this._createViewMatrix(distance);

// 3. Model (per voxel, translate to position)
const modelMatrix = this._createModelMatrix(x, y, z);

// Apply in shader: gl_Position = projection * view * model * position
```

### Coordinate System
```javascript
// Voxel space: (0,0,0) = top-left-front corner
// World space: centered at origin
const worldX = x - width / 2;
const worldY = y - height / 2;
const worldZ = z - depth / 2;
```

**RULE:** Always center the grid at world origin.

---

## Editor Patterns

### State Management
```javascript
// Single source of truth
const editorState = {
  // Project settings
  projectName: 'Untitled',
  width: 16,
  height: 16,
  depth: 16,
  frameCount: 1,
  
  // Animation
  currentFrame: 0,
  frameDurationMs: 100,
  loop: true,
  
  // Voxel data (4D array)
  voxelData: [], // [frame][z][y][x] -> {h,s,b,a}
  
  // View settings
  viewRotationX: 0.3,
  viewRotationY: 0.6,
  cameraZoom: 1.0,
};
```

**RULE:** Never scatter state across multiple objects.

### UI Updates
```javascript
// Pattern: Model → View (one direction)
function updatePreview() {
  // 1. Generate binary data from state
  const data = generateHologlyphData();
  
  // 2. Recreate player with new data
  if (player) player.destroy();
  player = new HologlyphPlayer({ ... });
  
  // 3. Update UI to reflect state
  updateStats();
}
```

**RULE:** State changes trigger UI updates, not vice versa.

### LocalStorage Pattern
```javascript
// Save projects as JSON
function saveProject(name, state) {
  const projects = JSON.parse(localStorage.getItem('hologlyph_projects') || '{}');
  projects[name] = {
    ...state,
    lastSaved: new Date().toISOString()
  };
  localStorage.setItem('hologlyph_projects', JSON.stringify(projects));
  localStorage.setItem('hologlyph_current_project', name);
}
```

**RULE:** Always store timestamps, always validate on load.

---

## Common Tasks (HOW TO)

### Adding a New Voxel Property
```javascript
// 1. Add to state
editorState.voxelData[frame][z][y][x].newProperty = value;

// 2. Add to binary encoding (careful!)
// If backward compatible: use reserved bits
// If not: bump version, extend bytes per voxel

// 3. Update HSBAUtil or create new encoder

// 4. Update renderer to use new property

// 5. Update editor UI
```

### Adding a New Shape Generator
```javascript
// 1. Add to shape select dropdown in editor.html
<option value="newshape">New Shape</option>

// 2. Add case to shape type change handler
document.getElementById('shapeType').addEventListener('change', (e) => {
  if (e.target.value === 'newshape') {
    // Show relevant dimension inputs
  }
});

// 3. Implement generation function
function generateNewShape(centerX, centerY, centerZ, ...params) {
  const voxels = [];
  // ... calculate which voxels are inside shape
  return voxels; // [{x, y, z}]
}

// 4. Add to generate shape handler
```

### Adding a New Camera Control
```javascript
// 1. Add UI input in editor.html (Camera panel)
// 2. Add property to editorState
// 3. Pass to HologlyphPlayer constructor
// 4. Use in _createViewMatrix or _createProjectionMatrix
// 5. Update on input change and call player.render()
```

### Adding a New Panel to Editor
```javascript
// 1. Add icon button to toolbar
<button class="toolbar-icon" data-panel="newpanel" title="New Tool">🔧</button>

// 2. Add panel HTML
<div class="panel" id="newpanel-panel" style="height: 300px;">
  <div class="panel-header">
    <h2>New Tool</h2>
    <button class="panel-close" data-panel="newpanel">✕</button>
  </div>
  <div class="panel-content">
    <!-- UI controls -->
  </div>
</div>

// 3. Panel toggle is automatic (existing JS handles it)
// 4. Add event listeners for panel controls
```

---

## Performance Rules

### Optimization Priorities
1. **Skip work** - Don't render invisible voxels (alpha=0, brightness=0)
2. **Batch work** - Draw all voxels in one render pass
3. **Cache work** - Reuse geometry buffers
4. **Defer work** - Use requestAnimationFrame, not setInterval

### Voxel Count Limits
```javascript
const OPTIMAL_VOXEL_COUNT = 16 * 16 * 16; // 4,096 voxels
const MAX_VOXEL_COUNT = 32 * 32 * 32;     // 32,768 voxels
const MAX_GRID_DIMENSION = 32;            // per axis

// Warn users if exceeded
if (totalVoxels > MAX_VOXEL_COUNT) {
  console.warn('Large voxel count may impact performance');
}
```

### Rendering Budget
- **Target:** 60 FPS (16.67ms per frame)
- **Budget per frame:**
  - Parse voxel data: 1-2ms
  - WebGL draw calls: 10-12ms
  - Browser compositing: 2-3ms
- **Rule:** If frame time > 16ms, reduce complexity

### Memory Management
```javascript
// ALWAYS clean up
destroy() {
  // Remove event listeners
  this.canvas.removeEventListener('mousedown', this._onMouseDown);
  
  // Clear WebGL resources
  if (this.gl) {
    this.gl.deleteBuffer(this.cubePositionBuffer);
    this.gl.deleteBuffer(this.cubeNormalBuffer);
    // ... delete all buffers
  }
  
  // Clear references
  this.canvas = null;
  this._u8 = null;
}
```

---

## Testing Checklist

### Before Committing Changes
- [ ] Test both WebGL and 2D rendering modes
- [ ] Test on small (8³) and large (32³) grids
- [ ] Test single frame and multi-frame animations
- [ ] Test export/import round-trip (data integrity)
- [ ] Test orbital drag and zoom on desktop
- [ ] Test touch controls on mobile emulator
- [ ] Test with different color combinations (edge cases)
- [ ] Verify no console errors or warnings
- [ ] Check no magic numbers introduced
- [ ] Verify all constants are extracted and named

### File Format Compatibility
```javascript
// ALWAYS test backward compatibility
const oldFile = loadTestFile('v1_legacy.glyf');
const header = parseHologlyphHeader(oldFile);
assert(header.version === 1);
// ... should parse without errors
```

### Edge Cases to Test
- Empty grid (no voxels)
- Fully filled grid (all voxels)
- Single voxel at each corner
- Alpha = 0 voxels (should skip rendering)
- Brightness = 0 voxels (black, should skip or render black)
- Frame count = 1 (no animation)
- Frame duration = 0 (should handle gracefully)
- Grid dimensions: 1×1×1, 32×32×32, and asymmetric (8×16×4)

---

## Debugging Strategies

### WebGL Rendering Issues
```javascript
// 1. Check for GL errors after operations
function checkGLError(gl, operation) {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error(`WebGL error after ${operation}:`, error);
  }
}

// 2. Verify shader compilation
if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
  console.error('Shader compile error:', gl.getShaderInfoLog(shader));
}

// 3. Verify program linking
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error('Program link error:', gl.getProgramInfoLog(program));
}

// 4. Log matrix values
console.log('Projection:', projectionMatrix);
console.log('View:', viewMatrix);
console.log('Model:', modelMatrix);
```

### Data Format Issues
```javascript
// 1. Verify header parsing
const header = parseHologlyphHeader(data);
console.log('Header:', header);
assert(header.magic === 'HGLY');

// 2. Check voxel data bounds
const expectedSize = 28 + (width * height * depth * 4 * frameCount);
assert(data.length === expectedSize);

// 3. Inspect individual voxels
const offset = 28; // first voxel of first frame
const h = data[offset];
const s = data[offset + 1];
const b = data[offset + 2];
const a = data[offset + 3];
console.log(`Voxel (0,0,0):`, { h, s, b, a });
```

### Editor State Issues
```javascript
// 1. Log state changes
console.log('State before:', JSON.parse(JSON.stringify(editorState)));
// ... make change
console.log('State after:', JSON.parse(JSON.stringify(editorState)));

// 2. Verify voxel data structure
assert(Array.isArray(editorState.voxelData));
assert(editorState.voxelData.length === editorState.frameCount);

// 3. Check localStorage
const saved = JSON.parse(localStorage.getItem('hologlyph_projects'));
console.log('Saved projects:', saved);
```

---

## Version Management

### Current Version: 1
- Header size: 28 bytes
- Color model: HSBA_255_100
- Bytes per voxel: 4

### Future Versions (Guidelines)
- **Version 2:** Could add compression flag (use reserved bytes)
- **Version 3:** Could extend header size (update header size byte)
- **Rule:** Parser must handle unknown versions gracefully

```javascript
// Version handling pattern
function parseHologlyphHeader(input) {
  const version = u8[4];
  
  if (version > HOLOGLYPH_VERSION) {
    console.warn(`Future version ${version} detected, may not parse correctly`);
  }
  
  if (version < HOLOGLYPH_VERSION) {
    // Handle legacy format
    return parseLegacyHeader(input, version);
  }
  
  // Parse current version
  // ...
}
```

---

## Coding Style

### Naming Conventions
- **Constants:** `ALL_CAPS_WITH_UNDERSCORES`
- **Functions:** `camelCase`
- **Classes:** `PascalCase`
- **Private methods:** `_leadingUnderscore`
- **DOM IDs:** `camelCase` (match JS)
- **CSS classes:** `kebab-case` or Bulma classes

### Comments
```javascript
// Good comments explain WHY, not WHAT

// ❌ BAD
// Set x to 5
const x = 5;

// ✅ GOOD
// Offset by half grid width to center at origin
const offsetX = width / 2;

// ✅ GOOD
const MAX_ROTATION_X = Math.PI / 2; // radians - prevent camera flip
```

### Function Length
- **Ideal:** 20-30 lines
- **Max:** 50 lines
- **If longer:** Extract helper functions

### File Length
- **`hologlyph.js`:** Should stay under 1500 lines
- **`editor.html`:** Should stay under 2500 lines
- **If exceeded:** Consider splitting into modules

---

## Security Considerations

### User Input Validation
```javascript
// ALWAYS validate user input
function setVoxelPosition(x, y, z) {
  if (x < 0 || x >= width) throw new Error('X out of bounds');
  if (y < 0 || y >= height) throw new Error('Y out of bounds');
  if (z < 0 || z >= depth) throw new Error('Z out of bounds');
  // ... safe to proceed
}
```

### File Import Validation
```javascript
// ALWAYS validate imported files
function importFile(data) {
  if (data.length < 28) {
    throw new Error('File too small to be valid .glyf');
  }
  
  const header = parseHologlyphHeader(data);
  if (header.magic !== 'HGLY') {
    throw new Error('Invalid magic number');
  }
  
  const expectedSize = 28 + (header.frameSizeBytes * header.frameCount);
  if (data.length !== expectedSize) {
    throw new Error('File size mismatch');
  }
  
  // ... safe to use
}
```

### LocalStorage Limits
```javascript
// LocalStorage limit: ~5-10MB per domain
// Check size before saving
function saveProject(name, state) {
  const serialized = JSON.stringify(state);
  const sizeKB = new Blob([serialized]).size / 1024;
  
  if (sizeKB > 5000) { // 5MB warning
    console.warn('Project size large, may hit localStorage limits');
  }
  
  try {
    localStorage.setItem('hologlyph_projects', serialized);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Storage full. Please delete old projects.');
    }
  }
}
```

---

## Error Handling Patterns

### Graceful Degradation
```javascript
// Try WebGL, fall back to 2D
try {
  this.gl = canvas.getContext('webgl');
  if (this.gl) {
    this._initWebGL();
    this.useWebGL = true;
  } else {
    throw new Error('WebGL not available');
  }
} catch (e) {
  console.warn('Falling back to 2D rendering:', e.message);
  this.ctx = canvas.getContext('2d');
  this.useWebGL = false;
}
```

### User-Facing Errors
```javascript
// Show helpful messages to users
try {
  const data = generateHologlyphData();
  exportFile(data);
} catch (e) {
  alert(`Export failed: ${e.message}\nPlease check your project settings.`);
  console.error('Export error:', e);
}
```

### Silent Failures (When Appropriate)
```javascript
// Auto-save can fail silently
function autoSave() {
  try {
    saveProject(editorState.projectName, editorState);
  } catch (e) {
    console.warn('Auto-save failed:', e);
    // Don't interrupt user workflow
  }
}
```

---

## Documentation Requirements

### When Adding Features
1. Update `README.md` with user-facing documentation
2. Update `agents.md` with implementation details (this file)
3. Add inline comments for complex logic
4. Add JSDoc for public API functions

### JSDoc Pattern
```javascript
/**
 * Create a Hologlyph header from configuration options.
 * 
 * @param {Object} options - Header configuration
 * @param {number} [options.width=32] - Grid width (1-32)
 * @param {number} [options.height=32] - Grid height (1-32)
 * @param {number} [options.depth=32] - Grid depth (1-32)
 * @param {number} [options.frameCount=1] - Number of frames
 * @param {number} [options.frameDurationMs=100] - Frame duration in milliseconds
 * @param {boolean} [options.loop=true] - Whether animation loops
 * @returns {Object} Object with {header, totalSize, frameSizeBytes}
 * @returns {Uint8Array} returns.header - 28-byte header buffer
 * @returns {number} returns.totalSize - Total file size in bytes
 * @returns {number} returns.frameSizeBytes - Size of single frame's voxel data in bytes
 */
export function createHologlyphHeader(options = {}) {
  // ...
}
```

---

## Decision Framework

### When Changing Code, Ask:

1. **Does this break the binary format?**
   - If yes → Version bump required
   - If no → Proceed

2. **Does this add player complexity?**
   - If yes → Can it be in editor instead?
   - If no → Proceed

3. **Does this introduce magic numbers?**
   - If yes → Extract to constants first
   - If no → Proceed

4. **Does this work in both rendering modes?**
   - If no → Add fallback or document limitation
   - If yes → Proceed

5. **Is this deterministic?**
   - If no → Redesign for determinism
   - If yes → Proceed

6. **Is this tested?**
   - If no → Test before committing
   - If yes → Proceed

---

## Final Rules for AI Agents

1. **When in doubt, ask the user** - Don't make breaking changes without confirmation
2. **Preserve backward compatibility** - Old `.glyf` files must always work
3. **Follow existing patterns** - Match the style of surrounding code
4. **Extract constants first** - Before adding any numeric literals
5. **Test both modes** - WebGL and 2D must both work
6. **Document changes** - Update this file and README.md
7. **Clean up after yourself** - No debug logs, no commented code
8. **Think in layers** - Respect architectural boundaries
9. **Optimize last** - Correctness first, then performance
10. **Keep it simple** - The simplest solution is usually the best

---

## Summary

Hologlyph is:
- **Format-first:** `.glyf` is the source of truth
- **Lean runtime:** Player stays minimal
- **Rich authoring:** Editor can be complex
- **Universal:** Works everywhere
- **Deterministic:** Reproducible output
- **Open:** Anyone can extend

When making changes, preserve these qualities.

**The goal:** Make voxel animations as ubiquitous as GIFs, with the ease of dropping a file into a page.

---

*This document should be the first thing an AI agent reads before modifying Hologlyph code.*

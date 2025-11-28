// =============================================================
//  HOLOGLYPH.JS — Full ES6 Library (Single-file version)
//  Includes:
//    - HSBA Pixel Utilities
//    - Hologlyph Header Builder + Parser
//    - Hologlyph Player (Canvas Renderer)
// =============================================================

// -----------------------------
// Utility Functions
// -----------------------------
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function percentToByte(percent) {
  const p = clamp(Number(percent) || 0, 0, 100);
  return Math.round((p / 100) * 255);
}

function byteToPercent(byte) {
  const b = clamp(Number(byte) || 0, 0, 255);
  return Math.round((b / 255) * 100);
}

function normalizeHsbaInput(input) {
  if (Array.isArray(input)) {
    const [h, s, b, a] = input;
    return { h, s, b, a };
  }
  if (typeof input === "string") {
    const parts = input.split(",").map(v => v.trim());
    if (parts.length !== 4) throw new Error("HSBA string must have 4 values");
    const [h, s, b, a] = parts.map(Number);
    return { h, s, b, a };
  }
  if (typeof input === "object" && input !== null) {
    return input;
  }
  throw new Error("Invalid HSBA input format");
}

// -----------------------------
// HSBA Pixel Utilities
// -----------------------------
export const HSBAUtil = {
  encodePixel(input) {
    const { h, s, b, a } = normalizeHsbaInput(input);
    const hByte = clamp(Math.round(Number(h) || 0), 0, 255);
    const sByte = percentToByte(s);
    const bByte = percentToByte(b);
    const aByte = percentToByte(a);
    return new Uint8Array([hByte, sByte, bByte, aByte]);
  },

  decodePixel(bytes) {
    const [h, sByte, bByte, aByte] = bytes;
    return {
      h: clamp(Number(h) || 0, 0, 255),
      s: byteToPercent(sByte),
      b: byteToPercent(bByte),
      a: byteToPercent(aByte),
    };
  },
};

// -----------------------------
// Hologlyph Header Spec (v1.1)
// -----------------------------
export const HOLOGLYPH_MAGIC = "HGLY";
export const HOLOGLYPH_VERSION = 1;

export const COLOR_MODEL = {
  HSBA_255_100: 0,
};

export const COMPRESSION_TYPE = {
  NONE: 0,      // No compression (raw voxel data)
  RLE: 1,       // Run-Length Encoding
};

const MAX_RLE_RUN = 255; // Maximum run length for RLE

// Grid rendering constants
const GRID_COLOR_R = 0.4; // Red component (0-1)
const GRID_COLOR_G = 0.4; // Green component (0-1)
const GRID_COLOR_B = 0.5; // Blue component (0-1)
const GRID_COLOR_A = 0.3; // Alpha component (0-1)

export function createHologlyphHeader(options = {}) {
  const {
    width = 32,
    height = 32,
    depth = 32,
    frameCount = 1,
    frameDurationMs = 100,
    loop = true,
    loopStartFrame = 0,
    bytesPerVoxel = 4,
    colorModel = COLOR_MODEL.HSBA_255_100,
    compressionType = COMPRESSION_TYPE.NONE,
  } = options;

  const headerSize = 28;
  const buffer = new ArrayBuffer(headerSize);
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);

  // Magic "HGLY"
  for (let i = 0; i < 4; i++) {
    u8[i] = HOLOGLYPH_MAGIC.charCodeAt(i);
  }

  u8[4] = HOLOGLYPH_VERSION;
  u8[5] = headerSize;

  let flags = 0;
  if (loop) flags |= 0b00000001;
  u8[6] = flags;

  u8[7] = bytesPerVoxel;
  u8[8] = width;
  u8[9] = height;
  u8[10] = depth;
  u8[11] = colorModel;

  dv.setUint32(12, frameCount, true);
  dv.setUint32(16, frameDurationMs, true);
  dv.setUint32(20, 0, true); // reserved
  dv.setUint32(24, loopStartFrame, true);
  
  // Byte 23: Compression type (was reserved)
  u8[23] = compressionType;

  return u8;
}

export function parseHologlyphHeader(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (u8.length < 28) throw new Error("Invalid hologlyph buffer");

  const magic =
    String.fromCharCode(u8[0]) +
    String.fromCharCode(u8[1]) +
    String.fromCharCode(u8[2]) +
    String.fromCharCode(u8[3]);

  if (magic !== HOLOGLYPH_MAGIC) throw new Error("Invalid magic");

  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const flags = u8[6];
  const loop = (flags & 0x01) !== 0;

  const width = u8[8];
  const height = u8[9];
  const depth = u8[10];
  const bytesPerVoxel = u8[7];

  const frameCount = dv.getUint32(12, true);
  const frameDurationMs = dv.getUint32(16, true);
  const loopStartFrame = dv.getUint32(24, true);

  const compressionType = u8[23] || COMPRESSION_TYPE.NONE; // Default to no compression for old files
  const frameSizeBytes = width * height * depth * bytesPerVoxel;

  return {
    magic,
    version: u8[4],
    headerSize: u8[5],
    loop,
    loopStartFrame,
    bytesPerVoxel,
    width,
    height,
    depth,
    colorModel: u8[11],
    compressionType,
    frameCount,
    frameDurationMs,
    frameSizeBytes,
    dataOffset: 28,
  };
}

// -----------------------------
// Export Helpers
// -----------------------------

/**
 * Export a buffer (header + voxel data) to a downloadable .glyf file
 * @param {Uint8Array} buffer - Complete .glyf file data
 * @param {string} filename - Desired filename (default: "hologlyph.glyf")
 * @param {boolean} compress - Whether to compress with RLE (default: true)
 * @returns {Blob} - Blob object for the file
 */
export function exportToFile(buffer, filename = "hologlyph.glyf", compress = true) {
  let exportData = buffer;
  
  if (compress) {
    const original = buffer.length;
    exportData = compressGlyfFile(buffer);
    const stats = getCompressionStats(buffer, exportData);
    console.log(`Compressed: ${original} → ${exportData.length} bytes (${stats.savings} savings)`);
  }
  
  const blob = new Blob([exportData], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
  
  return blob;
}

/**
 * Convert a buffer to a Blob without triggering download
 * @param {Uint8Array} buffer - Complete .glyf file data
 * @returns {Blob} - Blob object for the file
 */
export function toBlob(buffer) {
  return new Blob([buffer], { type: "application/octet-stream" });
}

/**
 * Export a simulation/generator function to a .glyf file
 * @param {Function} generatorFn - Function that returns Uint8Array buffer
 * @param {string} filename - Desired filename (default: "simulation.glyf")
 * @param {boolean} compress - Whether to compress with RLE (default: true)
 * @param {...any} args - Arguments to pass to the generator function
 * @returns {Blob} - Blob object for the file
 */
export function exportSimulation(generatorFn, filename = "simulation.glyf", compress = true, ...args) {
  const buffer = generatorFn(...args);
  return exportToFile(buffer, filename, compress);
}

// -----------------------------
// Compression Utilities
// -----------------------------

/**
 * Compress voxel data using Run-Length Encoding (RLE)
 * Format: [count, H, S, B, A] repeated
 * Count = number of consecutive identical voxels (1-255)
 * @param {Uint8Array} voxelData - Raw voxel data (header excluded)
 * @returns {Uint8Array} - Compressed data
 */
export function compressRLE(voxelData) {
  if (voxelData.length === 0) return new Uint8Array(0);
  if (voxelData.length % 4 !== 0) throw new Error("Voxel data must be multiple of 4 bytes");
  
  const compressed = [];
  let i = 0;
  
  while (i < voxelData.length) {
    // Current voxel
    const h = voxelData[i];
    const s = voxelData[i + 1];
    const b = voxelData[i + 2];
    const a = voxelData[i + 3];
    
    // Count consecutive identical voxels
    let count = 1;
    let j = i + 4;
    
    while (j < voxelData.length && count < MAX_RLE_RUN) {
      if (voxelData[j] === h &&
          voxelData[j + 1] === s &&
          voxelData[j + 2] === b &&
          voxelData[j + 3] === a) {
        count++;
        j += 4;
      } else {
        break;
      }
    }
    
    // Write [count, H, S, B, A]
    compressed.push(count, h, s, b, a);
    i = j;
  }
  
  return new Uint8Array(compressed);
}

/**
 * Decompress RLE-encoded voxel data
 * @param {Uint8Array} compressedData - RLE compressed data
 * @param {number} expectedLength - Expected decompressed length in bytes
 * @returns {Uint8Array} - Decompressed voxel data
 */
export function decompressRLE(compressedData, expectedLength) {
  const decompressed = new Uint8Array(expectedLength);
  let writePos = 0;
  let readPos = 0;
  
  while (readPos < compressedData.length && writePos < expectedLength) {
    const count = compressedData[readPos];
    const h = compressedData[readPos + 1];
    const s = compressedData[readPos + 2];
    const b = compressedData[readPos + 3];
    const a = compressedData[readPos + 4];
    
    // Write 'count' copies of this voxel
    for (let i = 0; i < count; i++) {
      if (writePos + 4 > expectedLength) break;
      decompressed[writePos] = h;
      decompressed[writePos + 1] = s;
      decompressed[writePos + 2] = b;
      decompressed[writePos + 3] = a;
      writePos += 4;
    }
    
    readPos += 5; // Move to next run
  }
  
  if (writePos !== expectedLength) {
    console.warn(`RLE decompression mismatch: expected ${expectedLength}, got ${writePos}`);
  }
  
  return decompressed;
}

/**
 * Compress a complete .glyf file buffer (header + voxel data)
 * @param {Uint8Array} buffer - Uncompressed .glyf file
 * @returns {Uint8Array} - Compressed .glyf file
 */
export function compressGlyfFile(buffer) {
  const header = parseHologlyphHeader(buffer);
  
  // Already compressed?
  if (header.compressionType !== COMPRESSION_TYPE.NONE) {
    console.warn('File is already compressed');
    return buffer;
  }
  
  // Extract header and voxel data
  const headerBytes = buffer.slice(0, 28);
  const voxelData = buffer.slice(28);
  
  // Compress voxel data
  const compressedVoxels = compressRLE(voxelData);
  
  // Create new header with compression flag
  const newHeader = createHologlyphHeader({
    width: header.width,
    height: header.height,
    depth: header.depth,
    frameCount: header.frameCount,
    frameDurationMs: header.frameDurationMs,
    loop: header.loop,
    loopStartFrame: header.loopStartFrame,
    bytesPerVoxel: header.bytesPerVoxel,
    colorModel: header.colorModel,
    compressionType: COMPRESSION_TYPE.RLE
  });
  
  // Combine new header + compressed data
  const result = new Uint8Array(newHeader.length + compressedVoxels.length);
  result.set(newHeader, 0);
  result.set(compressedVoxels, newHeader.length);
  
  return result;
}

/**
 * Decompress a complete .glyf file buffer if needed
 * @param {Uint8Array} buffer - Possibly compressed .glyf file
 * @returns {Uint8Array} - Decompressed .glyf file (raw format)
 */
export function decompressGlyfFile(buffer) {
  const header = parseHologlyphHeader(buffer);
  
  // Not compressed?
  if (header.compressionType === COMPRESSION_TYPE.NONE) {
    return buffer;
  }
  
  if (header.compressionType === COMPRESSION_TYPE.RLE) {
    const compressedVoxels = buffer.slice(28);
    const expectedLength = header.frameSizeBytes * header.frameCount;
    const decompressedVoxels = decompressRLE(compressedVoxels, expectedLength);
    
    // Create new header without compression
    const newHeader = createHologlyphHeader({
      width: header.width,
      height: header.height,
      depth: header.depth,
      frameCount: header.frameCount,
      frameDurationMs: header.frameDurationMs,
      loop: header.loop,
      loopStartFrame: header.loopStartFrame,
      bytesPerVoxel: header.bytesPerVoxel,
      colorModel: header.colorModel,
      compressionType: COMPRESSION_TYPE.NONE
    });
    
    // Combine header + decompressed data
    const result = new Uint8Array(newHeader.length + decompressedVoxels.length);
    result.set(newHeader, 0);
    result.set(decompressedVoxels, newHeader.length);
    
    return result;
  }
  
  throw new Error(`Unknown compression type: ${header.compressionType}`);
}

/**
 * Calculate compression ratio
 * @param {Uint8Array} original - Original buffer
 * @param {Uint8Array} compressed - Compressed buffer
 * @returns {object} - { originalSize, compressedSize, ratio, savings }
 */
export function getCompressionStats(original, compressed) {
  const originalSize = original.length;
  const compressedSize = compressed.length;
  const ratio = compressedSize / originalSize;
  const savings = ((1 - ratio) * 100).toFixed(1);
  
  return {
    originalSize,
    compressedSize,
    ratio: ratio.toFixed(3),
    savings: `${savings}%`,
    smaller: compressedSize < originalSize
  };
}

// -----------------------------
// HSBA → RGBA Converter
// -----------------------------
function hsbToRgba(h, s, b, aPercent) {
  const hDeg = (h / 255) * 360;
  const sNorm = s / 100;
  const v = b / 100;
  const a = aPercent / 100;

  if (sNorm === 0) {
    const g = Math.round(v * 255);
    return `rgba(${g},${g},${g},${a})`;
  }

  const c = v * sNorm;
  const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1));
  const m = v - c;

  let r1, g1, b1;
  if (hDeg < 60)      { r1 = c; g1 = x; b1 = 0; }
  else if (hDeg < 120){ r1 = x; g1 = c; b1 = 0; }
  else if (hDeg < 180){ r1 = 0; g1 = c; b1 = x; }
  else if (hDeg < 240){ r1 = 0; g1 = x; b1 = c; }
  else if (hDeg < 300){ r1 = x; g1 = 0; b1 = c; }
  else                { r1 = c; g1 = 0; b1 = x; }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const bl = Math.round((b1 + m) * 255);

  return `rgba(${r},${g},${bl},${a})`;
}

// -----------------------------
// Hologlyph Player (Canvas Renderer)
// -----------------------------
/**
 * HologlyphPlayer - Render and play .glyf voxel animations
 * 
 * @param {Object} options - Configuration options
 * @param {HTMLCanvasElement} options.canvas - Canvas element to render to
 * @param {Uint8Array} options.data - Hologlyph data buffer
 * @param {Function} [options.dataGenerator=null] - Optional function to generate data dynamically
 * @param {boolean} [options.autoPlay=true] - Start playing immediately
 * @param {number} [options.voxelSize=8] - Size of each voxel in pixels
 * @param {boolean} [options.orbitalDrag=false] - Enable mouse drag to rotate camera
 * @param {boolean} [options.useWebGL=false] - Use WebGL renderer (falls back to 2D)
 * @param {boolean} [options.showGrid=false] - Show per-voxel wireframe grid (deprecated)
 * @param {boolean} [options.showBoundingBox=false] - Show dynamic bounding box grid
 * @param {number} [options.initialRotationX=0.3] - Initial camera rotation X (radians)
 * @param {number} [options.initialRotationY=0.6] - Initial camera rotation Y (radians)
 */
export class HologlyphPlayer {
  constructor({ canvas, data, dataGenerator = null, autoPlay = true, voxelSize = 8, orbitalDrag = false, useWebGL = false, showGrid = false, showBoundingBox = false, initialRotationX = 0.3, initialRotationY = 0.6 }) {
    if (!canvas) throw new Error("HologlyphPlayer needs a canvas");
    this.canvas = canvas;
    this.useWebGL = useWebGL;
    this.showGrid = showGrid;
    this.showBoundingBox = showBoundingBox;
    
    // Convert to Uint8Array and decompress if needed
    let rawData = data instanceof Uint8Array ? data : new Uint8Array(data);
    const tempHeader = parseHologlyphHeader(rawData);
    
    // Auto-decompress if compressed
    if (tempHeader.compressionType !== COMPRESSION_TYPE.NONE) {
      console.log(`Decompressing .glyf file (type: ${tempHeader.compressionType})...`);
      rawData = decompressGlyfFile(rawData);
      console.log(`Decompressed: ${tempHeader.frameSizeBytes * tempHeader.frameCount} bytes`);
    }
    
    this._u8 = rawData;
    this.header = parseHologlyphHeader(this._u8);

    this.width = this.header.width;
    this.height = this.header.height;
    this.depth = this.header.depth;
    
    // Initialize rendering AFTER dimensions are set
    if (useWebGL) {
      this.gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!this.gl) throw new Error("WebGL not supported");
      this._initWebGL();
    } else {
      this.ctx = canvas.getContext("2d");
    }
    this.frameCount = this.header.frameCount;
    this.frameSizeBytes = this.header.frameSizeBytes;
    this.dataOffset = this.header.dataOffset;

    this.frameDurationMs = this.header.frameDurationMs;
    this.loop = this.header.loop;
    this.loopStartFrame = this.header.loopStartFrame;

    this.bytesPerVoxel = this.header.bytesPerVoxel;
    this.voxelSize = voxelSize;

    this.currentFrame = 0;
    this._playing = false;
    this._lastTs = 0;
    this._accum = 0;

    // Orbital drag support and camera rotation
    this.dataGenerator = dataGenerator;
    this.viewRotationX = initialRotationX;
    this.viewRotationY = initialRotationY;
    this.zoomLevel = 1.0;
    
    if (orbitalDrag) {
      this._setupOrbitalDrag();
    }
    
    if (useWebGL) {
      this._setupZoomControls();
    }

    if (autoPlay) this.play();
  }

  _setupZoomControls() {
    const canvas = this.canvas;
    const MIN_ZOOM = 0.3;
    const MAX_ZOOM = 3.0;
    const ZOOM_SENSITIVITY = 0.1;
    
    // Mouse wheel zoom
    const onWheel = (e) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 1 : -1;
      this.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomLevel + delta * ZOOM_SENSITIVITY));
      
      // Update zoom input fields if they exist (editor mode)
      const zoomInput = document.getElementById('cameraZoom');
      const zoomValueInput = document.getElementById('cameraZoomValue');
      if (zoomInput) zoomInput.value = this.zoomLevel.toFixed(1);
      if (zoomValueInput) zoomValueInput.value = this.zoomLevel.toFixed(1);
      
      this.render();
    };
    
    canvas.addEventListener('wheel', onWheel, { passive: false });
    
    // Touch pinch zoom
    let touchStartDistance = 0;
    let touchStartZoom = 1.0;
    
    const getTouchDistance = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchStartDistance = getTouchDistance(e.touches);
        touchStartZoom = this.zoomLevel;
      }
    };
    
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / touchStartDistance;
        this.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStartZoom * scale));
        
        // Update zoom input fields if they exist (editor mode)
        const zoomInput = document.getElementById('cameraZoom');
        const zoomValueInput = document.getElementById('cameraZoomValue');
        if (zoomInput) zoomInput.value = this.zoomLevel.toFixed(1);
        if (zoomValueInput) zoomValueInput.value = this.zoomLevel.toFixed(1);
        
        this.render();
      }
    };
    
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    
    // Store handlers for cleanup
    this._zoomHandlers = { onWheel, onTouchStart, onTouchMove };
  }

  _setupOrbitalDrag() {
    const canvas = this.canvas;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    const DRAG_SENSITIVITY = 0.005;
    const MAX_ROTATION_X = Math.PI / 2;
    
    const onMouseDown = (e) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };
    
    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;
      
      this.viewRotationY -= deltaX * DRAG_SENSITIVITY;
      this.viewRotationX += deltaY * DRAG_SENSITIVITY;
      
      // Clamp X rotation to prevent flipping
      this.viewRotationX = Math.max(-MAX_ROTATION_X, Math.min(MAX_ROTATION_X, this.viewRotationX));
      
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      
      // Update camera input fields if they exist (editor mode)
      const rotXInput = document.getElementById('cameraRotX');
      const rotYInput = document.getElementById('cameraRotY');
      if (rotXInput) rotXInput.value = this.viewRotationX.toFixed(2);
      if (rotYInput) rotYInput.value = this.viewRotationY.toFixed(2);
      
      // Update view
      if (this.useWebGL) {
        // For WebGL, just re-render with new camera rotation
        this.render();
      } else {
        // For 2D canvas, regenerate data with new view rotation
        this._reloadData();
      }
    };
    
    const onMouseUp = () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    };
    
    const onMouseLeave = () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    };
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    
    canvas.style.cursor = 'grab';
    
    // Store handlers for cleanup
    this._dragHandlers = { onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
  }

  _reloadData() {
    if (!this.dataGenerator) return;
    
    const wasPlaying = this._playing;
    const currentFrame = this.currentFrame;
    
    // Generate new data with current view rotation
    const newData = this.dataGenerator(this.viewRotationX, this.viewRotationY);
    this._u8 = newData instanceof Uint8Array ? newData : new Uint8Array(newData);
    this.header = parseHologlyphHeader(this._u8);
    
    this.currentFrame = Math.min(currentFrame, this.header.frameCount - 1);
    
    if (!wasPlaying) {
      this.render();
    }
  }

  _initWebGL() {
    const gl = this.gl;
    
    // Vertex shader
    const vertexShaderSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec4 aColor;
      
      uniform mat4 uModelMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uProjectionMatrix;
      
      varying vec4 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
        vPosition = worldPosition.xyz;
        vNormal = mat3(uModelMatrix) * aNormal;
        vColor = aColor;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
      }
    `;
    
    // Fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec4 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      uniform vec3 uLightDirection;
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightDirection);
        
        float ambient = 0.4;
        float diffuse = max(dot(normal, lightDir), 0.0) * 0.6;
        float lighting = ambient + diffuse;
        
        gl_FragColor = vec4(vColor.rgb * lighting, vColor.a);
      }
    `;
    
    // Compile shaders
    const vertexShader = this._createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link failed: " + gl.getProgramInfoLog(program));
    }
    
    this.program = program;
    
    // Get attribute and uniform locations
    this.attribLocations = {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      color: gl.getAttribLocation(program, "aColor"),
    };
    
    this.uniformLocations = {
      modelMatrix: gl.getUniformLocation(program, "uModelMatrix"),
      viewMatrix: gl.getUniformLocation(program, "uViewMatrix"),
      projectionMatrix: gl.getUniformLocation(program, "uProjectionMatrix"),
      lightDirection: gl.getUniformLocation(program, "uLightDirection"),
    };
    
    // Create cube geometry
    this._createCubeGeometry();
    
    // Create grid geometry if needed
    if (this.showGrid || this.showBoundingBox) {
      this._createGridGeometry();
    }
    
    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Shader compile failed: " + info);
    }
    
    return shader;
  }

  _createCubeGeometry() {
    const gl = this.gl;
    
    // Cube vertices (24 vertices, 4 per face for proper normals)
    // Counter-clockwise winding for outward-facing normals
    const positions = new Float32Array([
      // Front face (z+)
      -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
      // Back face (z-)
       0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
      // Top face (y+)
      -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
      // Bottom face (y-)
      -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5,
      // Right face (x+)
       0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,
      // Left face (x-)
      -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
    ]);
    
    // Normals for each face
    const normals = new Float32Array([
      // Front
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      // Back
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Top
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // Bottom
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      // Right
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      // Left
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    ]);
    
    // Indices for triangles (2 per face, 6 faces)
    const indices = new Uint16Array([
      0, 1, 2,  0, 2, 3,    // Front
      4, 5, 6,  4, 6, 7,    // Back
      8, 9, 10, 8, 10, 11,  // Top
      12, 13, 14, 12, 14, 15, // Bottom
      16, 17, 18, 16, 18, 19, // Right
      20, 21, 22, 20, 22, 23, // Left
    ]);
    
    // Create buffers
    this.cubeBuffers = {
      position: gl.createBuffer(),
      normal: gl.createBuffer(),
      indices: gl.createBuffer(),
    };
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeBuffers.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    this.cubeIndexCount = indices.length;
  }

  _createGridGeometry() {
    const gl = this.gl;
    
    // Create a wireframe cube outline (12 edges)
    const lines = new Float32Array([
      // Bottom face edges
      -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,
       0.5, -0.5, -0.5,  0.5, -0.5,  0.5,
       0.5, -0.5,  0.5, -0.5, -0.5,  0.5,
      -0.5, -0.5,  0.5, -0.5, -0.5, -0.5,
      // Top face edges
      -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
       0.5,  0.5, -0.5,  0.5,  0.5,  0.5,
       0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
      -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
      // Vertical edges
      -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,
       0.5, -0.5, -0.5,  0.5,  0.5, -0.5,
       0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
      -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,
    ]);
    
    this.gridBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, lines, gl.STATIC_DRAW);
    
    this.gridLineCount = lines.length / 3;
    
    // Create bounding box face grids for back-face rendering
    this._createBoundingBoxGeometry();
  }
  
  _createBoundingBoxGeometry() {
    const gl = this.gl;
    const { width, height, depth } = this;
    
    const GRID_DIVISIONS_X = width;
    const GRID_DIVISIONS_Y = height;
    const GRID_DIVISIONS_Z = depth;
    
    // Store geometry for each face of the bounding box
    this.boundingBoxFaces = {
      // Front face (Z = depth/2)
      front: this._createFaceGrid(GRID_DIVISIONS_X, GRID_DIVISIONS_Y, 'xy', depth / 2),
      // Back face (Z = -depth/2)
      back: this._createFaceGrid(GRID_DIVISIONS_X, GRID_DIVISIONS_Y, 'xy', -depth / 2),
      // Right face (X = width/2)
      right: this._createFaceGrid(GRID_DIVISIONS_Z, GRID_DIVISIONS_Y, 'zy', width / 2),
      // Left face (X = -width/2)
      left: this._createFaceGrid(GRID_DIVISIONS_Z, GRID_DIVISIONS_Y, 'zy', -width / 2),
      // Top face (Y = height/2)
      top: this._createFaceGrid(GRID_DIVISIONS_X, GRID_DIVISIONS_Z, 'xz', height / 2),
      // Bottom face (Y = -height/2)
      bottom: this._createFaceGrid(GRID_DIVISIONS_X, GRID_DIVISIONS_Z, 'xz', -height / 2),
    };
  }
  
  _createFaceGrid(divisionsU, divisionsV, plane, offset) {
    const gl = this.gl;
    const lines = [];
    
    const { width, height, depth } = this;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    
    // Generate grid lines based on plane orientation
    if (plane === 'xy') {
      // Front/Back face (perpendicular to Z)
      // Horizontal lines (parallel to X)
      for (let i = 0; i <= divisionsV; i++) {
        const y = -halfHeight + (i * height / divisionsV);
        lines.push(-halfWidth, y, offset, halfWidth, y, offset);
      }
      // Vertical lines (parallel to Y)
      for (let i = 0; i <= divisionsU; i++) {
        const x = -halfWidth + (i * width / divisionsU);
        lines.push(x, -halfHeight, offset, x, halfHeight, offset);
      }
    } else if (plane === 'zy') {
      // Left/Right face (perpendicular to X)
      // Horizontal lines (parallel to Z)
      for (let i = 0; i <= divisionsV; i++) {
        const y = -halfHeight + (i * height / divisionsV);
        lines.push(offset, y, -halfDepth, offset, y, halfDepth);
      }
      // Vertical lines (parallel to Y)
      for (let i = 0; i <= divisionsU; i++) {
        const z = -halfDepth + (i * depth / divisionsU);
        lines.push(offset, -halfHeight, z, offset, halfHeight, z);
      }
    } else if (plane === 'xz') {
      // Top/Bottom face (perpendicular to Y)
      // Horizontal lines (parallel to X)
      for (let i = 0; i <= divisionsV; i++) {
        const z = -halfDepth + (i * depth / divisionsV);
        lines.push(-halfWidth, offset, z, halfWidth, offset, z);
      }
      // Vertical lines (parallel to Z)
      for (let i = 0; i <= divisionsU; i++) {
        const x = -halfWidth + (i * width / divisionsU);
        lines.push(x, offset, -halfDepth, x, offset, halfDepth);
      }
    }
    
    const vertexData = new Float32Array(lines);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
    
    return {
      buffer: buffer,
      vertexCount: vertexData.length / 3
    };
  }

  destroy() {
    this.pause();
    
    // Clean up drag handlers if they exist
    if (this._dragHandlers) {
      const canvas = this.canvas;
      canvas.removeEventListener('mousedown', this._dragHandlers.onMouseDown);
      canvas.removeEventListener('mousemove', this._dragHandlers.onMouseMove);
      canvas.removeEventListener('mouseup', this._dragHandlers.onMouseUp);
      canvas.removeEventListener('mouseleave', this._dragHandlers.onMouseLeave);
      canvas.style.cursor = '';
    }
    
    // Clean up zoom handlers if they exist
    if (this._zoomHandlers) {
      const canvas = this.canvas;
      canvas.removeEventListener('wheel', this._zoomHandlers.onWheel);
      canvas.removeEventListener('touchstart', this._zoomHandlers.onTouchStart);
      canvas.removeEventListener('touchmove', this._zoomHandlers.onTouchMove);
    }
  }

  play() {
    if (this._playing) return;
    this._playing = true;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  pause() {
    this._playing = false;
  }

  stop() {
    this.pause();
    this.currentFrame = 0;
    this.render();
  }

  _loop(ts) {
    if (!this._playing) return;

    const delta = ts - (this._lastTs || ts);
    this._lastTs = ts;
    this._accum += delta;

    while (this._accum >= this.frameDurationMs) {
      this._accum -= this.frameDurationMs;
      this._advanceFrame();
    }

    this.render();
    requestAnimationFrame(this._loop);
  }

  _advanceFrame() {
    if (this.currentFrame + 1 < this.frameCount) {
      this.currentFrame++;
      return;
    }
    if (this.loop) {
      this.currentFrame = Math.min(this.loopStartFrame, this.frameCount - 1);
    } else {
      this.pause();
    }
  }

  _getFrameBytes() {
    const offset = this.dataOffset + this.currentFrame * this.frameSizeBytes;
    return this._u8.subarray(offset, offset + this.frameSizeBytes);
  }

  render() {
    if (this.useWebGL) {
      this._renderWebGL();
    } else {
      this._render2D();
    }
  }

  _render2D() {
    const ctx = this.ctx;
    const { width, height, depth, voxelSize } = this;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const frame = this._getFrameBytes();
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const isoXZ = 0.5;
    const isoZY = 0.5;

    let index = 0;

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const base = index * this.bytesPerVoxel;
          const px = frame.subarray(base, base + 4);
          const { h, s, b, a } = HSBAUtil.decodePixel(px);

          if (a === 0 || b === 0) {
            index++;
            continue;
          }

          const color = hsbToRgba(h, s, b, a);

          const dx = x - width / 2;
          const dy = y - height / 2;
          const dz = z - depth / 2;

          const screenX = cx + (dx - dz * isoXZ) * voxelSize;
          const screenY = cy + (dy + dz * isoZY) * voxelSize;

          ctx.fillStyle = color;
          ctx.fillRect(screenX, screenY, voxelSize, voxelSize);

          index++;
        }
      }
    }
  }

  _renderGrid() {
    const gl = this.gl;
    
    // Safety check: ensure bounding box geometry exists
    if (!this.boundingBoxFaces) {
      console.warn('Bounding box geometry not initialized');
      return;
    }

    // Calculate camera view direction from rotation
    const rotX = this.viewRotationX;
    const rotY = this.viewRotationY;
    
    // Calculate view direction vector (where camera is looking from camera position)
    const viewDirX = Math.sin(rotY) * Math.cos(rotX);
    const viewDirY = -Math.sin(rotX);
    const viewDirZ = -Math.cos(rotY) * Math.cos(rotX);
    
    // Determine which 3 faces to render (back faces only - furthest from camera)
    // This creates a bounding box that shows the grid bounds without visual clutter
    const facesToRender = [];
    
    // X axis faces (left/right) - show the face furthest from camera
    if (viewDirX > 0) {
      facesToRender.push('left');  // Show left when looking right
    } else {
      facesToRender.push('right'); // Show right when looking left
    }
    
    // Y axis faces (top/bottom) - show the face furthest from camera
    if (viewDirY > 0) {
      facesToRender.push('top');    // Show top when looking up
    } else {
      facesToRender.push('bottom'); // Show bottom when looking down
    }
    
    // Z axis faces (front/back) - show the face furthest from camera
    if (viewDirZ > 0) {
      facesToRender.push('front'); // Show front when looking away
    } else {
      facesToRender.push('back');  // Show back when looking toward
    }

    // Disable depth writing for transparent grid (but keep depth testing)
    gl.depthMask(false);

    // Setup attributes for grid rendering
    gl.enableVertexAttribArray(this.attribLocations.position);
    gl.disableVertexAttribArray(this.attribLocations.normal);
    gl.vertexAttrib3f(this.attribLocations.normal, 0, 1, 0);
    gl.disableVertexAttribArray(this.attribLocations.color);
    gl.vertexAttrib4f(this.attribLocations.color, GRID_COLOR_R, GRID_COLOR_G, GRID_COLOR_B, GRID_COLOR_A);

    // Identity model matrix (faces are already positioned)
    const identityMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
    gl.uniformMatrix4fv(this.uniformLocations.modelMatrix, false, identityMatrix);

    // Render each back face
    facesToRender.forEach(faceName => {
      const face = this.boundingBoxFaces[faceName];
      if (face) {
        gl.bindBuffer(gl.ARRAY_BUFFER, face.buffer);
        gl.vertexAttribPointer(this.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, face.vertexCount);
      }
    });

    // Re-enable depth writing
    gl.depthMask(true);
  }

  _renderWebGL() {
    const gl = this.gl;
    const { width, height, depth } = this;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set up projection matrix (orthographic for proper voxel display)
    const aspect = this.canvas.width / this.canvas.height;
    const size = Math.max(width, height, depth) * 1.2 / this.zoomLevel;
    const projectionMatrix = this._createOrthographicMatrix(
      -size * aspect, size * aspect,  // left, right
      -size, size,                     // bottom, top
      0.1, 1000.0                      // near, far
    );
    gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, projectionMatrix);

    // Set up view matrix (camera)
    const cameraDistance = Math.max(width, height, depth) * 2.5;
    const viewMatrix = this._createViewMatrix(cameraDistance);
    gl.uniformMatrix4fv(this.uniformLocations.viewMatrix, false, viewMatrix);

    // Set light direction
    gl.uniform3f(this.uniformLocations.lightDirection, 0.5, 1.0, 0.75);

    // Bind cube geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffers.position);
    gl.enableVertexAttribArray(this.attribLocations.position);
    gl.vertexAttribPointer(this.attribLocations.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffers.normal);
    gl.enableVertexAttribArray(this.attribLocations.normal);
    gl.vertexAttribPointer(this.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeBuffers.indices);

    // Disable color attribute array (we'll use a constant attribute instead)
    gl.disableVertexAttribArray(this.attribLocations.color);

    // Render each voxel
    const frame = this._getFrameBytes();
    let index = 0;
    let renderedCount = 0;

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const base = index * this.bytesPerVoxel;
          const px = frame.subarray(base, base + 4);
          const { h, s, b, a } = HSBAUtil.decodePixel(px);

          if (a === 0 || b === 0) {
            index++;
            continue;
          }

          // Convert HSBA to RGBA
          const rgba = this._hsbToRgbaArray(h, s, b, a);

          // Set color as constant vertex attribute
          gl.vertexAttrib4fv(this.attribLocations.color, rgba);

          // Create model matrix for this voxel
          const modelMatrix = this._createModelMatrix(
            x - width / 2,
            y - height / 2,
            z - depth / 2
          );
          gl.uniformMatrix4fv(this.uniformLocations.modelMatrix, false, modelMatrix);

          // Draw cube
          gl.drawElements(gl.TRIANGLES, this.cubeIndexCount, gl.UNSIGNED_SHORT, 0);

          renderedCount++;
          index++;
        }
      }
    }
    
    // Draw bounding box grid AFTER solid voxels for proper depth ordering
    if (this.showBoundingBox) {
      this._renderGrid();
    }
  }

  _hsbToRgbaArray(h, s, b, aPercent) {
    const hDeg = (h / 255) * 360;
    const sNorm = s / 100;
    const v = b / 100;
    const a = aPercent / 100;

    if (sNorm === 0) {
      return new Float32Array([v, v, v, a]);
    }

    const c = v * sNorm;
    const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1));
    const m = v - c;

    let r1, g1, b1;
    if (hDeg < 60)      { r1 = c; g1 = x; b1 = 0; }
    else if (hDeg < 120){ r1 = x; g1 = c; b1 = 0; }
    else if (hDeg < 180){ r1 = 0; g1 = c; b1 = x; }
    else if (hDeg < 240){ r1 = 0; g1 = x; b1 = c; }
    else if (hDeg < 300){ r1 = x; g1 = 0; b1 = c; }
    else                { r1 = c; g1 = 0; b1 = x; }

    return new Float32Array([r1 + m, g1 + m, b1 + m, a]);
  }

  _createPerspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  _createOrthographicMatrix(left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Float32Array([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
    ]);
  }

  _createViewMatrix(distance) {
    // Apply orbital rotation (zoom is handled by projection matrix for orthographic)
    const cosX = Math.cos(this.viewRotationX);
    const sinX = Math.sin(this.viewRotationX);
    const cosY = Math.cos(this.viewRotationY);
    const sinY = Math.sin(this.viewRotationY);

    // Camera position based on rotation
    const cx = distance * cosX * sinY;
    const cy = distance * sinX;
    const cz = distance * cosX * cosY;

    // Look at origin
    return this._createLookAtMatrix(cx, cy, cz, 0, 0, 0, 0, 1, 0);
  }

  _createLookAtMatrix(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
    // Calculate forward, right, and up vectors
    let fx = eyeX - centerX;
    let fy = eyeY - centerY;
    let fz = eyeZ - centerZ;
    
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx /= len; fy /= len; fz /= len;

    let rx = upY * fz - upZ * fy;
    let ry = upZ * fx - upX * fz;
    let rz = upX * fy - upY * fx;
    
    len = Math.sqrt(rx * rx + ry * ry + rz * rz);
    rx /= len; ry /= len; rz /= len;

    let ux = fy * rz - fz * ry;
    let uy = fz * rx - fx * rz;
    let uz = fx * ry - fy * rx;

    return new Float32Array([
      rx, ux, fx, 0,
      ry, uy, fy, 0,
      rz, uz, fz, 0,
      -(rx * eyeX + ry * eyeY + rz * eyeZ),
      -(ux * eyeX + uy * eyeY + uz * eyeZ),
      -(fx * eyeX + fy * eyeY + fz * eyeZ),
      1
    ]);
  }

  _createModelMatrix(x, y, z) {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
  }
}

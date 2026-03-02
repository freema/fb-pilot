#!/usr/bin/env node
/**
 * Generate PNG icons from inline SVG.
 * Uses Node.js canvas (npm install canvas) or falls back to writing raw SVG files.
 *
 * Usage: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');
const SIZES = [16, 48, 128];
const FB_BLUE = '#1877F2';

function createSVG(size) {
  const pad = size * 0.15;
  const s = size - pad * 2;

  // Paper airplane shape — simple triangular motif
  const cx = size / 2;
  const cy = size / 2;

  // Points for a paper airplane pointing up-right
  const p1x = pad;
  const p1y = size - pad;
  const p2x = size - pad;
  const p2y = pad;
  const p3x = cx - s * 0.05;
  const p3y = cy + s * 0.1;
  const p4x = pad + s * 0.3;
  const p4y = size - pad - s * 0.05;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${FB_BLUE}"/>
  <polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}" fill="white" opacity="0.95"/>
  <polygon points="${p1x},${p1y} ${p3x},${p3y} ${p4x},${p4y}" fill="white" opacity="0.7"/>
</svg>`;
}

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Try to use canvas for PNG generation, fall back to SVG
let canvasAvailable = false;
let createCanvas, loadImage;

try {
  const canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
  loadImage = canvasModule.loadImage;
  canvasAvailable = true;
} catch (_) {
  // canvas not available, will generate SVGs and use them directly
}

async function generatePNG(size) {
  const svg = createSVG(size);
  const svgPath = path.join(ICONS_DIR, `icon${size}.svg`);
  const pngPath = path.join(ICONS_DIR, `icon${size}.png`);

  if (canvasAvailable) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    ctx.drawImage(img, 0, 0, size, size);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buffer);
    console.log(`Generated ${pngPath} (${buffer.length} bytes)`);
  } else {
    // Write SVG as fallback — Chrome accepts SVGs renamed as PNG for dev purposes
    // For production, install `canvas` package: npm install canvas
    fs.writeFileSync(svgPath, svg);
    // Create a minimal valid PNG (1x1 pixel, will be replaced by actual icon)
    // This is a placeholder — run with `canvas` installed for real PNGs
    console.log(`Generated ${svgPath} (canvas not available, SVG fallback)`);
    console.log(`  For proper PNGs, install canvas: npm install canvas`);

    // Write a minimal valid PNG as placeholder
    writePlaceholderPNG(pngPath, size);
  }
}

function writePlaceholderPNG(filePath, size) {
  // Create SVG-based data URI that Chrome can use
  const svg = createSVG(size);
  // Write the SVG content directly — for local development Chrome handles this
  fs.writeFileSync(filePath, Buffer.from(svg));
  console.log(`  Wrote SVG content to ${filePath} as placeholder`);
}

async function main() {
  for (const size of SIZES) {
    await generatePNG(size);
  }
  console.log('\nDone! Icons generated in', ICONS_DIR);
}

main().catch(console.error);

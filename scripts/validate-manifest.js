#!/usr/bin/env node
/**
 * Validates manifest.json for common issues.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');

let manifest;
try {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  manifest = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse manifest.json:', err.message);
  process.exit(1);
}

const errors = [];

// Required fields
if (manifest.manifest_version !== 3) {
  errors.push('manifest_version must be 3');
}
if (!manifest.name || typeof manifest.name !== 'string') {
  errors.push('name is required and must be a string');
}
if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push('version must be in semver format (e.g. 1.0.0)');
}

// Permissions
if (!Array.isArray(manifest.permissions)) {
  errors.push('permissions must be an array');
}

// Background
if (!manifest.background || !manifest.background.service_worker) {
  errors.push('background.service_worker is required for MV3');
}
if (manifest.background && manifest.background.service_worker) {
  const swPath = path.join(__dirname, '..', manifest.background.service_worker);
  if (!fs.existsSync(swPath)) {
    errors.push(`Service worker not found: ${manifest.background.service_worker}`);
  }
}

// Content scripts
if (manifest.content_scripts) {
  for (const cs of manifest.content_scripts) {
    for (const jsFile of cs.js || []) {
      const jsPath = path.join(__dirname, '..', jsFile);
      if (!fs.existsSync(jsPath)) {
        errors.push(`Content script not found: ${jsFile}`);
      }
    }
  }
}

// Icons
if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    const fullPath = path.join(__dirname, '..', iconPath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Icon not found: ${iconPath} (${size}x${size})`);
    }
  }
}

// Popup
if (manifest.action && manifest.action.default_popup) {
  const popupPath = path.join(__dirname, '..', manifest.action.default_popup);
  if (!fs.existsSync(popupPath)) {
    errors.push(`Popup HTML not found: ${manifest.action.default_popup}`);
  }
}

if (errors.length > 0) {
  console.error('Manifest validation failed:');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('manifest.json is valid');
}

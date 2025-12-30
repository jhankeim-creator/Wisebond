#!/usr/bin/env node
/**
 * KAYICOM PWA Icon Generator
 * Generates PNG icons from a base SVG for PWA manifest
 * 
 * Run: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Creating placeholder icons...');
  createPlaceholderIcons();
  process.exit(0);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG icon template - KAYICOM "K" logo with wallet design
const createSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#EA580C"/>
      <stop offset="100%" style="stop-color:#F59E0B"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial Black, Arial, sans-serif" font-size="280" font-weight="900" fill="white" text-anchor="middle">K</text>
  <rect x="100" y="420" width="312" height="40" rx="20" fill="rgba(255,255,255,0.3)"/>
</svg>
`;

async function generateIcons() {
  console.log('Generating KAYICOM PWA icons...');
  
  for (const size of sizes) {
    const svgBuffer = Buffer.from(createSvg(512));
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated icon-${size}x${size}.png`);
  }
  
  console.log('\nAll icons generated successfully!');
}

function createPlaceholderIcons() {
  // Create simple placeholder PNG files (1x1 pixel orange)
  // These should be replaced with actual icons
  const placeholder = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xAB, 0xAA, 0x02,
    0x00, 0x03, 0x59, 0x01, 0x1A, 0xC4, 0x42, 0x6A,
    0x23, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  sizes.forEach(size => {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outputPath, placeholder);
    console.log(`✓ Created placeholder icon-${size}x${size}.png`);
  });
  
  console.log('\nPlaceholder icons created. Replace with actual icons later.');
}

generateIcons().catch(console.error);

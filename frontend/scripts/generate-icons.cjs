// Simple script to create placeholder PWA icons
// In a real project, you would use proper icon generation tools
// This creates basic colored square icons with text

const fs = require('fs');
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create SVG template
const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#42a5f5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#gradient)"/>
  <g transform="translate(${size * 0.2}, ${size * 0.3})">
    <path d="M${size * 0.15} ${size * 0.1} L${size * 0.45} ${size * 0.1} L${size * 0.45} ${size * 0.25} L${size * 0.15} ${size * 0.25} Z" fill="white"/>
    <path d="M${size * 0.1} ${size * 0.25} L${size * 0.5} ${size * 0.25} L${size * 0.5} ${size * 0.4} L${size * 0.1} ${size * 0.4} Z" fill="white"/>
    <circle cx="${size * 0.2}" cy="${size * 0.45}" r="${size * 0.05}" fill="white"/>
    <circle cx="${size * 0.4}" cy="${size * 0.45}" r="${size * 0.05}" fill="white"/>
  </g>
</svg>`;

// Generate icons
iconSizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const svgFilename = `icon-${size}x${size}.svg`;
  
  // Save SVG version
  fs.writeFileSync(path.join(iconsDir, svgFilename), svgContent.trim());
  
  console.log(`Created ${svgFilename}`);
});

// Create specific icons for shortcuts
const createShortcutIcon = (iconName, content, color = '#1976d2') => `
<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="15" fill="${color}"/>
  <g transform="translate(24, 24)">
    ${content}
  </g>
</svg>`;

// QR Scanner shortcut icon
const qrScanContent = `
  <rect x="4" y="4" width="40" height="40" rx="4" stroke="white" stroke-width="3" fill="none"/>
  <rect x="8" y="8" width="8" height="8" fill="white"/>
  <rect x="32" y="8" width="8" height="8" fill="white"/>
  <rect x="8" y="32" width="8" height="8" fill="white"/>
  <rect x="20" y="16" width="8" height="16" fill="white"/>
  <rect x="32" y="24" width="8" height="8" fill="white"/>
`;

const qrScanIcon = createShortcutIcon('qr-scan', qrScanContent);
fs.writeFileSync(path.join(iconsDir, 'qr-scan-96x96.png'), qrScanIcon);
fs.writeFileSync(path.join(iconsDir, 'qr-scan-96x96.svg'), qrScanIcon);

// Orders shortcut icon  
const ordersContent = `
  <rect x="8" y="4" width="32" height="40" rx="2" stroke="white" stroke-width="2" fill="none"/>
  <line x1="12" y1="12" x2="36" y2="12" stroke="white" stroke-width="2"/>
  <line x1="12" y1="20" x2="36" y2="20" stroke="white" stroke-width="2"/>
  <line x1="12" y1="28" x2="36" y2="28" stroke="white" stroke-width="2"/>
  <line x1="12" y1="36" x2="24" y2="36" stroke="white" stroke-width="2"/>
`;

const ordersIcon = createShortcutIcon('orders', ordersContent, '#4caf50');
fs.writeFileSync(path.join(iconsDir, 'orders-96x96.png'), ordersIcon);
fs.writeFileSync(path.join(iconsDir, 'orders-96x96.svg'), ordersIcon);

console.log('PWA icons generated successfully!');
console.log('Note: SVG files created as placeholders. In production, convert these to proper PNG files.');
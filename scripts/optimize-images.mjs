/**
 * Image Optimization Script
 * Converts PNG images in assets/ to WebP and AVIF formats
 * Run with: node scripts/optimize-images.js
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ASSETS_DIR = path.resolve('./assets');
const OUTPUT_DIR = path.resolve('./assets/optimized');

const QUALITY = {
  webp: 80,
  avif: 50,
};

async function optimizeImages() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'));
  
  console.log(`Found ${files.length} PNG files to optimize...\n`);

  for (const file of files) {
    const inputPath = path.join(ASSETS_DIR, file);
    const baseName = path.parse(file).name;
    
    console.log(`Processing: ${file}`);
    
    try {
      // Get image metadata
      const metadata = await sharp(inputPath).metadata();
      console.log(`  Original: ${metadata.width}x${metadata.height}, ${(fs.statSync(inputPath).size / 1024).toFixed(1)} KB`);
      
      // WebP
      const webpPath = path.join(OUTPUT_DIR, `${baseName}.webp`);
      await sharp(inputPath)
        .webp({ quality: QUALITY.webp, effort: 6 })
        .toFile(webpPath);
      const webpSize = fs.statSync(webpPath).size;
      console.log(`  WebP: ${(webpSize / 1024).toFixed(1)} KB (${((1 - webpSize / fs.statSync(inputPath).size) * 100).toFixed(1)}% smaller)`);
      
      // AVIF
      const avifPath = path.join(OUTPUT_DIR, `${baseName}.avif`);
      await sharp(inputPath)
        .avif({ quality: QUALITY.avif, effort: 9 })
        .toFile(avifPath);
      const avifSize = fs.statSync(avifPath).size;
      console.log(`  AVIF: ${(avifSize / 1024).toFixed(1)} KB (${((1 - avifSize / fs.statSync(inputPath).size) * 100).toFixed(1)}% smaller)`);
      
      console.log('');
    } catch (error) {
      console.error(`  Error processing ${file}:`, error.message);
    }
  }
  
  console.log('✅ Image optimization complete!');
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

optimizeImages().catch(console.error);
// eval/security-tests/upload-tests.js
import sharp from '../../server/node_modules/sharp/dist/index.mjs';
import { processImage, MAX_IMAGE_FILE_SIZE, MAX_IMAGE_DIMENSION } from '../../server/src/services/imageProcessor.js';

console.log('=== Running Image Upload & Decompression Bomb Security Tests ===\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

// 1. Valid JPEG Image Test
try {
  const validJpeg = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 50, g: 100, b: 200 } }
  }).jpeg().toBuffer();

  const result = await processImage(validJpeg);
  assert(
    result && result.mimeType === 'image/jpeg' && result.width === 300 && result.height === 200 && typeof result.base64 === 'string',
    'Valid JPEG is parsed, sanitized, and returned with correct dimensions and base64 string'
  );
} catch (err) {
  assert(false, `Valid JPEG threw unexpected error: ${err.message}`);
}

// 2. Valid PNG Image Re-encoding Test
try {
  const validPng = await sharp({
    create: { width: 150, height: 150, channels: 4, background: { r: 10, g: 200, b: 50, alpha: 1 } }
  }).png().toBuffer();

  const result = await processImage(validPng);
  assert(
    result && result.mimeType === 'image/jpeg' && result.width === 150 && result.height === 150,
    'Valid PNG is converted and re-encoded into clean JPEG without error'
  );
} catch (err) {
  assert(false, `Valid PNG threw unexpected error: ${err.message}`);
}

// 3. Disallowed File Type: SVG (vector XML / XSS vector)
try {
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><rect width="100" height="100" fill="red"/></svg>');
  await processImage(svgBuffer);
  assert(false, 'SVG buffer should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400 && (err.message.includes('Disallowed file type') || err.message.includes('Only JPEG, PNG, and WEBP')),
    `SVG is rejected by magic byte detection: "${err.message}"`
  );
}

// 4. Disallowed File Type: GIF
try {
  const gifBuffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).gif().toBuffer();
  await processImage(gifBuffer);
  assert(false, 'GIF buffer should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400 && (err.message.includes('image/gif') || err.message.includes('Only JPEG, PNG, and WEBP')),
    `GIF is rejected by MIME allowlist: "${err.message}"`
  );
}

// 5. Spoofed Extension / Executable Binary
try {
  const fakeBinary = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00This is a fake PE executable binary disguised as an image');
  await processImage(fakeBinary);
  assert(false, 'Non-image binary should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('Disallowed file type'),
    `Fake executable binary rejected by magic byte validation: "${err.message}"`
  );
}

// 6. Oversized File Size (> 5 MB)
try {
  const oversizedBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE + 1024, 0x41); // 5 MB + 1 KB
  await processImage(oversizedBuffer);
  assert(false, 'Oversized buffer should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('5 MB'),
    `Oversized buffer (> 5 MB) rejected by file size guard: "${err.message}"`
  );
}

// 7. Dimension Limit Protection (> 4000x4000)
try {
  const oversizedDimensionJpeg = await sharp({
    create: { width: 4001, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();

  await processImage(oversizedDimensionJpeg);
  assert(false, 'Oversized dimension image should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('exceed the maximum permitted limit of 4000x4000'),
    `Dimension bomb (> 4000px width) rejected before processing: "${err.message}"`
  );
}

// 8. Decompression Bomb Memory Guard (Pixel limit test)
try {
  // sharp limitInputPixels prevents decoding images with > 16 million pixels
  const bombHeaderJpeg = await sharp({
    create: { width: 4100, height: 4100, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  await processImage(bombHeaderJpeg);
  assert(false, 'Decompression bomb image should have been rejected');
} catch (err) {
  assert(
    err.statusCode === 400,
    `Decompression bomb rejected safely: "${err.message}"`
  );
}

console.log(`\nUpload Security Test Summary: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
}

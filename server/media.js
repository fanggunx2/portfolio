// Turns uploaded originals into web-ready files:
//  - images → <name>.webp (longest side ≤ 2400px) + <name>-thumb.webp (≤ 600px, for the home page bubbles)
//  - videos → <name>.mp4, H.264, ≤ 20MB (via scripts/compress-video.swift, macOS only)
// Originals are moved to ~/Documents/WonderBird 原图/ (backed up by iCloud, never published).
// Set ORIGINALS_DIR to keep them somewhere else.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);

const ORIGINALS_DIR = process.env.ORIGINALS_DIR || path.join(os.homedir(), 'Documents', 'WonderBird 原图');
const VIDEO_SCRIPT = path.join(__dirname, '..', 'scripts', 'compress-video.swift');
const VIDEO_BIN = path.join(__dirname, '.bin', 'compress-video');

const IMAGE_MAX = 2400;
const THUMB_MAX = 600;
const VIDEO_TARGET_MB = 20;
const VIDEO_MAX_SIDE = 1280;

const VIDEO_EXT = /\.(mp4|webm|mov|avi|m4v)$/i;

const isVideo = (filename) => VIDEO_EXT.test(filename);

// Move the original out of the published folder, keeping its name
const keepOriginal = (filePath) => {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  const dest = path.join(ORIGINALS_DIR, path.basename(filePath));
  fs.renameSync(filePath, dest);
  return dest;
};

const optimizeImage = async (filePath) => {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const original = keepOriginal(filePath);
  const resize = (max) => sharp(original).rotate().resize(max, max, { fit: 'inside', withoutEnlargement: true });
  await resize(IMAGE_MAX).webp({ quality: 82 }).toFile(path.join(dir, `${base}.webp`));
  await resize(THUMB_MAX).webp({ quality: 80 }).toFile(path.join(dir, `${base}-thumb.webp`));
  return `${base}.webp`;
};

// Compile the Swift encoder once; the compiled binary starts much faster than `swift script.swift`
const ensureVideoBin = async () => {
  if (fs.existsSync(VIDEO_BIN) && fs.statSync(VIDEO_BIN).mtimeMs >= fs.statSync(VIDEO_SCRIPT).mtimeMs) return;
  fs.mkdirSync(path.dirname(VIDEO_BIN), { recursive: true });
  await execFileAsync('swiftc', ['-O', VIDEO_SCRIPT, '-o', VIDEO_BIN]);
};

const optimizeVideo = async (filePath) => {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const original = keepOriginal(filePath);
  await ensureVideoBin();
  await execFileAsync(VIDEO_BIN, [original, path.join(dir, `${base}.mp4`), String(VIDEO_TARGET_MB), String(VIDEO_MAX_SIDE)]);
  return `${base}.mp4`;
};

// Optimize one file in the uploads folder; returns the new filename
const optimizeFile = (filePath) => (isVideo(filePath) ? optimizeVideo(filePath) : optimizeImage(filePath));

// Express middleware: run after multer, rewrites each file's filename to the optimized one
const optimizeUploads = async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
    for (const file of files) {
      file.filename = await optimizeFile(file.path);
    }
    next();
  } catch (err) {
    console.error('Media optimization failed:', err);
    res.status(500).json({ error: 'Failed to process uploaded media: ' + err.message });
  }
};

// The small version of an optimized image, if there is one
const thumbOf = (filename) => filename.replace(/\.webp$/, '-thumb.webp');

// The link-preview (Open Graph) image of a work cover: 1200x630 JPEG, which every social app accepts
const ogOf = (filename) => filename.replace(/\.webp$/, '-og.jpg');

const ensureOgImage = async (webpPath) => {
  const ogPath = ogOf(webpPath);
  if (ogPath === webpPath || fs.existsSync(ogPath) || !fs.existsSync(webpPath)) return;
  await sharp(webpPath).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(ogPath);
};

module.exports = { optimizeFile, optimizeUploads, thumbOf, ogOf, ensureOgImage, ORIGINALS_DIR };

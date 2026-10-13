// One-time: run every work's existing images/videos through media.js and update the database.
// Already-optimized files (.webp images, files already processed) are skipped, so it is safe to re-run.
// Restart the server afterwards so it re-exports client/public/data.
//
// Usage: node optimize-existing.js

const fs = require('fs');
const path = require('path');
const db = require('./database');
const { optimizeFile, ORIGINALS_DIR } = require('./media');

const UPLOADS_DIR = path.join(__dirname, '..', 'client', 'public', 'uploads');

const all = (sql) => new Promise((resolve, reject) => db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows))));
const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, (err) => (err ? reject(err) : resolve())));

const optimizeUrl = async (url) => {
  if (!url) return url;
  const name = path.basename(url);
  if (name.endsWith('.webp')) return url;
  // Video already processed earlier: original kept aside and optimized copy present
  if (fs.existsSync(path.join(ORIGINALS_DIR, name)) && fs.existsSync(path.join(UPLOADS_DIR, name))) return url;
  const filePath = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(filePath)) {
    console.warn(`  missing: ${name}`);
    return url;
  }
  const before = fs.statSync(filePath).size;
  const newName = await optimizeFile(filePath);
  const after = fs.statSync(path.join(UPLOADS_DIR, newName)).size;
  console.log(`  ${name} → ${newName}  ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB`);
  return `/uploads/${newName}`;
};

(async () => {
  const works = await all('SELECT id, title, image_url, images, video FROM works');
  for (const work of works) {
    console.log(`${work.id} ${work.title}`);
    let images = [];
    try { images = work.images ? JSON.parse(work.images) : []; } catch { images = []; }
    const image_url = await optimizeUrl(work.image_url);
    const newImages = [];
    for (const url of images) newImages.push(await optimizeUrl(url));
    const video = await optimizeUrl(work.video);
    await run('UPDATE works SET image_url = ?, images = ?, video = ? WHERE id = ?',
      [image_url, JSON.stringify(newImages), video || null, work.id]);
  }
  db.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

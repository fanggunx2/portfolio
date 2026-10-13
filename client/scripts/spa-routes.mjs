// The site is a single-page app, but static hosts (EdgeOne Pages) can't rewrite unknown paths to
// index.html. So after the build, copy index.html to every route that can be opened directly
// (e.g. a link to /work/5 shared on Instagram), plus 404.html for anything else.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'));
const works = JSON.parse(fs.readFileSync(path.join(dist, 'data', 'works.json'), 'utf8'));

const routes = ['about', ...works.map(w => `work/${w.id}`)];
for (const route of routes) {
  fs.mkdirSync(path.join(dist, route), { recursive: true });
  fs.writeFileSync(path.join(dist, route, 'index.html'), html);
}
fs.writeFileSync(path.join(dist, '404.html'), html);
console.log(`SPA routes: ${routes.length} pages + 404.html`);

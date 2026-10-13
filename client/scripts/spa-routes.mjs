// Runs after `vite build`.
//
// 1. The site is a single-page app, but static hosts (EdgeOne Pages) can't rewrite unknown paths to
//    index.html. So copy index.html to every route that can be opened directly (e.g. a link to
//    /work/5 shared on Instagram), plus 404.html for anything else.
// 2. Social apps read link previews from the HTML without running JavaScript, so each copy gets its
//    own title, description and preview image (Open Graph tags).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const { url: SITE_URL } = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const works = JSON.parse(fs.readFileSync(path.join(dist, 'data', 'works.json'), 'utf8'));
const about = JSON.parse(fs.readFileSync(path.join(dist, 'data', 'about.json'), 'utf8'));

const SITE_NAME = 'WONDER BIRD';
const DEFAULT_IMAGE = '/og-image.jpg';
// First two lines of the Chinese About text
const DEFAULT_DESCRIPTION = about.zh.body.split('\n').slice(0, 2).join(' ');

const escape = (text) => text
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const truncate = (text, max) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

const page = ({ route, title, description, image }) => {
  const meta = [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', `${SITE_URL}/${route}`],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:image', `${SITE_URL}${image}`],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'description', description],
  ].map(([attr, key, value]) => `    <meta ${attr}="${key}" content="${escape(value)}" />`).join('\n');
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace('</head>', `${meta}\n  </head>`);
};

const write = (file, html) => {
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), html);
};

const home = { route: '', title: `${SITE_NAME} | Portfolio`, description: DEFAULT_DESCRIPTION, image: DEFAULT_IMAGE };
write('index.html', page(home));
write('404.html', page(home));
write('about/index.html', page({ ...home, route: 'about', title: `${about.zh.title || '关于'} | ${SITE_NAME}` }));

for (const work of works) {
  // Cover preview made by the admin server (server/media.js); fall back to the site image
  const og = work.image_url.replace(/\.webp$/, '-og.jpg');
  write(`work/${work.id}/index.html`, page({
    route: `work/${work.id}`,
    title: `${work.title.trim()} | ${SITE_NAME}`,
    description: truncate(work.description?.trim() || DEFAULT_DESCRIPTION, 150),
    image: og !== work.image_url && fs.existsSync(path.join(dist, og)) ? og : DEFAULT_IMAGE,
  }));
}
console.log(`SPA routes: ${works.length + 1} pages + 404.html (site: ${SITE_URL})`);

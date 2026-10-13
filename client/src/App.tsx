import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from './pages/Home';
import { WorkDetail } from './pages/WorkDetail';
import { About } from './pages/About';
import './App.css';

// The admin only runs locally (npm run dev); it is left out of the published build
const Admin = import.meta.env.DEV
  ? lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })))
  : null;

const LANGUAGES = [
  { code: 'zh', label: '中' },
  { code: 'ja', label: '日' },
  { code: 'en', label: 'EN' },
];

function Navigation() {
  const { t, i18n } = useTranslation();
  // Work pages have a white background, so the nav switches to dark text there
  const onLightPage = useLocation().pathname.startsWith('/work/');

  return (
    <nav className={`nav ${onLightPage ? 'nav--on-light' : ''}`}>
      <Link to="/" className="home-link">
        <img src="/bird-icon.png" alt="Home" className="bird-icon" />
        <span className="home-text">WONDER BIRD</span>
      </Link>
      <div className="nav-links">
        <Link to="/about">{t('nav.about')}</Link>
        <div className="lang-switcher">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`lang-btn ${i18n.language === lang.code ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work/:id" element={<WorkDetail />} />
        <Route path="/about" element={<About />} />
        {Admin && (
          <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

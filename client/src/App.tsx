import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from './pages/Home';
import { WorkDetail } from './pages/WorkDetail';
import { About } from './pages/About';
import { Admin } from './pages/Admin';
import './App.css';

const LANGUAGES = [
  { code: 'zh', label: '中' },
  { code: 'ja', label: '日' },
  { code: 'en', label: 'EN' },
];

function Navigation() {
  const { t, i18n } = useTranslation();

  return (
    <nav className="nav">
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
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

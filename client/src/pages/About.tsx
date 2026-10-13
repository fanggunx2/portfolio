import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { aboutApi, type AboutI18n, type AboutLang } from '../api';
import './About.css';

export function About() {
  const { t, i18n } = useTranslation();
  const [about, setAbout] = useState<AboutI18n | null>(null);

  useEffect(() => {
    aboutApi.getAbout().then(setAbout);
  }, []);

  if (!about) return null;

  // Current language, falling back to Chinese if that language hasn't been written yet
  const lang = (i18n.resolvedLanguage || 'zh') as AboutLang;
  const content = about[lang]?.body ? about[lang] : about.zh;

  return (
    <div className="about">
      <div className="about-content">
        <h1>{content.title || t('about.defaultTitle')}</h1>
        <div className="divider"></div>
        {/* Blank lines separate stanzas; every other line break is kept as written */}
        {content.body.split(/\n\s*\n/).map((stanza, i) => (
          <p key={i}>
            {stanza.split('\n').map((line, j) => (
              <span key={j} className="about-line">{line}</span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

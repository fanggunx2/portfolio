import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { aboutApi, type AboutContent } from '../api';
import './About.css';

export function About() {
  const { t } = useTranslation();
  const [content, setContent] = useState<AboutContent | null>(null);

  useEffect(() => {
    aboutApi.getAbout().then(setContent);
  }, []);

  if (!content) return null;

  return (
    <div className="about">
      <div className="about-content">
        <h1>{content.title || t('about.defaultTitle')}</h1>
        <div className="divider"></div>
        {content.body.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

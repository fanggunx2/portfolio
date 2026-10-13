// In development the local admin server is reached through Vite's proxy (see vite.config.ts).
// The published site has no server: it reads the JSON files the admin server exports to public/data.
export const API_BASE = '/api';
const IS_STATIC = !import.meta.env.DEV;

// Uploaded images are optimized into <name>.webp plus a small <name>-thumb.webp (see server/media.js)
export const thumbUrl = (url: string) => url.replace(/\.webp$/, '-thumb.webp');

export interface AboutContent {
  title: string;
  body: string;
}

export type AboutLang = 'zh' | 'ja' | 'en';
export type AboutI18n = Record<AboutLang, AboutContent>;

export const aboutApi = {
  getAbout: async (): Promise<AboutI18n> => {
    const res = await fetch(IS_STATIC ? '/data/about.json' : `${API_BASE}/about`);
    return res.json();
  },

  updateAbout: async (content: AboutI18n, token: string): Promise<AboutI18n> => {
    const res = await fetch(`${API_BASE}/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(content),
    });
    if (!res.ok) throw new Error('Failed to update about');
    return res.json();
  },
};

export interface Work {
  id: number;
  title: string;
  description: string;
  image_url: string;
  images: string[];
  video: string | null;
  category: string;
  sort_order: number;
  created_at: string;
}

export type Category = 'all' | 'product' | 'interaction' | 'advertising';

export const api = {
  // Works
  getWorks: async (category?: Category): Promise<Work[]> => {
    if (IS_STATIC) {
      const works: Work[] = await (await fetch('/data/works.json')).json();
      return category && category !== 'all' ? works.filter(w => w.category === category) : works;
    }
    const url = category && category !== 'all'
      ? `${API_BASE}/works?category=${category}`
      : `${API_BASE}/works`;
    const res = await fetch(url);
    return res.json();
  },

  getWork: async (id: number): Promise<Work> => {
    if (IS_STATIC) {
      const works: Work[] = await (await fetch('/data/works.json')).json();
      const work = works.find(w => w.id === id);
      if (!work) throw new Error('Work not found');
      return work;
    }
    const res = await fetch(`${API_BASE}/works/${id}`);
    if (!res.ok) throw new Error('Work not found');
    return res.json();
  },

  createWork: async (formData: FormData, token: string): Promise<Work> => {
    const res = await fetch(`${API_BASE}/works`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to create work');
    return res.json();
  },

  updateWork: async (id: number, formData: FormData, token: string): Promise<Work> => {
    const res = await fetch(`${API_BASE}/works/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to update work');
    return res.json();
  },

  deleteWork: async (id: number, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/works/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to delete work');
  },

  reorderWorks: async (order: { id: number; sort_order: number }[], token: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/works/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) throw new Error('Failed to reorder works');
  },

  // Publish: commit the site content and push to GitHub (EdgeOne rebuilds the site)
  publishStatus: async (token: string): Promise<{ pending: number }> => {
    const res = await fetch(`${API_BASE}/publish/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to check publish status');
    return res.json();
  },

  publish: async (token: string): Promise<{ success: boolean; commit: string }> => {
    const res = await fetch(`${API_BASE}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish');
    return data;
  },

  // Auth
  login: async (username: string, password: string): Promise<{ token: string }> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },

  verify: async (token: string): Promise<{ authenticated: boolean }> => {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },
};

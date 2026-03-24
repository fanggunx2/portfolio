export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_MOCK = true; // Set to false when backend is deployed

export interface AboutContent {
  title: string;
  body: string;
}

const ABOUT_STORAGE_KEY = 'wonderbird_about';

export const aboutApi = {
  getAbout: async (): Promise<AboutContent> => {
    if (USE_MOCK) {
      // 优先从 localStorage 读取保存的内容
      const saved = localStorage.getItem(ABOUT_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return {
        title: '私について',
        body: 'ここにあなたの自己紹介を書いてください。\nあなたの経歴、スキル、情熱、そしてなぜこの仕事を始めたのかなど、プロフィールとして見せたい情報を自由に入力できます。\n\nWrite your introduction here in Japanese or English.\nShare your background, skills, passion, and what inspired you to start this journey.'
      };
    }
    const res = await fetch(`${API_BASE}/about`);
    return res.json();
  },

  updateAbout: async (content: AboutContent, token: string): Promise<AboutContent> => {
    if (USE_MOCK) {
      // 保存到 localStorage
      localStorage.setItem(ABOUT_STORAGE_KEY, JSON.stringify(content));
      return content;
    }
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

// Your real works from database
const MOCK_WORKS: Work[] = [
  {
    id: 2,
    title: 'umbanana',
    description: '',
    image_url: '/uploads/1771469108860-323604076.jpg',
    images: [],
    video: null,
    category: 'product',
    sort_order: 1,
    created_at: '2024-01-15'
  },
  {
    id: 4,
    title: 'THE EXCLAMATION',
    description: 'The seal itself is the stem, and the impression is the dot. Only in the brief interval between pressing and lifting does the exclamation mark become whole—a bridge between the intention of the hand and the resonance on the page.',
    image_url: '/uploads/1772520013030-657046781.png',
    images: [],
    video: null,
    category: 'product',
    sort_order: 2,
    created_at: '2024-02-20'
  },
  {
    id: 5,
    title: 'FLUITAPE',
    description: 'Inspired by the fluid rotation of magnetic tape, this player visualizes the passage of time through a tactile, hourglass-like interface. It\'s not just about listening to music; it\'s about feeling the physical weight of every second as it flows through the reels.',
    image_url: '/uploads/1772522265584-280995992.png',
    images: [],
    video: null,
    category: 'product',
    sort_order: 3,
    created_at: '2024-03-10'
  },
  {
    id: 6,
    title: 'ANNUAL RING RULER',
    description: 'Inspired by the growing rings of a tree, this ruler helps you measure not just length but time. Each ring represents a year, turning everyday measurements into a journey through memory.',
    image_url: '/uploads/1772525053159-902245445.jpg',
    images: [],
    video: null,
    category: 'product',
    sort_order: 4,
    created_at: '2024-04-05'
  },
  {
    id: 7,
    title: 'THE PINNED MOMENT',
    description: 'Inspired by the childhood urge to stop time with a single finger. It turns the relentless ticking into a permanent pause, making the \'now\' last forever.',
    image_url: '/uploads/1772684882678-246195325.jpg',
    images: [],
    video: null,
    category: 'product',
    sort_order: 5,
    created_at: '2024-05-18'
  }
];

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
    if (USE_MOCK) {
      if (category && category !== 'all') {
        return MOCK_WORKS.filter(w => w.category === category);
      }
      return MOCK_WORKS;
    }
    const url = category && category !== 'all'
      ? `${API_BASE}/works?category=${category}`
      : `${API_BASE}/works`;
    const res = await fetch(url);
    return res.json();
  },

  getWork: async (id: number): Promise<Work> => {
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

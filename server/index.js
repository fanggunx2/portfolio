const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

const uploadMultiple = upload.array('images', 10); // Max 10 images

// Video upload
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 70 * 1024 * 1024 }, // 70MB for video
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|webm|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only video files are allowed'));
  }
});

// Combined upload for images and videos
const uploadMixed = multer({
  storage,
  limits: { fileSize: 70 * 1024 * 1024 }, // 70MB max for video
  fileFilter: (req, file, cb) => {
    const allowedImages = /jpeg|jpg|png|gif|webp/;
    const allowedVideos = /mp4|webm|mov|avi/;
    const extname = allowedImages.test(path.extname(file.originalname).toLowerCase()) ||
                   allowedVideos.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only image and video files are allowed'));
  }
});

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM admin WHERE username = ?', [username], (err, admin) => {
    if (err || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: admin.username });
  });
});

// Verify token
app.get('/api/auth/verify', authenticate, (req, res) => {
  res.json({ authenticated: true });
});

// ============ WORKS ROUTES ============

// Get all works
app.get('/api/works', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM works';
  const params = [];

  if (category && category !== 'all') {
    sql += ' WHERE category = ?';
    params.push(category);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';

  db.all(sql, params, (err, works) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch works' });
    }
    res.json(works);
  });
});

// Get single work
app.get('/api/works/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM works WHERE id = ?', [id], (err, work) => {
    if (err || !work) {
      return res.status(404).json({ error: 'Work not found' });
    }
    res.json(work);
  });
});

// Create work (with image and video upload)
app.post('/api/works', authenticate, uploadMixed.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), (req, res) => {
  const files = req.files;
  const imageFiles = Array.isArray(files)
    ? files.filter(f => f.fieldname === 'images')
    : (files?.['images'] || []);
  const videoFile = Array.isArray(files)
    ? files.find(f => f.fieldname === 'video')
    : files?.['video']?.[0];

  if (!imageFiles || imageFiles.length === 0) {
    return res.status(400).json({ error: 'At least one image is required' });
  }

  const { title, description, category, mainImageIndex } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Handle main image selection
  const mainIdx = mainImageIndex ? parseInt(mainImageIndex) : 0;
  const imageUrls = imageFiles.map(f => `/uploads/${f.filename}`);
  const image_url = imageUrls[mainIdx] || imageUrls[0];
  // Other images as additional
  const images = [...imageUrls.slice(0, mainIdx), ...imageUrls.slice(mainIdx + 1)];

  // Handle video
  const video = videoFile ? `/uploads/${videoFile.filename}` : null;

  const workCategory = category || 'product';

  db.run(
    'INSERT INTO works (title, description, image_url, category, images, video) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description || '', image_url, workCategory, JSON.stringify(images), video],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create work' });
      }
      res.json({
        id: this.lastID,
        title,
        description,
        image_url,
        category: workCategory,
        images,
        video
      });
    }
  );
});

// Update works sort order
app.put('/api/works/reorder', authenticate, (req, res) => {
  const { order } = req.body;

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Invalid order data' });
  }

  const statements = order.map(({ id, sort_order }) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE works SET sort_order = ? WHERE id = ?', [sort_order, id], (err) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
  });

  Promise.all(statements)
    .then(() => {
      res.json({ success: true });
    })
    .catch((err) => {
      res.status(500).json({ error: 'Failed to update order' });
    });
});

// Update work (edit title, description, images, video)
app.put('/api/works/:id', authenticate, uploadMixed.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), (req, res) => {
  const { id } = req.params;
  const { title, description, category, mainImageIndex, allImages, deleteVideo } = req.body;

  console.log('PUT /api/works/:id called', { id, title, deleteVideo, files: req.files });

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Parse files - .fields() returns an object with field names as keys
  const files = req.files;
  const imageFiles = files?.['images'] || [];
  const videoFile = files?.['video']?.[0];

  console.log('Video file:', videoFile);

  db.get('SELECT * FROM works WHERE id = ?', [id], (err, work) => {
    if (err || !work) {
      return res.status(404).json({ error: 'Work not found' });
    }

    let image_url = work.image_url;
    let existingImages = [];
    let video = work.video || null;

    // Use allImages from frontend if provided (after reordering/deletion)
    if (allImages) {
      try {
        const parsedAllImages = JSON.parse(allImages);
        if (Array.isArray(parsedAllImages) && parsedAllImages.length > 0) {
          image_url = parsedAllImages[0];
          existingImages = parsedAllImages.slice(1);
        }
      } catch {
        // Fallback to database
        try {
          existingImages = work.images ? JSON.parse(work.images) : [];
        } catch {
          existingImages = [];
        }
      }
    } else {
      // Legacy: try to parse from database
      try {
        existingImages = work.images ? JSON.parse(work.images) : [];
      } catch {
        existingImages = [];
      }
    }

    const workCategory = category || work.category || 'product';
    const fs = require('fs');

    // If new images uploaded, add them to the end
    if (imageFiles && imageFiles.length > 0) {
      const newImageUrls = imageFiles.map(f => `/uploads/${f.filename}`);
      existingImages = [...existingImages, ...newImageUrls];
    }

    // If video deletion requested (check first, before processing new video)
    if (deleteVideo === 'true' && video) {
      const oldVideoPath = path.join(__dirname, video);
      if (fs.existsSync(oldVideoPath)) {
        fs.unlinkSync(oldVideoPath);
      }
      video = null;
    }

    // If new video uploaded (process after deletion, so new video isn't overwritten)
    if (videoFile) {
      // Delete old video if exists (and wasn't already deleted)
      if (video && deleteVideo !== 'true') {
        const oldVideoPath = path.join(__dirname, video);
        if (fs.existsSync(oldVideoPath)) {
          fs.unlinkSync(oldVideoPath);
        }
      }
      video = `/uploads/${videoFile.filename}`;
    }

    console.log('Updating work:', { id, title, image_url, workCategory, existingImages: existingImages.length, video });
    db.run(
      'UPDATE works SET title = ?, description = ?, image_url = ?, category = ?, images = ?, video = ? WHERE id = ?',
      [title, description || '', image_url, workCategory, JSON.stringify(existingImages), video, id],
      function(err) {
        if (err) {
          console.error('Database update error:', err);
          return res.status(500).json({ error: 'Failed to update work: ' + err.message });
        }
        console.log('Update success:', { id, title, video });
        res.json({
          id: parseInt(id),
          title,
          description,
          image_url,
          category: workCategory,
          images: existingImages,
          video
        });
      }
    );
  });
});

// Delete work
app.delete('/api/works/:id', authenticate, (req, res) => {
  const { id } = req.params;

  db.get('SELECT image_url FROM works WHERE id = ?', [id], (err, work) => {
    if (err || !work) {
      return res.status(404).json({ error: 'Work not found' });
    }

    // Delete the file
    const fs = require('fs');
    const filePath = path.join(__dirname, work.image_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.run('DELETE FROM works WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete work' });
      }
      res.json({ success: true });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type Work } from '../api';
import './WorkDetail.css';

export function WorkDetail() {
  const { id } = useParams<{ id: string }>();
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getWork(parseInt(id))
        .then(data => {
          // Parse images if it's a string
          const images = typeof data.images === 'string'
            ? JSON.parse(data.images)
            : data.images || [];
          setWork({ ...data, images, video: data.video || null });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!work) {
    return (
      <div className="not-found">
        <p>作品が見つかりません</p>
        <p>Work not found</p>
        <Link to="/">戻る / Back</Link>
      </div>
    );
  }

  // Combine main image with additional images
  const allImages = [work.image_url, ...(work.images || [])];

  return (
    <div className="work-detail">
      <Link to="/" className="back-link">
        ← 戻る
      </Link>

      <div className="work-content">
        <div className="work-gallery">
          {allImages.map((img, index) => (
            <div key={index} className="gallery-item">
              <img
                src={`http://localhost:3001${img}`}
                alt={`${work.title} ${index + 1}`}
              />
            </div>
          ))}
          {/* Video */}
          {work.video && (
            <div className="gallery-item video-item">
              <video
                src={`http://localhost:3001${work.video}`}
                controls
                playsInline
              />
            </div>
          )}
        </div>

        <div className="work-info">
          <h1>{work.title}</h1>
          {work.description && <p className="description">{work.description}</p>}
          <time>{new Date(work.created_at).toLocaleDateString('ja-JP')}</time>
        </div>
      </div>
    </div>
  );
}

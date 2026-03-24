import { useState, useEffect, useCallback, type FormEvent } from 'react';
import Cropper from 'react-easy-crop';
import { api, aboutApi, type Work, type Category, type AboutContent } from '../api';
import './Admin.css';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('product');
  const [images, setImages] = useState<File[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  const [video, setVideo] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null); // For editing
  const [uploading, setUploading] = useState(false);

  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [cropperMode, setCropperMode] = useState<'upload' | 'edit'>('upload');
  const [croppedFile, setCroppedFile] = useState<File | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('product');
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editMainImageIndex, setEditMainImageIndex] = useState<number>(0);
  const [editVideo, setEditVideo] = useState<File | null>(null);
  const [editExistingImages, setEditExistingImages] = useState<string[]>([]);
  const [editExistingVideo, setEditExistingVideo] = useState<string | null>(null);
  const [hadOriginalVideo, setHadOriginalVideo] = useState<boolean>(false);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // Drag and drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [workDragIndex, setWorkDragIndex] = useState<number | null>(null);

  // About content state
  const [aboutContent, setAboutContent] = useState<AboutContent | null>(null);
  const [aboutTitle, setAboutTitle] = useState('');
  const [aboutBody, setAboutBody] = useState('');
  const [aboutSaved, setAboutSaved] = useState(false);

  // Reorder works handlers
  const handleWorkDragStart = (index: number) => {
    setWorkDragIndex(index);
  };

  const handleWorkDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleWorkDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (workDragIndex === null || workDragIndex === dropIndex) {
      setWorkDragIndex(null);
      return;
    }

    const newWorks = [...works];
    const draggedWork = newWorks[workDragIndex];
    newWorks.splice(workDragIndex, 1);
    newWorks.splice(dropIndex, 0, draggedWork);

    // Create new order array
    const order = newWorks.map((w, i) => ({ id: w.id, sort_order: i }));
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await api.reorderWorks(order, token);
        setWorks(newWorks.map((w, i) => ({ ...w, sort_order: i })));
      } catch (err) {
        console.error('Failed to reorder:', err);
      }
    }

    setWorkDragIndex(null);
  };

  const handleWorkDragEnd = async () => {
    if (workDragIndex === null) return;
    // When drag ends without a valid drop, reset
    setWorkDragIndex(null);
  };

  // Move work up/down
  const moveWork = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= works.length) return;

    const newWorks = [...works];
    const [movedWork] = newWorks.splice(fromIndex, 1);
    newWorks.splice(toIndex, 0, movedWork);

    const order = newWorks.map((w, i) => ({ id: w.id, sort_order: i }));
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await api.reorderWorks(order, token);
        setWorks(newWorks.map((w, i) => ({ ...w, sort_order: i })));
      } catch (err) {
        console.error('Failed to reorder:', err);
      }
    }
  };

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      api.verify(token)
        .then(() => {
          setIsAuthenticated(true);
          loadWorks();
          aboutApi.getAbout().then(data => {
            setAboutContent(data);
            setAboutTitle(data.title);
            setAboutBody(data.body);
          });
        })
        .catch(() => {
          localStorage.removeItem('token');
        });
    }
  }, [token]);

  const loadWorks = () => {
    api.getWorks().then(data => setWorks(data));
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { token } = await api.login(username, password);
      localStorage.setItem('token', token);
      setIsAuthenticated(true);
      loadWorks();
    } catch {
      setError('ユーザー名またはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  // Handle image selection - show cropper
  const handleImageSelect = (file: File, mode: 'upload' | 'edit') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string);
      setCropperMode(mode);
      setShowCropper(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Create cropped image
  const createCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;

    const imageObj = new Image();
    imageObj.src = cropImageSrc;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    ctx.drawImage(
      imageObj,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      800,
      600
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });

        if (cropperMode === 'upload') {
          setCroppedFile(croppedFile);
          setImage(croppedFile);
        } else {
          setEditImage(croppedFile);
          setEditImagePreview(URL.createObjectURL(croppedFile));
        }

        setShowCropper(false);
        setCropImageSrc(null);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || images.length === 0) {
      setError('タイトルと画像を選択してください');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('mainImageIndex', mainImageIndex.toString());

      // Append all images
      images.forEach(img => {
        formData.append('images', img);
      });

      // Append video if exists
      if (video) {
        formData.append('video', video);
      }

      const token = localStorage.getItem('token')!;
      await api.createWork(formData, token);

      setTitle('');
      setDescription('');
      setImages([]);
      setMainImageIndex(0);
      setVideo(null);
      loadWorks();
    } catch {
      setError('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この作品を削除しますか？')) return;

    try {
      const token = localStorage.getItem('token')!;
      await api.deleteWork(id, token);
      loadWorks();
    } catch {
      setError('削除に失敗しました');
    }
  };

  const handleDeleteVideo = () => {
    if (!confirm('動画を削除しますか？')) return;
    setEditExistingVideo(null);
  };

  // Start editing
  const startEdit = (work: Work) => {
    setEditingId(work.id);
    setEditTitle(work.title);
    setEditDescription(work.description);
    setEditCategory((work.category as Category) || 'product');
    setEditImages([]);
    setEditMainImageIndex(0);
    setEditVideo(null);
    // Combine main image with additional images
    let existingImages: string[] = [];
    try {
      if (typeof work.images === 'string') {
        existingImages = JSON.parse(work.images);
      } else if (Array.isArray(work.images)) {
        existingImages = work.images;
      }
    } catch {
      existingImages = [];
    }
    setEditExistingImages([work.image_url, ...existingImages]);
    setEditExistingVideo(work.video || null);
    setHadOriginalVideo(!!work.video);
    setEditImage(null);
    setEditImagePreview(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
    setEditImages([]);
    setEditMainImageIndex(0);
    setEditVideo(null);
    setEditExistingImages([]);
    setEditExistingVideo(null);
    setHadOriginalVideo(false);
    setEditImage(null);
    setEditImagePreview(null);
    setDragIndex(null);
  };

  // Drag and drop handlers for reordering images
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;

    const allImages = [...editExistingImages];

    // Reorder
    const draggedImage = allImages[dragIndex];
    allImages.splice(dragIndex, 1);
    allImages.splice(dropIndex, 0, draggedImage);

    // Update main image index if needed
    let newMainIndex = editMainImageIndex;
    if (editMainImageIndex === dragIndex) {
      newMainIndex = dropIndex;
    } else if (dragIndex < editMainImageIndex && dropIndex >= editMainImageIndex) {
      newMainIndex = editMainImageIndex - 1;
    } else if (dragIndex > editMainImageIndex && dropIndex <= editMainImageIndex) {
      newMainIndex = editMainImageIndex + 1;
    }

    setEditExistingImages(allImages);
    setEditMainImageIndex(newMainIndex);
    setDragIndex(null);
  };

  // Set image as main/cover
  const handleSetMainImage = (index: number) => {
    if (index === editMainImageIndex) return;

    const allImages = [...editExistingImages];
    const selectedImage = allImages[index];

    // Move selected image to first position
    allImages.splice(index, 1);
    allImages.unshift(selectedImage);

    setEditExistingImages(allImages);
    setEditMainImageIndex(0);
  };

  // Save edit
  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTitle) {
      setError('タイトルを入力してください');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('description', editDescription);
      formData.append('category', editCategory);
      // First image is always main after reordering
      formData.append('mainImageIndex', '0');

      // Pass all existing images (after reordering/deletion)
      formData.append('allImages', JSON.stringify(editExistingImages));

      // Append new images
      editImages.forEach(img => {
        formData.append('images', img);
      });

      // Append video if exists
      if (editVideo) {
        formData.append('video', editVideo);
      }

      // If existing video was deleted (editExistingVideo is null but originally had video)
      if (hadOriginalVideo && !editVideo && !editExistingVideo) {
        formData.append('deleteVideo', 'true');
      }

      const token = localStorage.getItem('token')!;
      const result = await api.updateWork(editingId!, formData, token);
      console.log('Update success:', result);

      cancelEdit();
      loadWorks();
    } catch (err) {
      console.error('Update failed:', err);
      setError('更新に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin admin-login">
        <div className="login-form">
          <h1>管理画面</h1>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input
                type="text"
                placeholder="ユーザー名"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? '...' : 'ログイン'}
            </button>
          </form>
          <p className="hint">ユーザー名: admin / パスワード: portfolio123</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      {/* Cropper Modal */}
      {showCropper && cropImageSrc && (
        <div className="cropper-modal">
          <div className="cropper-content">
            <h3>画像を切り抜き</h3>
            <p>ドラッグして調整してください</p>
            <div className="cropper-container">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="cropper-controls">
              <div className="zoom-control">
                <span>−</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
                <span>+</span>
              </div>
            </div>
            <div className="cropper-actions">
              <button onClick={createCroppedImage} className="save-btn">
                切り抜く
              </button>
              <button onClick={() => { setShowCropper(false); setCropImageSrc(null); }} className="cancel-btn">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="admin-header">
        <h1>作品管理</h1>
        <button onClick={handleLogout} className="logout-btn">
          ログアウト
        </button>
      </header>

      {/* About ページ編集 */}
      <section className="upload-section">
        <h2>About ページ</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const token = localStorage.getItem('token')!;
              const result = await aboutApi.updateAbout({ title: aboutTitle, body: aboutBody }, token);
              setAboutContent(result);
              setAboutSaved(true);
              setTimeout(() => setAboutSaved(false), 2000);
            } catch {
              setError('保存に失敗しました');
            }
          }}
          className="upload-form"
        >
          <div className="form-group">
            <input
              type="text"
              placeholder="タイトル"
              value={aboutTitle}
              onChange={e => setAboutTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <textarea
              placeholder="自己紹介（改行で段落を追加）"
              value={aboutBody}
              onChange={e => setAboutBody(e.target.value)}
              rows={8}
            />
          </div>
          {aboutSaved && <p className="success">保存しました</p>}
          <button type="submit">保存</button>
        </form>
      </section>

      <section className="upload-section">
        <h2>新規作品をアップロード</h2>
        <form onSubmit={handleUpload} className="upload-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="作品タイトル"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <textarea
              placeholder="説明（任意）"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-group">
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              <option value="product">PRODUCT / 製品</option>
              <option value="interaction">INTERACTION / インタラクション</option>
              <option value="advertising">ADVERTISING / 広告</option>
            </select>
          </div>
          <div className="form-group">
            <label className="file-input">
              <span>{images.length > 0 ? `${images.length}枚の画像を選択` : '画像を選択（複数可）'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    setImages(Array.from(files));
                    setMainImageIndex(0);
                  }
                }}
              />
            </label>
          </div>
          {images.length > 0 && (
            <>
              <p className="form-hint">封面画像（主图）を選択:</p>
              <div className="preview-thumbs main-select">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`preview-thumb ${mainImageIndex === i ? 'selected' : ''}`}
                    onClick={() => setMainImageIndex(i)}
                  >
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Preview ${i + 1}`}
                    />
                    {mainImageIndex === i && <span className="main-badge">MAIN</span>}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="form-group">
            <label className="file-input video-input">
              <span>{video ? video.name : '動画を選択（任意）'}</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setVideo(file);
                }}
              />
            </label>
            {video && (
              <button type="button" className="remove-video" onClick={() => setVideo(null)}>
                動画を削除
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={uploading}>
            {uploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </form>
      </section>

      <section className="works-list">
        <h2>作品一覧（ドラッグで並び替え）</h2>
        {works.length === 0 ? (
          <p className="empty">まだ作品がありません</p>
        ) : (
          <div className="works-table sortable-works">
            {works.map((work, index) => (
              <div
                key={work.id}
                className={`work-item ${workDragIndex === index ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleWorkDragStart(index)}
                onDragOver={handleWorkDragOver}
                onDrop={(e) => handleWorkDrop(e, index)}
                onDragEnd={handleWorkDragEnd}
              >
                {editingId === work.id ? (
                  <form onSubmit={handleEdit} className="edit-form">
                    <div className="edit-images-section">
                      <p className="form-hint">画像をドラッグで並び替え、クリックで封面に設定:</p>
                      <div className="preview-thumbs main-select sortable">
                        {editExistingImages.map((img, i) => (
                          <div
                            key={i}
                            className={`preview-thumb ${editMainImageIndex === i ? 'selected' : ''} ${dragIndex === i ? 'dragging' : ''}`}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(i)}
                            onClick={() => handleSetMainImage(i)}
                          >
                            <img src={`http://localhost:3001${img}`} alt={`${i + 1}`} />
                            {editMainImageIndex === i && <span className="main-badge">MAIN</span>}
                            <button
                              type="button"
                              className="remove-image-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const wasMain = editMainImageIndex === i;
                                const newImages = editExistingImages.filter((_, idx) => idx !== i);
                                setEditExistingImages(newImages);
                                if (wasMain) {
                                  setEditMainImageIndex(0);
                                } else if (editMainImageIndex > i) {
                                  setEditMainImageIndex(editMainImageIndex - 1);
                                }
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {editImages.map((img, i) => (
                          <div
                            key={`new-${i}`}
                            className="preview-thumb"
                          >
                            <img src={URL.createObjectURL(img)} alt={`New ${i}`} />
                            <button
                              type="button"
                              className="remove-image-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newImages = editImages.filter((_, idx) => idx !== i);
                                setEditImages(newImages);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <label className="file-input edit-file">
                        <span>+ 画像を追加</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={e => {
                            const files = e.target.files;
                            if (files) setEditImages([...editImages, ...Array.from(files)]);
                          }}
                        />
                      </label>
                      {editExistingVideo && (
                        <div className="current-video">
                          <p>現在の動画</p>
                          <button
                            type="button"
                            onClick={handleDeleteVideo}
                            className="delete-video-btn"
                          >
                            動画を削除
                          </button>
                        </div>
                      )}
                      <label className="file-input edit-file">
                        <span>{editVideo ? '✓ 動画を選択済み' : '動画を追加/変更'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) setEditVideo(file);
                          }}
                        />
                      </label>
                    </div>
                    <div className="work-details">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder="タイトル"
                      />
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        placeholder="説明"
                        rows={2}
                      />
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value as Category)}
                      >
                        <option value="product">PRODUCT / 製品</option>
                        <option value="interaction">INTERACTION / インタラクション</option>
                        <option value="advertising">ADVERTISING / 広告</option>
                      </select>
                    </div>
                    <div className="edit-actions">
                      <button type="submit" disabled={uploading} className="save-btn">
                        保存
                      </button>
                      <button type="button" onClick={cancelEdit} className="cancel-btn">
                        キャンセル
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="work-reorder">
                      <button
                        onClick={() => moveWork(index, index - 1)}
                        disabled={index === 0}
                        title="上に移動"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveWork(index, index + 1)}
                        disabled={index === works.length - 1}
                        title="下に移動"
                      >
                        ↓
                      </button>
                    </div>
                    <img
                      src={`http://localhost:3001${work.image_url}`}
                      alt={work.title}
                    />
                    <div className="work-details">
                      <h3>{work.title}</h3>
                      <p>{work.description || '説明なし'}</p>
                    </div>
                    <div className="work-actions">
                      <button
                        onClick={() => startEdit(work)}
                        className="edit-btn"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(work.id)}
                        className="delete-btn"
                      >
                        削除
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

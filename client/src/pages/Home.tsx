import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, API_BASE, type Work, type Category } from '../api';
import './Home.css';

// Helper to get image URL
const getImageUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE.replace('/api', '')}${path}`;
};

const categories: { key: Category; labelKey: string }[] = [
  { key: 'all', labelKey: 'categories.all' },
  { key: 'product', labelKey: 'categories.product' },
  { key: 'interaction', labelKey: 'categories.interaction' },
  { key: 'advertising', labelKey: 'categories.advertising' },
];

// 生成伪随机数
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 星球数据
interface Planet {
  id: number;
  work: Work;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number; // 原始半径
  currentRadius: number; // 当前显示的半径（用于动画）
  rotation: number; // 当前旋转角度（鸟嘴朝向）
}

export function Home() {
  const { t } = useTranslation();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null);
  const [lockedCategory, setLockedCategory] = useState<Category | null>(null);
  const [selectedPlanetId, setSelectedPlanetId] = useState<number | null>(null);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const selectedIdRef = useRef<number | null>(null);
  const hoveredCategoryRef = useRef<Category | null>(null);
  const lockedCategoryRef = useRef<Category | null>(null);
  const isClickingRef = useRef(false); // 防止点击时触发mouseleave
  const [, forceUpdate] = useState({});
  const animationRef = useRef<number>();

  // 锁定星球的半径
  const SELECTED_RADIUS_MULTIPLIER = 2.0; // 选中时变大的倍数
  const GROWTH_SPEED = 0.08; // 变大的速度
  const CIRCLE_RADIUS = 200; // 围成圆的半径

  // 初始化星球位置和速度
  const initPlanets = useCallback((worksData: Work[]) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const logoAreaRadius = 180; // 避开logo中心的区域

    const newPlanets: Planet[] = worksData.map((work, index) => {
      const seed = index * 127;
      const rand = () => pseudoRandom(seed + index);

      // 随机位置，但避开中心区域（logo所在位置）
      let x, y;
      let attempts = 0;
      do {
        x = 100 + rand() * (window.innerWidth - 200);
        y = 100 + rand() * (window.innerHeight - 200);
        attempts++;
      } while (
        Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) < logoAreaRadius &&
        attempts < 50
      );

      // 随机速度（缓慢漂浮）
      const speed = 0.2 + rand() * 0.3;
      const angle = rand() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // 固定大小（统一尺寸）
      const radius = 60;

      return { id: work.id, work, x, y, vx, vy, radius, currentRadius: radius, rotation: angle };
    });

    planetsRef.current = newPlanets;
    setPlanets(newPlanets);
  }, []);

  // 动画循环 - 使用 ref 存储状态避免闭包问题
  useEffect(() => {
    let isRunning = true;

    // 处理星球之间的碰撞（使用当前半径）
    const handlePlanetCollisions = (planets: Planet[]): Planet[] => {
      const newPlanets = [...planets];

      for (let i = 0; i < newPlanets.length; i++) {
        for (let j = i + 1; j < newPlanets.length; j++) {
          const p1 = newPlanets[i];
          const p2 = newPlanets[j];

          // SVG 内部圆是 r=40，在 100x100 viewBox 中；SVG 尺寸是 currentRadius*2
          // 视觉比例 = currentRadius / 50（因为 50*2=100 对应 viewBox 宽高）
          // 碰撞边界 = (SVG圆半径 + 描边半宽) * 视觉比例
          const strokeOffset = 1; // stroke-width=2, half on each side = 1px
          const svgCircleRadius = 40;
          const scale1 = p1.currentRadius / 50;
          const scale2 = p2.currentRadius / 50;
          const boundaryRadius1 = (svgCircleRadius + strokeOffset) * scale1;
          const boundaryRadius2 = (svgCircleRadius + strokeOffset) * scale2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDist = boundaryRadius1 + boundaryRadius2;

          if (distance < minDist && distance > 0) {
            // 计算碰撞法向量（从p1指向p2）
            const nx = dx / distance;
            const ny = dy / distance;

            // 分离重叠的星球（完全推开，不留残余重叠）
            const overlap = (minDist - distance);
            p1.x -= nx * overlap;
            p1.y -= ny * overlap;
            p2.x += nx * overlap;
            p2.y += ny * overlap;

            // 相对速度
            const dvx = p1.vx - p2.vx;
            const dvy = p1.vy - p2.vy;

            // 相对速度在碰撞法向量上的投影
            const dvn = dvx * nx + dvy * ny;

            // 弹性碰撞（台球式，假设质量与半径成正比）
            const m1 = p1.currentRadius;
            const m2 = p2.currentRadius;
            const massSum = m1 + m2;

            // 更新速度（完美的弹性碰撞）
            const impulse = (2 * dvn) / massSum;

            p1.vx -= impulse * m2 * nx;
            p1.vy -= impulse * m2 * ny;
            p2.vx += impulse * m1 * nx;
            p2.vy += impulse * m1 * ny;

            // 更新旋转角度（鸟嘴朝向新的运动方向）
            const speed1 = Math.sqrt(p1.vx * p1.vx + p1.vy * p1.vy);
            const speed2 = Math.sqrt(p2.vx * p2.vx + p2.vy * p2.vy);

            if (speed1 > 0.1) {
              p1.rotation = Math.atan2(p1.vy, p1.vx) * (180 / Math.PI) + 90;
            }
            if (speed2 > 0.1) {
              p2.rotation = Math.atan2(p2.vy, p2.vx) * (180 / Math.PI) + 90;
            }
          }
        }
      }

      return newPlanets;
    };

    const animate = () => {
      if (!isRunning) return;

      // 只有在有星球数据时才更新
      if (planetsRef.current.length > 0) {
        const padding = 60; // 边缘padding
        const selectedId = selectedIdRef.current;
        // 悬停或锁定时都聚成圆圈
        const hoveredCat = hoveredCategoryRef.current || lockedCategoryRef.current;
        const currentCat = activeCategory;

        // 只有悬停在某个分类（不是all）时才围成圆圈
        const activeCat = hoveredCat && hoveredCat !== 'all' ? hoveredCat : null;

        if (activeCat) {
          const categoryPlanets = planetsRef.current.filter(p => p.work.category === activeCat);
          const otherPlanets = planetsRef.current.filter(p => p.work.category !== activeCat);

          if (categoryPlanets.length > 0) {
            // 计算圆圈的中心点（以 logo 为圆心，正好在屏幕正中央）
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const angleStep = (Math.PI * 2) / categoryPlanets.length;

            categoryPlanets.forEach((planet, index) => {
              const targetX = centerX + Math.cos(angleStep * index - Math.PI / 2) * CIRCLE_RADIUS;
              const targetY = centerY + Math.sin(angleStep * index - Math.PI / 2) * CIRCLE_RADIUS;

              // 直接固定位置，不抖动
              planet.x = targetX;
              planet.y = targetY;
              planet.vx = 0;
              planet.vy = 0;

              // 鸟嘴朝向圆心：atan2(planet相对圆心的角度) - 180
              // 鸟嘴默认朝上(12点钟)，在圆顶部时需转180°才能指向圆心
              const dx = planet.x - centerX;
              const dy = planet.y - centerY;
              planet.rotation = Math.atan2(dy, dx) * (180 / Math.PI) - 180;
            });

            // 其他星球移到边缘，也直接固定，鸟嘴朝向圆心
            otherPlanets.forEach((planet, index) => {
              const side = index % 2 === 0 ? -1 : 1;
              const targetX = side > 0 ? padding + planet.radius + 20 : window.innerWidth - padding - planet.radius - 20;
              const targetY = padding + 150 + (index % 3) * 100;

              planet.x = targetX;
              planet.y = targetY;
              planet.vx = 0;
              planet.vy = 0;

              const dx = planet.x - centerX;
              const dy = planet.y - centerY;
              planet.rotation = Math.atan2(dy, dx) * (180 / Math.PI) - 180;
            });
          }
        } else {
          // 正常漂浮运动 - 确保每个星球都有速度
          planetsRef.current.forEach(planet => {
            // 如果星球没有速度（从圆圈恢复），给予一个随机速度
            if (Math.abs(planet.vx) < 0.1 && Math.abs(planet.vy) < 0.1) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 0.15 + Math.random() * 0.25;
              planet.vx = Math.cos(angle) * speed;
              planet.vy = Math.sin(angle) * speed;
            }
          });

          // 正常漂浮运动
          planetsRef.current = planetsRef.current.map(planet => {
            let { x, y, vx, vy, radius, currentRadius } = planet;

          // 计算目标半径
          const isSelected = planet.id === selectedId;
          const targetRadius = isSelected ? radius * SELECTED_RADIUS_MULTIPLIER : radius;

          // 平滑过渡当前半径
          const radiusDiff = targetRadius - currentRadius;
          if (Math.abs(radiusDiff) > 0.5) {
            currentRadius += radiusDiff * GROWTH_SPEED;
          } else {
            currentRadius = targetRadius;
          }

          // 如果是选中的星球，弹开其他星球
          if (isSelected && currentRadius > radius) {
            const expandedRadius = currentRadius;

            // 遍历其他星球，施加弹力
            planetsRef.current.forEach(otherPlanet => {
              if (otherPlanet.id === planet.id) return;

              const dx = otherPlanet.x - x;
              const dy = otherPlanet.y - y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const expandedVisual = (40 + 1) * (expandedRadius / 50);
              const otherVisual = (40 + 1) * (otherPlanet.currentRadius / 50);
              const minDist = expandedVisual + otherVisual;

              // 如果其他星球在扩展范围内
              if (distance < minDist && distance > 0) {
                // 计算弹力强度（距离越近，力越大）
                const overlap = minDist - distance;
                const force = overlap * 0.15; // 弹力系数

                // 归一化方向
                const nx = dx / distance;
                const ny = dy / distance;

                // 施加弹力到其他星球
                otherPlanet.vx += nx * force;
                otherPlanet.vy += ny * force;

                // 反作用力（选中星球自己也被轻轻推开）
                vx -= nx * force * 0.2;
                vy -= ny * force * 0.2;
              }
            });
          }

          // 更新位置
          x += vx;
          y += vy;

          // 视觉碰撞半径 = (SVG圆半径 + 描边半宽) * 缩放比例
          const visualBoundaryRadius = (40 + 1) * (currentRadius / 50);

          // 边界检测和镜像反弹（像台球一样）
          let hitWall = false;
          if (x - visualBoundaryRadius < padding) {
            x = padding + visualBoundaryRadius;
            vx = Math.abs(vx) > 0.05 ? Math.abs(vx) : 0.3; // 保持原有方向，确保最小速度
            hitWall = true;
          } else if (x + visualBoundaryRadius > window.innerWidth - padding) {
            x = window.innerWidth - padding - visualBoundaryRadius;
            vx = Math.abs(vx) > 0.05 ? -Math.abs(vx) : -0.3; // 保持原有方向，确保最小速度
            hitWall = true;
          }

          if (y - visualBoundaryRadius < padding) {
            y = padding + visualBoundaryRadius;
            vy = Math.abs(vy) > 0.05 ? Math.abs(vy) : 0.3;
            hitWall = true;
          } else if (y + visualBoundaryRadius > window.innerHeight - padding) {
            y = window.innerHeight - padding - visualBoundaryRadius;
            vy = Math.abs(vy) > 0.05 ? -Math.abs(vy) : -0.3;
            hitWall = true;
          }

          // 限制最大速度，防止时间累积导致加速
          const maxSpeed = 1.2;
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          if (currentSpeed > maxSpeed) {
            vx = (vx / currentSpeed) * maxSpeed;
            vy = (vy / currentSpeed) * maxSpeed;
          }

          // 根据速度方向计算旋转角度（鸟嘴朝向）
          let rotation = planet.rotation;
          if (currentSpeed > 0.1) {
            // atan2 返回的是弧度，转成角度，然后加90度让鸟嘴朝前
            rotation = Math.atan2(vy, vx) * (180 / Math.PI) + 90;
          }

          return { ...planet, x, y, vx, vy, currentRadius, rotation };
        });
        } // 结束正常漂浮运动的else分支

        // 处理星球之间的碰撞（圆圈模式下跳过，位置已固定）
        if (!activeCat) {
          planetsRef.current = handlePlanetCollisions(planetsRef.current);
        }

        // 强制重新渲染
        setPlanets([...planetsRef.current]);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 加载作品数据
  useEffect(() => {
    setLoading(true);
    api.getWorks(activeCategory).then(data => {
      setWorks(data);
      setLoading(false);
      initPlanets(data);
    });
  }, [activeCategory, initPlanets]);

  // 窗口大小变化时重新调整位置
  useEffect(() => {
    const handleResize = () => {
      planetsRef.current = planetsRef.current.map(planet => ({
        ...planet,
        x: Math.min(Math.max(planet.x, 100), window.innerWidth - 100),
        y: Math.min(Math.max(planet.y, 100), window.innerHeight - 100),
      }));
      setPlanets([...planetsRef.current]);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="home">
      <header className="hero">
        <div className="logo-container">
          <img src="/wdn-logo.png" alt="WONDER BIRD" className="site-logo" />
        </div>
      </header>

      <div className="category-tabs">
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`category-tab ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              isClickingRef.current = true;
              setTimeout(() => { isClickingRef.current = false; }, 100);

              if (cat.key === 'all') {
                setActiveCategory('all');
                setLockedCategory(null);
                lockedCategoryRef.current = null;
              } else {
                setActiveCategory(cat.key);
                setLockedCategory(cat.key);
                lockedCategoryRef.current = cat.key;
                hoveredCategoryRef.current = null;
              }
            }}
            onMouseEnter={() => {
              setHoveredCategory(cat.key);
              hoveredCategoryRef.current = cat.key;
            }}
            onMouseLeave={() => {
              if (!isClickingRef.current && !lockedCategoryRef.current) {
                setHoveredCategory(null);
                hoveredCategoryRef.current = null;
              }
            }}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">{t('home.loading')}</div>
      ) : works.length === 0 ? (
        <div className="empty">
          <p>{t('home.noWorks')}</p>
        </div>
      ) : (
        <div className="works-universe" onClick={() => {
          setSelectedPlanetId(null);
          selectedIdRef.current = null;
          setHoveredCategory(null);
          hoveredCategoryRef.current = null;
          setLockedCategory(null);
          lockedCategoryRef.current = null;
          setActiveCategory('all');
        }}>
          {/* 只显示当前分类（点击或悬停）的作品 */}
          {planets
            .filter(planet => {
              // 优先使用锁定的分类 > 悬停的分类 > 激活的分类
              const showCat = lockedCategory || hoveredCategory || activeCategory;
              return showCat === 'all' || planet.work.category === showCat;
            })
            .map((planet, index) => (
            <Link
              to={`/work/${planet.work.id}`}
              key={planet.work.id}
              className={`bouncing-planet ${selectedPlanetId === planet.id ? 'selected' : ''}`}
              style={{
                left: planet.x,
                top: planet.y,
                zIndex: index + 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                // 切换选中状态
                if (selectedPlanetId === planet.id) {
                  setSelectedPlanetId(null);
                  selectedIdRef.current = null;
                } else {
                  setSelectedPlanetId(planet.id);
                  selectedIdRef.current = planet.id;
                }
              }}
            >
              <svg
                className="planet-svg"
                viewBox="-50 -50 100 100"
                width={planet.currentRadius * 2}
                height={planet.currentRadius * 2}
                style={{ transform: `rotate(${planet.rotation}deg)`, transition: activeCategory === 'all' ? 'transform 0.15s ease-out' : 'none' }}
              >
                <defs>
                  {/* clipPath 始终是 0°，不跟随 SVG 旋转 */}
                  <clipPath id={`clip-${planet.id}`}>
                    <circle cx="0" cy="0" r="40" />
                  </clipPath>
                </defs>
                {/* 填充图片 - 反向旋转保持水平 */}
                <g style={{ transform: 'rotate(' + (-planet.rotation) + 'deg)', transformOrigin: 'center', transformBox: 'fill-box' }}>
                  <image
                    href={getImageUrl(planet.work.image_url)}
                    x="-40"
                    y="-40"
                    width="80"
                    height="80"
                    clipPath={`url(#clip-${planet.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
                {/* 圆形描边 */}
                <circle
                  cx="0"
                  cy="0"
                  r="40"
                  fill="none"
                  stroke="rgba(0,0,0,0.8)"
                  strokeWidth="2"
                />
                {/* 三角形鸟嘴 - 底部深入描边内侧，无缝衔接 */}
                <path
                  d="M -7,-39 L 0,-48 L 7,-39"
                  fill="none"
                  stroke="rgba(0,0,0,0.8)"
                  strokeWidth="2"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  strokeMiterlimit="10"
                />
              </svg>
              <span className="planet-name">{planet.work.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

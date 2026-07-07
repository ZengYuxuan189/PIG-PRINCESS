/**
 * 像素弹跳装饰系统
 * 在页面背景中生成像素风格的圆形/心形/星形图案，
 * 随机移动并碰到边缘时反弹，模拟屏幕保护程序效果
 *
 * 使用 Canvas 2D 渲染，requestAnimationFrame 驱动
 * 所有图案均为像素艺术风格，配色来自 NES 调色板
 */

// ============================================================
//  像素图案定义（位图）
//  1 = 填充像素, 0 = 透明
// ============================================================
const PIXEL_SHAPES = {
  /** 像素爱心 — 经典 8-bit 心形 */
  heart: [
    [0,1,0,0,0,1,0],
    [1,1,1,0,1,1,1],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ],

  /** 像素星星 — 马里奥风格 */
  star: [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,1,0,1,0,1,0],
    [1,0,0,1,0,0,1],
  ],

  /** 像素圆形/硬币 */
  circle: [
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
  ],

  /** 像素皇冠 — 公主风 */
  crown: [
    [0,1,0,0,0,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,0,1,1,1,0,0],
    [0,0,1,1,1,0,0],
    [0,0,1,1,1,0,0],
    [0,0,1,0,1,0,0],
  ],

  /** 像素钻石/宝石 */
  gem: [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,1,0,1,1,0],
    [1,1,1,1,1,1,1],
    [0,1,1,0,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ],

  /** 像素花朵 */
  flower: [
    [0,1,0,0,0,1,0],
    [0,0,1,0,1,0,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,0,1,0,1,0,0],
    [0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0],
  ],

  /** 小号圆形 — 简洁像素点 */
  dot: [
    [0,1,1,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
  ],
};

// ============================================================
//  NES 色彩池（用于弹跳装饰）
// ============================================================
const DECO_COLORS = [
  '#f8b800', // 金
  '#f87858', // 橙
  '#f878f8', // 粉
  '#58d854', // 绿
  '#3cbcfc', // 蓝
  '#f83800', // 红
  '#00e8d8', // 青
  '#fca044', // 橘
  '#b8f818', // 黄绿
  '#fcbca0', // 肤色
  '#d8b8f8', // 淡紫
  '#a4e4fc', // 淡蓝
];

// ============================================================
//  装饰对象池
// ============================================================
const SHAPE_KEYS = Object.keys(PIXEL_SHAPES);
const DECO_COUNT = 25;  // 屏幕上同时存在的装饰数量

/** @type {Array<{x:number, y:number, vx:number, vy:number, shape:string, color:string, scale:number, rot:number}>} */
let decorations = [];

// ============================================================
//  Canvas 和动画状态
// ============================================================
/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;
let animId = null;
let lastTime = 0;

// ============================================================
//  初始化
// ============================================================

/**
 * 创建单个装饰对象
 * @param {number} maxW - 画布宽度
 * @param {number} maxH - 画布高度
 * @returns {object}
 */
function createDecoration(maxW, maxH) {
  const shape = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
  const scale = 2 + Math.floor(Math.random() * 3);  // 2x ~ 4x 像素放大
  const bitmap = PIXEL_SHAPES[shape];
  const w = bitmap[0].length * scale;
  const h = bitmap.length * scale;

  return {
    x: Math.random() * (maxW - w),
    y: Math.random() * (maxH - h),
    vx: (Math.random() - 0.5) * 2.5,   // 水平速度
    vy: (Math.random() - 0.5) * 2.5,   // 垂直速度
    shape: shape,
    color: DECO_COLORS[Math.floor(Math.random() * DECO_COLORS.length)],
    scale: scale,
  };
}

/**
 * 初始化/重置所有装饰
 */
function initDecorations() {
  decorations = [];
  const w = canvas.width;
  const h = canvas.height;
  for (let i = 0; i < DECO_COUNT; i++) {
    decorations.push(createDecoration(w, h));
  }
}

// ============================================================
//  渲染
// ============================================================

/**
 * 在 Canvas 上绘制一个像素图案
 * @param {string} shapeKey - PIXEL_SHAPES 的键名
 * @param {number} dx - 绘制起始 x
 * @param {number} dy - 绘制起始 y
 * @param {number} scale - 像素放大倍数
 * @param {string} color - 填充颜色
 */
function drawShape(shapeKey, dx, dy, scale, color) {
  const bitmap = PIXEL_SHAPES[shapeKey];
  if (!bitmap) return;

  ctx.fillStyle = color;

  for (let r = 0; r < bitmap.length; r++) {
    for (let c = 0; c < bitmap[r].length; c++) {
      if (bitmap[r][c] === 1) {
        ctx.fillRect(
          Math.round(dx + c * scale),
          Math.round(dy + r * scale),
          scale,
          scale
        );
      }
    }
  }

  // 给每个像素块加个深色边（模拟像素边框）
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let r = 0; r < bitmap.length; r++) {
    for (let c = 0; c < bitmap[r].length; c++) {
      if (bitmap[r][c] === 1) {
        // 下边和右边加阴影边
        ctx.fillRect(
          Math.round(dx + c * scale + scale - 1),
          Math.round(dy + r * scale),
          1,
          scale
        );
        ctx.fillRect(
          Math.round(dx + c * scale),
          Math.round(dy + r * scale + scale - 1),
          scale,
          1
        );
      }
    }
  }
}

/**
 * 每一帧的更新 + 渲染
 * @param {number} timestamp - requestAnimationFrame 提供的时间戳
 */
function tick(timestamp) {
  if (!lastTime) lastTime = timestamp;
  // 限制最大 delta 防止跳帧时飞出去
  const dt = Math.min((timestamp - lastTime) / 16.667, 3);
  lastTime = timestamp;

  const w = canvas.width;
  const h = canvas.height;

  // 清除画布
  ctx.clearRect(0, 0, w, h);

  // 更新位置 + 碰撞检测 + 绘制
  for (const deco of decorations) {
    const bitmap = PIXEL_SHAPES[deco.shape];
    const pw = bitmap[0].length * deco.scale;
    const ph = bitmap.length * deco.scale;

    // 更新位置
    deco.x += deco.vx * dt;
    deco.y += deco.vy * dt;

    // 左右边界反弹
    if (deco.x <= 0) {
      deco.x = 0;
      deco.vx = Math.abs(deco.vx);
    } else if (deco.x + pw >= w) {
      deco.x = w - pw;
      deco.vx = -Math.abs(deco.vx);
    }

    // 上下边界反弹
    if (deco.y <= 0) {
      deco.y = 0;
      deco.vy = Math.abs(deco.vy);
    } else if (deco.y + ph >= h) {
      deco.y = h - ph;
      deco.vy = -Math.abs(deco.vy);
    }

    // 绘制
    drawShape(deco.shape, deco.x, deco.y, deco.scale, deco.color);
  }

  animId = requestAnimationFrame(tick);
}

// ============================================================
//  画布大小管理
// ============================================================

/**
 * 调整画布尺寸以匹配窗口
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 重置坐标空间到 CSS 像素
  ctx.scale(1, 1);
  // 重置装饰位置（避免旧坐标超出新画布）
  initDecorations();
}

// 实际上 setTransform 已经设置了正确的缩放。但在后续 draw 中我们使用 CSS 像素坐标，
// 所以需要调整。让我简化：直接使用 CSS 像素，用 scale() 来处理 DPR。

function resizeCanvasSimple() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // 重置所有装饰
  initDecorations();
}

// ============================================================
//  启动
// ============================================================

/**
 * 启动弹跳装饰动画
 */
function startBouncingDecorations() {
  canvas = document.getElementById('decoCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  // 禁用图像平滑 — 保持像素锐利
  ctx.imageSmoothingEnabled = false;

  // 设置画布大小
  resizeCanvasSimple();

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    resizeCanvasSimple();
  });

  // 启动动画循环
  lastTime = 0;
  animId = requestAnimationFrame(tick);
}

// DOM 加载完成后启动
document.addEventListener('DOMContentLoaded', startBouncingDecorations);

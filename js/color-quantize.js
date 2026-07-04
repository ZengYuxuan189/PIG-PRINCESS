/**
 * 颜色量化模块
 * 将任意 RGB 颜色映射到最近的调色板颜色
 */

/**
 * 将 hex 颜色字符串解析为 RGB 对象
 * @param {string} hex - 如 '#FF8800'
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * 计算两个 RGB 颜色之间的欧几里得距离（加权）
 * 使用加权距离让人眼感知更准确（绿色权重更高）
 * @param {{r,g,b}} c1
 * @param {{r,g,b}} c2
 * @returns {number}
 */
function colorDistance(c1, c2) {
  const rMean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  // 使用加权欧几里得距离，考虑人眼对不同颜色的敏感度
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

/**
 * 将 RGB 颜色量化到最近的调色板颜色
 * @param {number} r - 红色通道 (0-255)
 * @param {number} g - 绿色通道 (0-255)
 * @param {number} b - 蓝色通道 (0-255)
 * @param {string[]} palette - 调色板 hex 颜色数组
 * @returns {string} 最近的调色板 hex 颜色
 */
function quantizeColor(r, g, b, palette) {
  const target = { r, g, b };
  let minDist = Infinity;
  let closestColor = palette[0];

  for (const hex of palette) {
    const pc = hexToRgb(hex);
    const dist = colorDistance(target, pc);
    if (dist < minDist) {
      minDist = dist;
      closestColor = hex;
    }
  }

  return closestColor;
}

/**
 * 批量量化 ImageData 中的所有像素颜色
 * @param {ImageData} imageData - 原始像素数据
 * @param {string[]} palette - 目标调色板
 * @returns {Uint8ClampedArray} 量化后的像素数据
 */
function quantizeImageData(imageData, palette) {
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const quantized = hexToRgb(quantizeColor(r, g, b, palette));
    data[i] = quantized.r;
    data[i + 1] = quantized.g;
    data[i + 2] = quantized.b;
    // alpha 保持不变
  }

  return data;
}

/**
 * 获取 avgColor 的平均颜色并量化（用于像素化过程中的颜色归约）
 * @param {CanvasRenderingContext2D} ctx - 源 canvas 上下文
 * @param {number} sx - 源 x
 * @param {number} sy - 源 y
 * @param {number} sw - 源宽度
 * @param {number} sh - 源高度
 * @param {string[]} palette - 调色板
 * @returns {{r: number, g: number, b: number, hex: string}} 量化后的颜色
 */
function getQuantizedBlockColor(ctx, sx, sy, sw, sh, palette) {
  const blockData = ctx.getImageData(sx, sy, sw, sh);
  const pixels = blockData.data;

  let totalR = 0, totalG = 0, totalB = 0;
  const count = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    // 跳过透明像素
    if (pixels[i + 3] < 128) continue;
    totalR += pixels[i];
    totalG += pixels[i + 1];
    totalB += pixels[i + 2];
  }

  // 如果全是透明，返回透明
  if (count === 0 || (totalR === 0 && totalG === 0 && totalB === 0)) {
    const first = palette[palette.length - 2] || '#FFFFFF';
    const rgb = hexToRgb(first);
    return { ...rgb, hex: first, alpha: 0 };
  }

  // 计算实际非透明像素数
  let actualCount = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] >= 128) actualCount++;
  }

  const avgR = Math.round(totalR / actualCount);
  const avgG = Math.round(totalG / actualCount);
  const avgB = Math.round(totalB / actualCount);

  const hex = quantizeColor(avgR, avgG, avgB, palette);
  const rgb = hexToRgb(hex);

  return { ...rgb, hex };
}

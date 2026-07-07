/**
 * Seedream 5.0 API 集成模块
 *
 * 通过火山方舟 Seedream 5.0 图生图 API，
 * 将用户上传的照片直接转化为像素风格图片。
 *
 * API 端点：https://ark.cn-beijing.volces.com/api/v3/images/generations
 * 模型：doubao-seedream-5-0-260128
 */

// ============================================================
//  API 配置常量
// ============================================================

const SEEDREAM_CONFIG = {
  /** API 端点 */
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
  /** 模型 ID / 接入点 */
  model: 'doubao-seedream-5-0-260128',
  /** 接入点名称（备用） */
  endpointId: 'ep-20260706154600-rz5gc',
  /** 默认 API Key */
  defaultApiKey: 'ark-8aa5632a-4957-40b9-bd33-6430b271d80a-49193',
  /** 提示词最大字数（中文） */
  maxPromptLength: 300,
  /** 默认输出尺寸 */
  defaultSize: '2K',
  /** 输出格式 */
  outputFormat: 'png',
  /** 响应格式：b64_json 避免 file:// 协议 CORS */
  responseFormat: 'b64_json',
  /** 不加水印 */
  watermark: false,
  /** 请求超时时间（毫秒） */
  timeout: 60000,
};

// ============================================================
//  API Key 管理（localStorage 持久化）
// ============================================================

/** localStorage 存储键 */
const SEEDREAM_KEY_STORAGE = (window.App && App.Config && App.Config.STORAGE_KEY) || 'pixel_princess_seedream_key';

/**
 * 获取已保存的 API Key
 * @returns {string}
 */
function getSeedreamApiKey() {
  return localStorage.getItem(SEEDREAM_KEY_STORAGE) || '';
}

/**
 * 保存 API Key 到浏览器本地存储
 * @param {string} key
 */
function saveSeedreamApiKey(key) {
  localStorage.setItem(SEEDREAM_KEY_STORAGE, key.trim());
}

/**
 * 检查是否已配置 API Key
 * @returns {boolean}
 */
function hasSeedreamApiKey() {
  return getSeedreamApiKey().length > 0;
}

/**
 * 初始化 API Key：预填默认 Key + 恢复已保存的 Key
 * 在页面加载时调用
 */
function initSeedreamApiKey() {
  // 如果还没有保存过 Key，自动填入预设的默认 Key
  if (!hasSeedreamApiKey()) {
    saveSeedreamApiKey(SEEDREAM_CONFIG.defaultApiKey);
  }
}

// ============================================================
//  图片压缩（减小 API 传输体积）
// ============================================================

/**
 * 将图片压缩到合理尺寸，转为 base64 JPEG
 * 最长边不超过 1024px，保持宽高比
 *
 * @param {HTMLImageElement|HTMLCanvasElement} source - 源图片
 * @returns {string} data:image/jpeg;base64,... 格式的压缩图片
 */
function compressImageForAPI(source) {
  const MAX_DIM = 1024;
  let w = source.width;
  let h = source.height;

  // 如果图片已经够小，直接导出
  if (w <= MAX_DIM && h <= MAX_DIM) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  // 等比缩小
  const scale = MAX_DIM / Math.max(w, h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 使用高质量缩放（反正 AI 会重绘，保持输入质量更重要）
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', 0.85);
}

// ============================================================
//  核心 API 调用
// ============================================================

/**
 * 构建 API 请求体
 *
 * @param {string} imageB64 - 图片的 data URL（data:image/jpeg;base64,...）
 * @param {string} prompt - 用户提示词
 * @param {object} options - 可选参数
 * @param {string} options.size - 输出尺寸 '1K' | '2K' | '3K' | '4K'
 * @returns {string} JSON 请求体
 */
function buildRequestBody(imageB64, prompt, options = {}) {
  return JSON.stringify({
    model: SEEDREAM_CONFIG.model,
    prompt: prompt.slice(0, SEEDREAM_CONFIG.maxPromptLength),
    image: imageB64,
    size: options.size || SEEDREAM_CONFIG.defaultSize,
    output_format: SEEDREAM_CONFIG.outputFormat,
    response_format: SEEDREAM_CONFIG.responseFormat,
    watermark: SEEDREAM_CONFIG.watermark,
  });
}

/**
 * 解析 API 响应，提取生成的图片
 *
 * @param {Response} response - fetch 返回的 Response 对象
 * @returns {Promise<{image: HTMLImageElement, dataUrl: string}>}
 */
async function parseSeedreamResponse(response) {
  // 1. 检查 HTTP 状态码
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let errMsg;
    try {
      const errJson = JSON.parse(errBody);
      errMsg = errJson.error?.message || `HTTP ${response.status}`;
    } catch {
      errMsg = `HTTP ${response.status}: ${errBody.slice(0, 200)}`;
    }

    // 常见错误码 → 中文提示
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key 无效或无权访问，请在步骤①重新设置');
    }
    if (response.status === 429) {
      throw new Error('请求太频繁，请等待 10 秒后重试');
    }
    if (response.status >= 500) {
      throw new Error('服务器错误，请稍后重试');
    }
    throw new Error('API 请求失败：' + errMsg);
  }

  // 2. 解析 JSON
  const result = await response.json();

  // 3. 检查返回数据
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    console.error('[Seedream] 响应中没有图片数据：', JSON.stringify(result).slice(0, 300));
    throw new Error('AI 没有返回图片，请调整提示词后重试');
  }

  // 4. 提取 base64 图片数据
  const imageData = result.data[0];
  let b64Data;

  if (imageData.b64_json) {
    // b64_json 格式：直接使用
    b64Data = imageData.b64_json;
  } else if (imageData.url) {
    // url 格式：需要额外处理 CORS，这里不应该发生（我们请求了 b64_json）
    console.warn('[Seedream] 返回了 URL 而非 b64_json，尝试使用 URL');
    throw new Error('API 返回了图片链接而非图片数据，这可能是 API 配置问题');
  } else {
    console.error('[Seedream] 未知响应格式：', JSON.stringify(imageData).slice(0, 200));
    throw new Error('返回的图片数据格式未知，请重试');
  }

  if (!b64Data || b64Data.length < 100) {
    throw new Error('返回的图片数据为空，请重试');
  }

  // 5. 构建 data URL → 创建 Image 对象
  // b64_json 可能是纯 base64 也可能是完整的 data URL
  let dataUrl;
  if (b64Data.startsWith('data:')) {
    dataUrl = b64Data;
  } else {
    dataUrl = 'data:image/png;base64,' + b64Data;
  }

  // 6. 加载为 HTMLImageElement
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ image: img, dataUrl: dataUrl });
    img.onerror = () => reject(new Error('生成的图片加载失败，请重试'));
    img.src = dataUrl;
  });
}

// ============================================================
//  主导出函数：照片 → Seedream → 像素图
// ============================================================

/**
 * 调用 Seedream 5.0 图生图 API，将照片转化为像素风格图片
 *
 * @param {HTMLImageElement} image - 用户上传的照片
 * @param {string} prompt - 生成提示词（中文，≤300字）
 * @param {object} options - 可选参数
 * @param {string} options.size - 输出尺寸，默认 '1K'
 * @param {function} onProgress - 进度回调 (status: string) => void
 * @returns {Promise<{image: HTMLImageElement, dataUrl: string}>}
 */
async function generatePixelArt(image, prompt, options = {}, onProgress) {
  // 0. 检查 API Key
  const apiKey = getSeedreamApiKey();
  if (!apiKey) {
    throw new Error('请先在步骤①设置 Seedream API Key');
  }

  // 1. 压缩图片（减小传输体积，加快 API 响应）
  onProgress?.('正在压缩图片...');
  const imageB64 = compressImageForAPI(image);
  console.log('[Seedream] 压缩后图片大小：', Math.round(imageB64.length / 1024), 'KB');

  // 2. 构建请求
  onProgress?.('正在发送请求到 Seedream 5.0...');
  const body = buildRequestBody(imageB64, prompt, options);
  console.log('[Seedream] 提示词长度：', prompt.length, '字');

  // 3. 发起请求（带超时控制）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEEDREAM_CONFIG.timeout);

  let response;
  try {
    response = await fetch(SEEDREAM_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: body,
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') {
      throw new Error('请求超时（60秒），请检查网络后重试');
    }
    console.error('[Seedream] 网络错误：', fetchErr);
    throw new Error('网络连接失败，请检查网络：' + fetchErr.message);
  }
  clearTimeout(timeoutId);

  console.log('[Seedream] 响应状态：', response.status);

  // 4. 解析响应
  onProgress?.('正在接收 AI 生成的像素图...');
  const result = await parseSeedreamResponse(response);

  console.log('[Seedream] 生成完成！图片尺寸：', result.image.width, 'x', result.image.height);
  onProgress?.(null);

  return result;
}

// 显式挂载到 window（const 在全局作用域不会自动成为 window 属性）
window.SEEDREAM_CONFIG = SEEDREAM_CONFIG;
window.getSeedreamApiKey = getSeedreamApiKey;
window.saveSeedreamApiKey = saveSeedreamApiKey;
window.hasSeedreamApiKey = hasSeedreamApiKey;
window.initSeedreamApiKey = initSeedreamApiKey;
window.compressImageForAPI = compressImageForAPI;
window.generatePixelArt = generatePixelArt;

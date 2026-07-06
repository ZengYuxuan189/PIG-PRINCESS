/**
 * PIG PRINCESS — 主流程控制器 v6
 *
 * 流程（Seedream 5.0 图生图 + 配件装饰）：
 * ① 上传照片 + 设置 Seedream API Key
 * ② 选择提示词模板 + 编辑提示词
 * ③ AI 生成像素图（Seedream 5.0）
 * ④ 配件装饰 — 自由拖放像素配件 + 下载成品
 */

// ============================================================
//  全局状态
// ============================================================
const AppState = {
  currentStep: 1,
  totalSteps: 4,

  // 步骤①：上传
  image: null,

  // 步骤②：提示词
  selectedTemplate: 'classic-nes',
  customPrompt: '',
  activePrompt: '',

  // 步骤③：AI 生成
  generatedImage: null,
  generatedDataUrl: null,
  outputSize: '2K',

  // 步骤④：配件
  /** 当前选中的配件分类 */
  accCategory: 'nes-classic',
  /** 当前选中的已放置配件索引（-1=无） */
  accSelectedIndex: -1,
  /** 是否正在拖动配件 */
  accDragging: false,
  /** 拖动偏移 */
  _accDragOX: 0,
  _accDragOY: 0,
};

// ============================================================
//  DOM 缓存
// ============================================================
const DOM = {
  panels: {
    1: document.getElementById('panel-step1'),
    2: document.getElementById('panel-step2'),
    3: document.getElementById('panel-step3'),
    4: document.getElementById('panel-step4'),
  },
  stepBtns: document.querySelectorAll('.step-indicator .step'),
  progressDots: document.querySelectorAll('.progress-dot'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),

  // 步骤①
  uploadZone: document.getElementById('uploadZone'),
  fileInput: document.getElementById('fileInput'),
  selectBtn: document.getElementById('selectFileBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),

  // 步骤②
  promptTemplateGrid: document.getElementById('promptTemplateGrid'),
  promptTextarea: document.getElementById('promptTextarea'),
  charCounter: document.getElementById('charCounter'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
  confirmPromptBtn: document.getElementById('confirmPromptBtn'),

  // 步骤③
  pixelCanvas: document.getElementById('pixelCanvas'),
  pixelPlaceholder: document.getElementById('pixelPlaceholder'),
  pixelStatus: document.getElementById('pixelStatus'),
  generateBtn: document.getElementById('generateBtn'),
  backToPromptBtn: document.getElementById('backToPromptBtn'),
  downloadPngBtn: document.getElementById('downloadPngBtn'),

  // 步骤④
  accCanvas: document.getElementById('accCanvas'),
  accPlaceholder: document.getElementById('accPlaceholder'),
  accCategories: document.getElementById('accCategories'),
  accGrid: document.getElementById('accGrid'),
  accScaleSlider: document.getElementById('accScaleSlider'),
  accScaleVal: document.getElementById('accScaleVal'),
  removeAccBtn: document.getElementById('removeAccBtn'),
  clearAccBtn: document.getElementById('clearAccBtn'),
  downloadAccBtn: document.getElementById('downloadAccBtn'),
};

// ============================================================
//  步骤导航
// ============================================================
const StepManager = {
  goToStep(stepNum) {
    if (stepNum < 1 || stepNum > AppState.totalSteps) return;
    if (stepNum === AppState.currentStep) return;

    for (let s = AppState.currentStep + 1; s <= stepNum; s++) {
      if (!this._canEnter(s)) { this._flashBlocked(s); return; }
    }

    const oldStep = AppState.currentStep;
    AppState.currentStep = stepNum;

    this._switchPanel(oldStep, stepNum);
    this._updateIndicator(stepNum);
    this._updateNavButtons();
    this._updateProgressDots();
    this._onEnter(stepNum);
  },

  nextStep() {
    if (AppState.currentStep < AppState.totalSteps) {
      this.goToStep(AppState.currentStep + 1);
    }
  },

  prevStep() {
    if (AppState.currentStep > 1) {
      this.goToStep(AppState.currentStep - 1);
    }
  },

  _canEnter(step) {
    if (step === 2 && !AppState.image) return false;
    if (step === 3 && !AppState.activePrompt) return false;
    if (step === 4 && !AppState.generatedImage) return false;
    return true;
  },

  _flashBlocked(step) {
    let el;
    if (step === 2) el = DOM.uploadZone;
    if (step === 3) el = DOM.confirmPromptBtn;
    if (step === 4) el = DOM.generateBtn;
    if (!el) return;
    el.style.outline = '6px solid var(--accent-red)';
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 600);
  },

  _onEnter(step) {
    if (step === 2) initPromptEditor();
    if (step === 3) {
      if (AppState.generatedImage) displayPixelPreview(AppState.generatedImage);
      else showPixelPlaceholder('确认提示词后点击生成');
    }
    if (step === 4) {
      if (AppState.generatedImage) initAccessoryStep();
      else showAccPlaceholder();
    }
  },

  _switchPanel(from, to) {
    const p1 = DOM.panels[from], p2 = DOM.panels[to];
    if (p1) p1.classList.remove('active');
    if (p2) p2.classList.add('active');
  },

  _updateIndicator(activeStep) {
    DOM.stepBtns.forEach(btn => {
      const s = parseInt(btn.dataset.step, 10);
      btn.classList.toggle('active', s === activeStep);
      if (s === activeStep) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
  },

  _updateNavButtons() {
    const s = AppState.currentStep;
    DOM.prevBtn.disabled = (s === 1);
    DOM.nextBtn.disabled = (s === AppState.totalSteps);
    DOM.nextBtn.textContent = s === AppState.totalSteps ? '已完成 ✓' : '下一步 ▶';
  },

  _updateProgressDots() {
    DOM.progressDots.forEach(dot => {
      const s = parseInt(dot.dataset.dot, 10);
      dot.classList.remove('active', 'completed');
      if (s === AppState.currentStep) dot.classList.add('active');
      else if (s < AppState.currentStep) dot.classList.add('completed');
    });
  },
};

// ============================================================
//  API Key 管理
// ============================================================

function initApiKeyUI() {
  initSeedreamApiKey();
  const saved = getSeedreamApiKey();
  if (saved && DOM.apiKeyInput) DOM.apiKeyInput.value = saved;

  DOM.saveKeyBtn?.addEventListener('click', () => {
    const key = DOM.apiKeyInput.value.trim();
    if (!key) { alert('请输入 API Key'); return; }
    saveSeedreamApiKey(key);
    DOM.apiKeyInput.value = key;
    DOM.saveKeyBtn.textContent = '✅ 已保存';
    DOM.saveKeyBtn.style.background = 'var(--accent-green)';
    setTimeout(() => {
      DOM.saveKeyBtn.textContent = '💾 保存';
      DOM.saveKeyBtn.style.background = '';
    }, 1500);
  });
}

// ============================================================
//  图片加载
// ============================================================

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件（JPG / PNG / GIF / WebP）'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

// ============================================================
//  上传处理
// ============================================================

async function onFileUploaded(file) {
  const img = await loadImageFromFile(file);
  AppState.image = img;
  StepManager.goToStep(2);
}

// ============================================================
//  步骤②：提示词配置
// ============================================================

function initPromptTemplates() {
  const grid = DOM.promptTemplateGrid;
  if (!grid) return;
  grid.innerHTML = '';

  PROMPT_TEMPLATES.forEach(template => {
    const card = document.createElement('button');
    card.className = 'prompt-card';
    card.type = 'button';
    card.dataset.templateId = template.id;
    card.innerHTML = `
      <span class="prompt-card-icon">${template.icon}</span>
      <span class="prompt-card-info">
        <span class="prompt-card-name">${template.name}</span>
        <span class="prompt-card-desc">${template.description}</span>
      </span>
    `;
    card.addEventListener('click', () => selectPromptTemplate(template.id));
    grid.appendChild(card);
  });
  selectPromptTemplate(AppState.selectedTemplate, true);
}

function selectPromptTemplate(templateId, isInit = false) {
  AppState.selectedTemplate = templateId;
  DOM.promptTemplateGrid?.querySelectorAll('.prompt-card').forEach(card => {
    card.classList.toggle('active', card.dataset.templateId === templateId);
  });

  const template = findTemplate(templateId);
  if (!template) return;
  AppState.customPrompt = template.prompt;
  DOM.promptTextarea.value = template.prompt;
  updateCharCounter();

  if (!isInit) {
    DOM.promptTextarea.style.borderColor = 'var(--accent-gold)';
    setTimeout(() => { DOM.promptTextarea.style.borderColor = ''; }, 400);
  }
  AppState.activePrompt = '';
}

function initPromptEditor() {
  if (!DOM.promptTemplateGrid?.children.length) initPromptTemplates();
  if (!AppState.activePrompt) {
    const template = findTemplate(AppState.selectedTemplate);
    if (template) DOM.promptTextarea.value = AppState.customPrompt || template.prompt;
    updateCharCounter();
  }
}

function updateCharCounter() {
  const text = DOM.promptTextarea.value;
  const count = countPromptChars(text);
  DOM.charCounter.textContent = count + ' / 300 字';
  DOM.charCounter.classList.toggle('warn', count > 280);
}

function onConfirmPrompt() {
  const text = DOM.promptTextarea.value.trim();
  if (!text) { alert('提示词不能为空'); return; }
  if (isPromptTooLong(text)) { alert('提示词超过 300 字上限，请精简'); return; }
  AppState.customPrompt = text;
  AppState.activePrompt = text;
  AppState.generatedImage = null;
  AppState.generatedDataUrl = null;
  AccessoryManager.clear();
  StepManager.goToStep(3);
}

function onResetPrompt() {
  const template = findTemplate(AppState.selectedTemplate);
  if (template) {
    AppState.customPrompt = template.prompt;
    DOM.promptTextarea.value = template.prompt;
    updateCharCounter();
  }
}

// ============================================================
//  步骤③：AI 生成像素图
// ============================================================

function showPixelPlaceholder(msg) {
  if (DOM.pixelPlaceholder) DOM.pixelPlaceholder.style.display = '';
  if (DOM.pixelStatus) DOM.pixelStatus.textContent = msg;
  DOM.pixelCanvas.style.display = 'none';
  DOM.downloadPngBtn.disabled = true;
}

function showPixelLoading(msg) {
  if (DOM.pixelPlaceholder) DOM.pixelPlaceholder.style.display = '';
  if (DOM.pixelStatus) DOM.pixelStatus.textContent = '⏳ ' + msg;
  DOM.pixelCanvas.style.display = 'none';
  DOM.downloadPngBtn.disabled = true;
}

function displayPixelPreview(img) {
  if (DOM.pixelPlaceholder) DOM.pixelPlaceholder.style.display = 'none';
  DOM.pixelCanvas.style.display = 'block';
  DOM.downloadPngBtn.disabled = false;

  const canvas = DOM.pixelCanvas;
  const stage = canvas.parentElement;
  const maxW = (stage ? stage.clientWidth : 500) - 20;
  const maxH = Math.min(600, window.innerHeight * 0.5);
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

async function onGeneratePixelArt() {
  if (!hasSeedreamApiKey()) { alert('请先在步骤①设置 Seedream API Key'); StepManager.goToStep(1); return; }
  if (!AppState.activePrompt) { alert('请先在步骤②确认提示词'); StepManager.goToStep(2); return; }
  if (!AppState.image) { alert('请先上传照片'); StepManager.goToStep(1); return; }

  DOM.generateBtn.disabled = true;
  DOM.generateBtn.textContent = '⏳ 生成中...';

  try {
    const result = await generatePixelArt(
      AppState.image,
      AppState.activePrompt,
      { size: AppState.outputSize },
      (status) => { if (status) showPixelLoading(status); }
    );
    AppState.generatedImage = result.image;
    AppState.generatedDataUrl = result.dataUrl;
    displayPixelPreview(result.image);
    AccessoryManager.clear();
  } catch (err) {
    console.error('[App] 生成失败：', err);
    alert('❌ 生成失败：' + err.message);
    showPixelPlaceholder('生成失败，请重试');
  } finally {
    DOM.generateBtn.disabled = false;
    DOM.generateBtn.textContent = '🚀 生成像素图';
  }
}

function onDownloadPng() {
  if (!AppState.generatedDataUrl && !AppState.generatedImage) return;
  let dataUrl = AppState.generatedDataUrl;
  if (!dataUrl) {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = AppState.generatedImage.width;
    exportCanvas.height = AppState.generatedImage.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(AppState.generatedImage, 0, 0);
    dataUrl = exportCanvas.toDataURL('image/png');
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'pixel-sprite.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================
//  步骤④：配件装饰
// ============================================================

/** 绘制角色到配件预览画布 */
function renderAccPreview() {
  const canvas = DOM.accCanvas;
  const img = AppState.generatedImage;
  if (!img) return;

  const stage = canvas.parentElement;
  const maxW = (stage ? stage.clientWidth : 500) - 20;
  const maxH = Math.min(500, window.innerHeight * 0.45);
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 叠加配件（使用缩放后的画布）
  for (let i = 0; i < AccessoryManager.items.length; i++) {
    const item = AccessoryManager.items[i];
    const c = AccessoryManager.getScaledCanvas(i);
    if (!c) continue;
    ctx.drawImage(c, item.x, item.y);

    // 高亮选中配件
    if (i === AppState.accSelectedIndex) {
      ctx.strokeStyle = '#f8b800';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(item.x, item.y, c.width, c.height);
      ctx.setLineDash([]);
    }
  }
}

/** 初始化步骤④ */
function initAccessoryStep() {
  showAccCanvas();

  // 根据当前提示词模板自动切换配件分类
  const templateToCategory = {
    'classic-nes':    'nes-classic',
    'cute-chibi':     'cute',
    'fighting-game':  'fighting',
    'jrpg':           'fantasy',
    'exaggerated':    'funny',
    'retro-arcade':   'nes-classic',
    'gba-style':      'fantasy',
    'minecraft':      'universal',
    'anime-pixel':    'cute',
    'dark-gothic':    'fantasy',
    'cyberpunk':      'universal',
    'custom':         'all',
  };
  const matchCat = templateToCategory[AppState.selectedTemplate] || 'all';
  AppState.accCategory = matchCat;

  initAccCategories();
  initAccGrid();
  updateAccButtons();

  // 配件画布渲染
  const img = AppState.generatedImage;
  if (img) {
    const stage = DOM.accCanvas.parentElement;
    const maxW = (stage ? stage.clientWidth : 500) - 20;
    const maxH = Math.min(500, window.innerHeight * 0.45);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    DOM.accCanvas.width = Math.round(img.width * scale);
    DOM.accCanvas.height = Math.round(img.height * scale);
    renderAccPreview();
  }

  bindAccCanvasEvents();
}

function showAccPlaceholder() {
  if (DOM.accPlaceholder) DOM.accPlaceholder.style.display = '';
  DOM.accCanvas.style.display = 'none';
}

function showAccCanvas() {
  if (DOM.accPlaceholder) DOM.accPlaceholder.style.display = 'none';
  DOM.accCanvas.style.display = 'block';
}

/** 初始化分类标签 */
function initAccCategories() {
  const container = DOM.accCategories;
  if (!container) return;
  container.innerHTML = '';

  // "全部"标签
  const allBtn = document.createElement('button');
  allBtn.className = 'acc-cat-btn';
  allBtn.type = 'button';
  allBtn.dataset.catId = 'all';
  allBtn.textContent = '📋 全部';
  allBtn.title = '显示所有分类配件';
  allBtn.addEventListener('click', () => selectAccCategory('all'));
  container.appendChild(allBtn);

  ACCESSORY_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'acc-cat-btn';
    btn.type = 'button';
    btn.dataset.catId = cat.id;
    btn.textContent = cat.icon + ' ' + cat.name;
    btn.title = cat.desc;
    btn.addEventListener('click', () => selectAccCategory(cat.id));
    container.appendChild(btn);
  });

  highlightAccCategory(AppState.accCategory);
}

function highlightAccCategory(catId) {
  DOM.accCategories?.querySelectorAll('.acc-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.catId === catId);
  });
}

function selectAccCategory(catId) {
  AppState.accCategory = catId;
  highlightAccCategory(catId);
  initAccGrid();
}

/** 初始化配件网格 */
function initAccGrid() {
  const grid = DOM.accGrid;
  if (!grid) return;
  grid.innerHTML = '';

  const accessories = getAccessoriesByCategory(AppState.accCategory);

  accessories.forEach(acc => {
    const card = document.createElement('button');
    card.className = 'acc-card';
    card.type = 'button';
    card.title = acc.name;

    // 预渲染配件缩略图
    const thumb = renderAccessoryToCanvas(acc, 2, true);
    // 缩放到统一尺寸显示
    const thumbCanvas = document.createElement('canvas');
    const thumbSize = 44;
    thumbCanvas.width = thumbSize;
    thumbCanvas.height = thumbSize;
    const tctx = thumbCanvas.getContext('2d');
    tctx.imageSmoothingEnabled = false;
    const ts = Math.min(thumbSize / thumb.width, thumbSize / thumb.height);
    tctx.drawImage(thumb,
      Math.round((thumbSize - thumb.width * ts) / 2),
      Math.round((thumbSize - thumb.height * ts) / 2),
      Math.round(thumb.width * ts),
      Math.round(thumb.height * ts)
    );

    card.innerHTML = `
      <span class="acc-card-preview">
        <img src="${thumbCanvas.toDataURL()}" alt="${acc.name}" style="image-rendering:pixelated; width:${thumbSize}px; height:${thumbSize}px;">
      </span>
      <span class="acc-card-name">${acc.name}</span>
    `;
    card.addEventListener('click', () => onAddAccessory(acc));
    grid.appendChild(card);
  });
}

/** 添加配件到角色 */
function onAddAccessory(acc) {
  if (!AppState.generatedImage) return;

  const img = AppState.generatedImage;
  // 计算角色在配件画布上的显示尺寸
  const stage = DOM.accCanvas.parentElement;
  const maxW = (stage ? stage.clientWidth : 500) - 20;
  const maxH = Math.min(500, window.innerHeight * 0.45);
  const displayScale = Math.min(maxW / img.width, maxH / img.height, 1);
  const charW = Math.round(img.width * displayScale);
  const charH = Math.round(img.height * displayScale);

  const idx = AccessoryManager.add(acc, charW, charH);
  AppState.accSelectedIndex = idx;
  renderAccPreview();
  updateAccButtons();
}

/** 更新配件按钮状态 */
function updateAccButtons() {
  const hasSelection = AppState.accSelectedIndex >= 0;
  DOM.removeAccBtn.disabled = !hasSelection;
  DOM.accScaleSlider.disabled = !hasSelection;

  if (hasSelection) {
    const item = AccessoryManager.items[AppState.accSelectedIndex];
    DOM.accScaleSlider.value = item.scale;
    DOM.accScaleVal.textContent = item.scale.toFixed(1) + 'x';
  } else {
    DOM.accScaleSlider.value = 1.0;
    DOM.accScaleVal.textContent = '1.0x';
  }
}

/** 缩放变更 */
function onAccScaleChange() {
  const idx = AppState.accSelectedIndex;
  if (idx < 0) return;
  const newScale = parseFloat(DOM.accScaleSlider.value);
  AccessoryManager.setScale(idx, newScale);
  DOM.accScaleVal.textContent = newScale.toFixed(1) + 'x';
  renderAccPreview();
}

/** 绑定配件画布鼠标事件 */
function bindAccCanvasEvents() {
  const canvas = DOM.accCanvas;

  // 移除旧事件（避免重复绑定）
  canvas.onmousedown = null;
  canvas.onmousemove = null;
  canvas.onmouseup = null;
  canvas.onmouseleave = null;

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 先尝试命中已有配件
    const hitIdx = AccessoryManager.hitTest(mx, my);
    if (hitIdx >= 0) {
      AppState.accSelectedIndex = hitIdx;
      AppState.accDragging = true;
      const item = AccessoryManager.items[hitIdx];
      AppState._accDragOX = mx - item.x;
      AppState._accDragOY = my - item.y;
      canvas.style.cursor = 'grabbing';
    } else {
      AppState.accSelectedIndex = -1;
      AppState.accDragging = false;
    }
    renderAccPreview();
    updateAccButtons();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (AppState.accDragging) {
      const idx = AppState.accSelectedIndex;
      if (idx >= 0) {
        AccessoryManager.moveTo(idx,
          mx - AppState._accDragOX,
          my - AppState._accDragOY
        );
        renderAccPreview();
      }
    } else {
      // 鼠标悬停检测
      const hitIdx = AccessoryManager.hitTest(mx, my);
      canvas.style.cursor = hitIdx >= 0 ? 'grab' : 'default';
    }
  });

  canvas.addEventListener('mouseup', () => {
    AppState.accDragging = false;
    DOM.accCanvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    AppState.accDragging = false;
    DOM.accCanvas.style.cursor = 'default';
  });
}

/** 删除选中配件 */
function onRemoveAccessory() {
  if (AppState.accSelectedIndex >= 0) {
    AccessoryManager.remove(AppState.accSelectedIndex);
    AppState.accSelectedIndex = -1;
    renderAccPreview();
    updateAccButtons();
  }
}

/** 清除全部配件 */
function onClearAccessories() {
  AccessoryManager.clear();
  AppState.accSelectedIndex = -1;
  renderAccPreview();
  updateAccButtons();
}

/** 下载带配件的成品图片 */
function onDownloadWithAccessories() {
  if (!AppState.generatedImage) return;

  const img = AppState.generatedImage;
  const result = AccessoryManager.composite(img);
  // composite 需要 img 是 canvas 或可以 drawImage 的源
  // 先创建角色画布
  const charCanvas = document.createElement('canvas');
  charCanvas.width = img.width;
  charCanvas.height = img.height;
  const cctx = charCanvas.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(img, 0, 0);

  const finalCanvas = AccessoryManager.composite(charCanvas);
  const dataUrl = finalCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'pixel-character.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================
//  事件绑定
// ============================================================

function bindEvents() {
  DOM.stepBtns.forEach(btn => {
    btn.addEventListener('click', () => StepManager.goToStep(parseInt(btn.dataset.step, 10)));
  });
  DOM.prevBtn.addEventListener('click', () => StepManager.prevStep());
  DOM.nextBtn.addEventListener('click', () => StepManager.nextStep());

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); StepManager.nextStep(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); StepManager.prevStep(); }
  });

  // 步骤①
  bindUploadEvents();
  initApiKeyUI();

  // 步骤②
  initPromptTemplates();
  DOM.promptTextarea?.addEventListener('input', () => {
    AppState.customPrompt = DOM.promptTextarea.value;
    updateCharCounter();
  });
  DOM.confirmPromptBtn?.addEventListener('click', onConfirmPrompt);
  DOM.resetPromptBtn?.addEventListener('click', onResetPrompt);

  // 步骤③
  DOM.generateBtn?.addEventListener('click', onGeneratePixelArt);
  DOM.backToPromptBtn?.addEventListener('click', () => StepManager.goToStep(2));
  DOM.downloadPngBtn?.addEventListener('click', onDownloadPng);

  document.querySelectorAll('input[name="outputSize"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) AppState.outputSize = e.target.value;
    });
  });

  // 步骤④
  DOM.accScaleSlider?.addEventListener('input', onAccScaleChange);
  DOM.removeAccBtn?.addEventListener('click', onRemoveAccessory);
  DOM.clearAccBtn?.addEventListener('click', onClearAccessories);
  DOM.downloadAccBtn?.addEventListener('click', onDownloadWithAccessories);
}

// ============================================================
//  上传事件
// ============================================================

function bindUploadEvents() {
  DOM.selectBtn.addEventListener('click', (e) => { e.stopPropagation(); DOM.fileInput.click(); });
  DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());

  DOM.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await onFileUploaded(file); } catch (err) { alert('❌ ' + err.message); }
    DOM.fileInput.value = '';
  });

  DOM.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
    DOM.uploadZone.classList.add('drag-over');
  });
  DOM.uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault(); e.stopPropagation();
    DOM.uploadZone.classList.remove('drag-over');
  });
  DOM.uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation();
    DOM.uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try { await onFileUploaded(file); } catch (err) { alert('❌ ' + err.message); }
  });

  document.addEventListener('paste', async (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        try { await onFileUploaded(item.getAsFile()); } catch (err) { alert('❌ 粘贴失败'); }
        break;
      }
    }
  });
}

// ============================================================
//  窗口大小变化
// ============================================================

let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (AppState.currentStep === 3 && AppState.generatedImage) {
      displayPixelPreview(AppState.generatedImage);
    }
    if (AppState.currentStep === 4 && AppState.generatedImage) {
      renderAccPreview();
    }
  }, 200);
});

// ============================================================
//  初始化
// ============================================================

function init() {
  bindEvents();
  StepManager._updateIndicator(1);
  StepManager._updateNavButtons();
  StepManager._updateProgressDots();
  DOM.panels[1].classList.add('active');
}

document.addEventListener('DOMContentLoaded', init);

// 显式挂载到 window
window.AppState = AppState;
window.StepManager = StepManager;

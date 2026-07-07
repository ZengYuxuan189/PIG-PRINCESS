/**
 * 像素表情包工厂 — 手机版 UI 模块 v1
 *
 * 基于 ui.js 改造，核心差异：
 *   - 画布同时支持触摸事件（touchstart/touchmove/touchend）和鼠标事件
 *   - 新增撤销/重做界面按钮（替代键盘快捷键）
 *   - 新增选中配件后的操作工具栏
 *   - 悬浮预览改为长按触发
 *   - 移除 cursor 样式（手机无意义）
 *   - 阻止触摸时页面滚动
 */

(function () {
  const S = App.State;
  const E = App.Events;
  const C = App.Config;

  // ============================================================
  //  DOM 缓存
  // ============================================================
  const $ = {};
  function _cacheDOM() {
    // 导航
    $.panels = { 1: qs('#panel-step1'), 2: qs('#panel-step2'), 3: qs('#panel-step3'), 4: qs('#panel-step4') };
    $.stepBtns = qsa('.step-indicator .step');
    $.progressDots = qsa('.progress-dot');
    $.prevBtn = qs('#prevBtn');
    $.nextBtn = qs('#nextBtn');
    // 步骤①
    $.uploadZone = qs('#uploadZone');
    $.fileInput = qs('#fileInput');
    $.selectBtn = qs('#selectFileBtn');
    $.apiKeyInput = qs('#apiKeyInput');
    $.saveKeyBtn = qs('#saveKeyBtn');
    // 步骤②
    $.tplGrid = qs('#promptTemplateGrid');
    $.tplTextarea = qs('#promptTextarea');
    $.charCounter = qs('#charCounter');
    $.resetPromptBtn = qs('#resetPromptBtn');
    $.confirmPromptBtn = qs('#confirmPromptBtn');
    // 步骤③
    $.pixelCanvas = qs('#pixelCanvas');
    $.pixelPlaceholder = qs('#pixelPlaceholder');
    $.pixelStatus = qs('#pixelStatus');
    $.generateBtn = qs('#generateBtn');
    $.backPromptBtn = qs('#backToPromptBtn');
    $.downloadPngBtn = qs('#downloadPngBtn');
    // 步骤④
    $.accCanvas = qs('#accCanvas');
    $.accPlaceholder = qs('#accPlaceholder');
    $.accCategories = qs('#accCategories');
    $.accGrid = qs('#accGrid');
    $.accScaleSlider = qs('#accScaleSlider');
    $.accScaleVal = qs('#accScaleVal');
    $.accRotSlider = qs('#accRotSlider');
    $.accRotVal = qs('#accRotVal');
    $.removeAccBtn = qs('#removeAccBtn'); // 可能不存在（手机版用了新按钮）
    $.flipAccBtn = qs('#flipAccBtn');     // 可能不存在
    $.clearAccBtn = qs('#clearAccBtn');
    $.downloadAccBtn = qs('#downloadAccBtn');
    // 手机版新增
    $.mobileToolbar = qs('#mobileAccToolbar');
    $.undoBtn = qs('#undoAccBtn');
    $.redoBtn = qs('#redoAccBtn');
  }

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  // ============================================================
  //  步骤导航 UI（与桌面版相同）
  // ============================================================
  const Steps = {
    switchTo(stepNum) {
      const old = S.get('currentStep');
      if (stepNum === old) return;
      for (let s = old + 1; s <= stepNum; s++) {
        if (!this._canEnter(s)) { this._flashBlocked(s); return; }
      }
      S.set('currentStep', stepNum);
      this._switchPanel(old, stepNum);
      this._updateAll();
      this._onEnter(stepNum);
    },

    next() { if (S.get('currentStep') < C.TOTAL_STEPS) this.switchTo(S.get('currentStep') + 1); },
    prev() { if (S.get('currentStep') > 1) this.switchTo(S.get('currentStep') - 1); },

    _canEnter(step) {
      if (step === 2 && !S.get('image')) return false;
      if (step === 3 && !S.get('activePrompt')) return false;
      if (step === 4 && !S.get('generatedImage')) return false;
      return true;
    },

    _flashBlocked(step) {
      const map = { 2: $.uploadZone, 3: $.confirmPromptBtn, 4: $.generateBtn };
      const el = map[step];
      if (!el) return;
      el.style.outline = '5px solid var(--accent-red)';
      el.style.outlineOffset = '2px';
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 600);
    },

    _onEnter(step) {
      E.emit('step:entered', step);
      if (step === 2) Prompts.initEditor();
      if (step === 3) {
        const img = S.get('generatedImage');
        if (img) Generate.displayPreview(img);
        else Generate.showPlaceholder('确认提示词后点击生成');
      }
      if (step === 4) {
        if (S.get('generatedImage')) Accessories.init();
        else Accessories.showPlaceholder();
      }
    },

    _switchPanel(from, to) {
      const p1 = $.panels[from], p2 = $.panels[to];
      if (p1) p1.classList.remove('active');
      if (p2) p2.classList.add('active');
    },

    _updateAll() {
      const s = S.get('currentStep');
      $.stepBtns.forEach(b => {
        const n = parseInt(b.dataset.step, 10);
        b.classList.toggle('active', n === s);
        if (n === s) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      $.prevBtn.disabled = (s === 1);
      $.nextBtn.disabled = (s === C.TOTAL_STEPS);
      $.nextBtn.textContent = s === C.TOTAL_STEPS ? '已完成' : '下一步 ▶';
      $.progressDots.forEach(d => {
        const n = parseInt(d.dataset.dot, 10);
        d.classList.remove('active', 'completed');
        if (n === s) d.classList.add('active');
        else if (n < s) d.classList.add('completed');
      });
    },
  };

  // ============================================================
  //  步骤①：上传 + API Key（与桌面版相同）
  // ============================================================
  const Upload = {
    init() {
      initSeedreamApiKey();
      const saved = getSeedreamApiKey();
      if (saved && $.apiKeyInput) $.apiKeyInput.value = saved;

      $.saveKeyBtn.addEventListener('click', () => {
        const key = $.apiKeyInput.value.trim();
        if (!key) { alert('请输入 API Key'); return; }
        saveSeedreamApiKey(key);
        $.apiKeyInput.value = key;
        $.saveKeyBtn.textContent = '✅ 已保存';
        $.saveKeyBtn.style.background = 'var(--accent-green)';
        setTimeout(() => { $.saveKeyBtn.textContent = '💾 保存'; $.saveKeyBtn.style.background = ''; }, 1500);
      });

      $.selectBtn.addEventListener('click', (e) => { e.stopPropagation(); $.fileInput.click(); });
      $.uploadZone.addEventListener('click', () => $.fileInput.click());

      $.fileInput.addEventListener('change', async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { await this._load(f); } catch (err) { alert('❌ ' + err.message); }
        $.fileInput.value = '';
      });

      // 拖拽（手机上也支持）
      $.uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); $.uploadZone.classList.add('drag-over'); });
      $.uploadZone.addEventListener('dragleave', () => { $.uploadZone.classList.remove('drag-over'); });
      $.uploadZone.addEventListener('drop', async (e) => {
        e.preventDefault(); $.uploadZone.classList.remove('drag-over');
        const f = e.dataTransfer?.files?.[0]; if (!f) return;
        try { await this._load(f); } catch (err) { alert('❌ ' + err.message); }
      });

      // 粘贴
      document.addEventListener('paste', async (e) => {
        if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
        const items = e.clipboardData?.items; if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            try { await this._load(item.getAsFile()); } catch (err) { alert('❌ 粘贴失败'); }
            break;
          }
        }
      });
    },

    async _load(file) {
      if (!file.type.startsWith('image/')) throw new Error('请选择图片文件（JPG/PNG/GIF/WebP）');
      const img = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('加载失败')); i.src = e.target.result; };
        reader.onerror = () => reject(new Error('读取失败'));
        reader.readAsDataURL(file);
      });
      S.set('image', img);
      Steps.switchTo(2);
    },
  };

  // ============================================================
  //  步骤②：提示词配置（与桌面版相同）
  // ============================================================
  const Prompts = {
    initTemplates() {
      if (!$.tplGrid) return;
      $.tplGrid.innerHTML = '';
      PROMPT_TEMPLATES.forEach(t => {
        const card = document.createElement('button');
        card.className = 'prompt-card'; card.type = 'button'; card.dataset.tplId = t.id;
        card.innerHTML = `<span class="prompt-card-icon">${t.icon}</span><span class="prompt-card-info"><span class="prompt-card-name">${t.name}</span><span class="prompt-card-desc">${t.description}</span></span>`;
        card.addEventListener('click', () => this.select(t.id));
        $.tplGrid.appendChild(card);
      });
      this.select(S.get('selectedTemplate'), true);
    },

    select(id, isInit) {
      S.set('selectedTemplate', id);
      $.tplGrid?.querySelectorAll('.prompt-card').forEach(c => c.classList.toggle('active', c.dataset.tplId === id));
      const tpl = findTemplate(id);
      if (!tpl) return;
      S.set('customPrompt', tpl.prompt);
      $.tplTextarea.value = tpl.prompt;
      this._updateCounter();
      if (!isInit) {
        $.tplTextarea.style.borderColor = 'var(--accent-gold)';
        setTimeout(() => { $.tplTextarea.style.borderColor = ''; }, 400);
      }
      S.set('activePrompt', '');
    },

    initEditor() {
      if (!$.tplGrid?.children.length) this.initTemplates();
      if (!S.get('activePrompt')) {
        const tpl = findTemplate(S.get('selectedTemplate'));
        if (tpl) $.tplTextarea.value = S.get('customPrompt') || tpl.prompt;
        this._updateCounter();
      }
    },

    _updateCounter() {
      const cnt = countPromptChars($.tplTextarea.value);
      $.charCounter.textContent = cnt + ' / 300 字';
      $.charCounter.classList.toggle('warn', cnt > 280);
    },

    confirm() {
      const text = $.tplTextarea.value.trim();
      if (!text) { alert('提示词不能为空'); return; }
      if (isPromptTooLong(text)) { alert('提示词超过300字上限'); return; }
      S.set({ customPrompt: text, activePrompt: text });
      S.resetGeneration();
      if (window.AccessoryManager) AccessoryManager.clear();
      Steps.switchTo(3);
    },

    reset() {
      const tpl = findTemplate(S.get('selectedTemplate'));
      if (tpl) { S.set('customPrompt', tpl.prompt); $.tplTextarea.value = tpl.prompt; this._updateCounter(); }
    },
  };

  // ============================================================
  //  步骤③：AI 生成（与桌面版相同）
  // ============================================================
  const Generate = {
    showPlaceholder(msg) {
      if ($.pixelPlaceholder) { $.pixelPlaceholder.style.display = ''; $.pixelStatus.textContent = msg; }
      $.pixelCanvas.style.display = 'none';
      $.downloadPngBtn.disabled = true;
    },

    showLoading(msg) {
      if ($.pixelPlaceholder) { $.pixelPlaceholder.style.display = ''; $.pixelStatus.textContent = '⏳ ' + msg; }
      $.pixelCanvas.style.display = 'none';
      $.downloadPngBtn.disabled = true;
    },

    displayPreview(img) {
      if ($.pixelPlaceholder) $.pixelPlaceholder.style.display = 'none';
      $.pixelCanvas.style.display = 'block';
      $.downloadPngBtn.disabled = false;
      const stage = $.pixelCanvas.parentElement;
      const maxW = Math.max(200, (stage ? stage.clientWidth : 400) - 20);
      const maxH = Math.min(500, window.innerHeight * 0.4);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      $.pixelCanvas.width = Math.max(1, Math.round(img.width * scale));
      $.pixelCanvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = $.pixelCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, $.pixelCanvas.width, $.pixelCanvas.height);
      ctx.drawImage(img, 0, 0, $.pixelCanvas.width, $.pixelCanvas.height);
    },
  };

  // ============================================================
  //  步骤④：配件系统（手机版核心改造）
  // ============================================================
  const Accessories = {
    _accEventsBound: false,
    _undoStack: [], _redoStack: [], _maxUndo: 50,
    // 用于触摸/鼠标拖拽的引用
    _dragStartX: 0, _dragStartY: 0,
    _activeTouchId: null, // 跟踪当前触摸点

    _pushCmd(undoFn, redoFn) {
      this._undoStack.push({ undo: undoFn, redo: redoFn });
      if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
      this._redoStack = [];
      this._updateUndoButtons();
    },

    undo() {
      if (this._undoStack.length === 0) return;
      const cmd = this._undoStack.pop();
      cmd.undo();
      this._redoStack.push(cmd);
      this.renderPreview();
      this._updateButtons();
    },

    redo() {
      if (this._redoStack.length === 0) return;
      const cmd = this._redoStack.pop();
      cmd.redo();
      this._undoStack.push(cmd);
      this.renderPreview();
      this._updateButtons();
    },

    _updateUndoButtons() {
      if ($.undoBtn) $.undoBtn.disabled = (this._undoStack.length === 0);
      if ($.redoBtn) $.redoBtn.disabled = (this._redoStack.length === 0);
    },

    init() {
      if (!S.get('generatedImage')) { this.showPlaceholder(); return; }
      const img = S.get('generatedImage');
      const stage = $.accCanvas.parentElement;
      const maxW = Math.max(200, (stage ? stage.clientWidth : 400) - 10);
      const maxH = Math.min(500, window.innerHeight * 0.45);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      $.accCanvas.width = Math.max(1, Math.round(img.width * scale));
      $.accCanvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = $.accCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, $.accCanvas.width, $.accCanvas.height);
      S.set('generatedDataUrl', $.accCanvas.toDataURL('image/png'));
      if ($.accPlaceholder) $.accPlaceholder.style.display = 'none';
      $.accCanvas.style.display = 'block';

      this._undoStack = []; this._redoStack = [];
      this._updateUndoButtons();

      if (!this._accEventsBound) { this._bindCanvas(); this._accEventsBound = true; }
      this.initGrid();
      this.renderPreview();
      this._updateButtons();

      // 自动匹配分类
      const tplId = S.get('selectedTemplate');
      if (tplId) this._autoCategory(tplId);
    },

    showPlaceholder() {
      if ($.accPlaceholder) { $.accPlaceholder.style.display = ''; $.accPlaceholder.querySelector('p').textContent = '请先生成像素图'; }
      $.accCanvas.style.display = 'none';
    },

    _autoCategory(tplId) {
      const map = {
        'classic-nes': 'nes-classic', 'retro-arcade': 'nes-classic',
        'cute-chibi': 'cute', 'anime-pixel': 'cute',
        'fighting-game': 'fighting', 'jrpg': 'fantasy',
        'exaggerated': 'funny', 'minecraft': 'funny',
        'dark-gothic': 'fantasy', 'cyberpunk': 'fantasy',
        'gba-style': 'cute'
      };
      const cat = map[tplId] || 'universal';
      S.set('accCategory', cat);
      // 更新分类按钮
      const btns = $.accCategories?.querySelectorAll('.acc-cat-btn');
      if (btns) btns.forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    },

    // ========== 配件网格 ==========
    initGrid() {
      if (!$.accCategories || !$.accGrid) return;
      // 分类标签
      if (!$.accCategories.children.length) {
        ACCESSORY_CATEGORIES.forEach(cat => {
          const btn = document.createElement('button');
          btn.className = 'acc-cat-btn'; btn.type = 'button'; btn.dataset.cat = cat.id;
          btn.textContent = cat.icon + ' ' + cat.name;
          btn.addEventListener('click', () => {
            S.set('accCategory', cat.id);
            $.accCategories.querySelectorAll('.acc-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat.id));
            this.initGrid();
          });
          $.accCategories.appendChild(btn);
        });
      }
      const activeCat = S.get('accCategory') || 'universal';
      $.accCategories.querySelectorAll('.acc-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeCat));

      // 配件卡片
      $.accGrid.innerHTML = '';
      const filtered = ACCESSORIES.filter(a => a.cat === activeCat);
      filtered.forEach(acc => {
        const card = document.createElement('button');
        card.className = 'acc-card'; card.type = 'button'; card.dataset.accId = acc.id;
        // 缩略图画布
        const thumb = renderAccessoryToCanvas(acc, 2, false); // 2x 像素缩放
        const img = document.createElement('img');
        img.src = thumb.toDataURL(); img.alt = acc.name;
        img.style.cssText = 'width:36px;height:36px;image-rendering:pixelated;';
        card.innerHTML = `<span class="acc-card-preview"></span><span class="acc-card-name">${acc.name}</span>`;
        card.querySelector('.acc-card-preview').appendChild(img);

        // 点击添加配件（手机版：点击即添加）
        card.addEventListener('click', (e) => {
          e.preventDefault();
          this._add(acc);
        });

        // 长按预览（≥500ms）
        let longPressTimer;
        card.addEventListener('touchstart', (e) => {
          longPressTimer = setTimeout(() => {
            this._showHover(acc, e.touches[0]);
          }, 500);
        }, { passive: true });
        card.addEventListener('touchend', () => clearTimeout(longPressTimer));
        card.addEventListener('touchmove', () => clearTimeout(longPressTimer));
        // 鼠标版悬浮预览（桌面调试用）
        card.addEventListener('mouseenter', (e) => this._showHover(acc, e));
        card.addEventListener('mousemove', (e) => this._moveHover(e));
        card.addEventListener('mouseleave', () => this._hideHover());

        $.accGrid.appendChild(card);
      });
    },

    // ========== 悬浮预览 ==========
    _showHover(acc, e) {
      const preview = qs('#accHoverPreview');
      const canvas = qs('#accHoverCanvas');
      if (!preview || !canvas) return;
      const rendered = renderAccessoryToCanvas(acc, 4, false);
      const size = Math.min(rendered.width, rendered.height, 120);
      canvas.width = rendered.width; canvas.height = rendered.height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rendered, 0, 0);
      preview.style.display = '';
      this._moveHover(e);
    },

    _moveHover(e) {
      const preview = qs('#accHoverPreview');
      if (!preview || preview.style.display === 'none') return;
      const px = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0);
      const py = (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0);
      // 手机版：固定在底部中央
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        preview.style.left = '50%';
        preview.style.bottom = '80px';
        preview.style.top = 'auto';
        preview.style.transform = 'translateX(-50%)';
      } else {
        preview.style.left = (px + 18) + 'px';
        preview.style.top = (py - 20) + 'px';
        preview.style.bottom = 'auto';
        preview.style.transform = 'none';
      }
    },

    _hideHover() {
      const preview = qs('#accHoverPreview');
      if (preview) preview.style.display = 'none';
    },

    // ========== 配件操作 ==========
    _add(acc) {
      const w = $.accCanvas.width || 400;
      const h = $.accCanvas.height || 400;
      const idx = AccessoryManager.add(acc, w, h);
      this._pushCmd(
        () => { AccessoryManager.remove(idx); },
        () => {
          const ni = AccessoryManager.add(acc, w, h);
          AccessoryManager.moveTo(ni, AccessoryManager.items[AccessoryManager.items.length - 1]?.x || w / 2, AccessoryManager.items[AccessoryManager.items.length - 1]?.y || 20);
        }
      );
      S.set('accSelectedIndex', idx);
      this.renderPreview();
      this._updateButtons();
    },

    renderPreview() {
      const canvas = $.accCanvas;
      const img = S.get('generatedImage');
      if (!img || !canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 绘制所有配件
      for (let i = 0; i < AccessoryManager.items.length; i++) {
        const c = AccessoryManager.getScaledCanvas(i);
        if (!c) continue;
        const item = AccessoryManager.items[i];
        ctx.drawImage(c, item.x, item.y);
        // 选中高亮
        if (i === S.get('accSelectedIndex')) {
          ctx.save();
          ctx.strokeStyle = '#f8b800';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(item.x, item.y, c.width, c.height);
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    },

    _updateButtons() {
      const sel = S.get('accSelectedIndex');
      const hasSel = sel >= 0 && sel < AccessoryManager.items.length;
      const item = hasSel ? AccessoryManager.items[sel] : null;

      // 缩放/旋转滑块
      $.accScaleSlider.disabled = !hasSel;
      $.accRotSlider.disabled = !hasSel;
      if (hasSel && item) {
        $.accScaleSlider.value = item.scale;
        $.accScaleVal.textContent = item.scale.toFixed(1) + 'x';
        const rot = item.rotation || 0;
        $.accRotSlider.value = rot;
        $.accRotVal.textContent = rot + '°';
      } else {
        $.accScaleSlider.value = 1.0;
        $.accScaleVal.textContent = '1.0x';
        $.accRotSlider.value = 0;
        $.accRotVal.textContent = '0°';
      }

      // 手机版工具栏
      if ($.mobileToolbar) {
        $.mobileToolbar.classList.toggle('visible', hasSel);
      }

      this._updateUndoButtons();
    },

    onScaleChange() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const newScale = parseFloat($.accScaleSlider.value);
      const oldScale = AccessoryManager.items[idx].scale;
      if (Math.abs(oldScale - newScale) < 0.01) return;
      AccessoryManager.setScale(idx, newScale);
      $.accScaleVal.textContent = newScale.toFixed(1) + 'x';
      this.renderPreview();
      if (Math.abs(oldScale - newScale) >= 0.01) {
        this._pushCmd(
          () => { AccessoryManager.setScale(idx, oldScale); $.accScaleSlider.value = oldScale; $.accScaleVal.textContent = oldScale.toFixed(1) + 'x'; },
          () => { AccessoryManager.setScale(idx, newScale); $.accScaleSlider.value = newScale; $.accScaleVal.textContent = newScale.toFixed(1) + 'x'; }
        );
      }
    },

    onRotChange() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const newRot = parseInt($.accRotSlider.value);
      const oldRot = AccessoryManager.items[idx].rotation || 0;
      AccessoryManager.setRotation(idx, newRot);
      $.accRotVal.textContent = newRot + '°';
      this.renderPreview();
      if (oldRot !== newRot) {
        this._pushCmd(
          () => { AccessoryManager.setRotation(idx, oldRot); $.accRotSlider.value = oldRot; $.accRotVal.textContent = oldRot + '°'; },
          () => { AccessoryManager.setRotation(idx, newRot); $.accRotSlider.value = newRot; $.accRotVal.textContent = newRot + '°'; }
        );
      }
    },

    // 手机版工具栏操作
    _rotateBy(delta) {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const item = AccessoryManager.items[idx];
      const oldRot = item.rotation || 0;
      let newRot = oldRot + delta;
      newRot = Math.round(newRot / 15) * 15;
      newRot = Math.max(-180, Math.min(180, newRot));
      if (oldRot === newRot) return;
      AccessoryManager.setRotation(idx, newRot);
      if ($.accRotSlider) { $.accRotSlider.value = newRot; $.accRotVal.textContent = newRot + '°'; }
      this.renderPreview();
      this._pushCmd(
        () => { AccessoryManager.setRotation(idx, oldRot); if ($.accRotSlider) { $.accRotSlider.value = oldRot; $.accRotVal.textContent = oldRot + '°'; } },
        () => { AccessoryManager.setRotation(idx, newRot); if ($.accRotSlider) { $.accRotSlider.value = newRot; $.accRotVal.textContent = newRot + '°'; } }
      );
    },

    removeSelected() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const item = AccessoryManager.items[idx];
      const saved = { acc: item.acc, x: item.x, y: item.y, scale: item.scale, flipH: item.flipH, rotation: item.rotation || 0 };
      AccessoryManager.remove(idx);
      S.set('accSelectedIndex', -1);
      this.renderPreview();
      this._updateButtons();
      this._pushCmd(
        () => {
          const ni = AccessoryManager.add(saved.acc, $.accCanvas.width, $.accCanvas.height);
          AccessoryManager.moveTo(ni, saved.x, saved.y);
          AccessoryManager.setScale(ni, saved.scale);
          if (saved.flipH) AccessoryManager.flipHorizontal(ni);
          if (saved.rotation) AccessoryManager.setRotation(ni, saved.rotation);
          S.set('accSelectedIndex', ni);
        },
        () => { AccessoryManager.remove(idx); S.set('accSelectedIndex', -1); }
      );
    },

    flipSelected() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      AccessoryManager.flipHorizontal(idx);
      this.renderPreview();
      this._pushCmd(
        () => { AccessoryManager.flipHorizontal(idx); },
        () => { AccessoryManager.flipHorizontal(idx); }
      );
    },

    duplicateSelected() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const item = AccessoryManager.items[idx];
      const ni = AccessoryManager.add(item.acc, $.accCanvas.width, $.accCanvas.height);
      AccessoryManager.moveTo(ni, item.x + 15, item.y + 15);
      AccessoryManager.setScale(ni, item.scale);
      if (item.flipH) AccessoryManager.flipHorizontal(ni);
      if (item.rotation) AccessoryManager.setRotation(ni, item.rotation);
      S.set('accSelectedIndex', ni);
      this.renderPreview();
      this._updateButtons();
      this._pushCmd(
        () => { AccessoryManager.remove(ni); S.set('accSelectedIndex', idx); },
        () => {
          const n2 = AccessoryManager.add(item.acc, $.accCanvas.width, $.accCanvas.height);
          AccessoryManager.moveTo(n2, item.x + 15, item.y + 15);
          AccessoryManager.setScale(n2, item.scale);
          if (item.flipH) AccessoryManager.flipHorizontal(n2);
          if (item.rotation) AccessoryManager.setRotation(n2, item.rotation);
          S.set('accSelectedIndex', n2);
        }
      );
    },

    clearAll() {
      if (AccessoryManager.items.length === 0) return;
      const saved = AccessoryManager.items.map(it => ({
        acc: it.acc, x: it.x, y: it.y, scale: it.scale, flipH: it.flipH, rotation: it.rotation || 0
      }));
      AccessoryManager.clear();
      S.set('accSelectedIndex', -1);
      this.renderPreview();
      this._updateButtons();
      this._undoStack = []; this._redoStack = [];
      this._pushCmd(
        () => {
          saved.forEach(s => {
            const ni = AccessoryManager.add(s.acc, $.accCanvas.width, $.accCanvas.height);
            AccessoryManager.moveTo(ni, s.x, s.y);
            AccessoryManager.setScale(ni, s.scale);
            if (s.flipH) AccessoryManager.flipHorizontal(ni);
            if (s.rotation) AccessoryManager.setRotation(ni, s.rotation);
          });
        },
        () => { AccessoryManager.clear(); }
      );
      this._updateUndoButtons();
    },

    // ========== 画布事件绑定（触摸 + 鼠标双支持） ==========
    _bindCanvas() {
      const canvas = $.accCanvas;

      // 获取事件坐标（兼容触摸和鼠标）
      function _getXY(e) {
        if (e.touches && e.touches.length > 0) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
          return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
      }

      function _canvasXY(e) {
        const rect = canvas.getBoundingClientRect();
        const xy = _getXY(e);
        return { x: xy.x - rect.left, y: xy.y - rect.top };
      }

      // 统一的按下处理
      function _onDown(e) {
        e.preventDefault(); // 阻止页面滚动
        const { x: cx, y: cy } = _canvasXY(e);
        const hit = AccessoryManager.hitTest(cx, cy);
        if (hit >= 0) {
          const item = AccessoryManager.items[hit];
          S.set({ accSelectedIndex: hit, accDragging: true, _accDragOX: cx - item.x, _accDragOY: cy - item.y });
          Accessories._dragStartX = item.x;
          Accessories._dragStartY = item.y;
          // 触摸时跟踪 ID
          if (e.touches && e.touches.length > 0) {
            Accessories._activeTouchId = e.touches[0].identifier;
          }
        } else {
          S.set({ accSelectedIndex: -1, accDragging: false });
        }
        Accessories.renderPreview();
        Accessories._updateButtons();
      }

      // 统一的移动处理
      function _onMove(e) {
        if (!S.get('accDragging')) return;
        e.preventDefault();
        // 多点触摸时只跟踪原始触摸
        if (Accessories._activeTouchId !== null && e.touches) {
          let found = false;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === Accessories._activeTouchId) {
              found = true; break;
            }
          }
          if (!found) return;
        }
        const { x: cx, y: cy } = _canvasXY(e);
        const rx = cx - S.get('_accDragOX');
        const ry = cy - S.get('_accDragOY');
        const snap = 5;
        const idx = S.get('accSelectedIndex');
        AccessoryManager.moveTo(idx, Math.round(rx / snap) * snap, Math.round(ry / snap) * snap);
        Accessories.renderPreview();
      }

      // 统一的释放处理
      function _onUp(e) {
        if (S.get('accDragging')) {
          const idx2 = S.get('accSelectedIndex');
          if (idx2 >= 0 && Accessories._dragStartX !== undefined) {
            const item = AccessoryManager.items[idx2];
            if (item) {
              const endX = item.x, endY = item.y;
              const sx = Accessories._dragStartX, sy = Accessories._dragStartY;
              if (sx !== endX || sy !== endY) {
                Accessories._pushCmd(
                  () => { AccessoryManager.moveTo(idx2, sx, sy); },
                  () => { AccessoryManager.moveTo(idx2, endX, endY); }
                );
              }
            }
          }
        }
        S.set('accDragging', false);
        Accessories._activeTouchId = null;
        Accessories._updateButtons();
      }

      // ===== 触摸事件 =====
      canvas.addEventListener('touchstart', _onDown, { passive: false });
      canvas.addEventListener('touchmove', _onMove, { passive: false });
      canvas.addEventListener('touchend', _onUp, { passive: false });
      canvas.addEventListener('touchcancel', (e) => {
        S.set('accDragging', false);
        Accessories._activeTouchId = null;
        Accessories._updateButtons();
      });

      // ===== 鼠标事件（桌面调试 + 触屏笔设备） =====
      canvas.addEventListener('mousedown', _onDown);
      window.addEventListener('mousemove', (e) => {
        // 只在拖拽状态下处理
        if (!S.get('accDragging')) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const rx = mx - S.get('_accDragOX');
        const ry = my - S.get('_accDragOY');
        const snap = 5;
        const idx = S.get('accSelectedIndex');
        AccessoryManager.moveTo(idx, Math.round(rx / snap) * snap, Math.round(ry / snap) * snap);
        Accessories.renderPreview();
      });
      window.addEventListener('mouseup', (e) => {
        if (!S.get('accDragging')) return;
        const idx2 = S.get('accSelectedIndex');
        if (idx2 >= 0 && Accessories._dragStartX !== undefined) {
          const item = AccessoryManager.items[idx2];
          if (item) {
            const endX = item.x, endY = item.y;
            const sx = Accessories._dragStartX, sy = Accessories._dragStartY;
            if (sx !== endX || sy !== endY) {
              Accessories._pushCmd(
                () => { AccessoryManager.moveTo(idx2, sx, sy); },
                () => { AccessoryManager.moveTo(idx2, endX, endY); }
              );
            }
          }
        }
        S.set('accDragging', false);
        Accessories._activeTouchId = null;
        Accessories._updateButtons();
      });
    },

    // ========== 下载 ==========
    download() {
      const img = S.get('generatedImage');
      if (!img) return;
      const charCanvas = document.createElement('canvas');
      charCanvas.width = img.width; charCanvas.height = img.height;
      const ctx = charCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0);
      const result = AccessoryManager.composite(charCanvas);
      const a = document.createElement('a');
      a.href = result.toDataURL('image/png'); a.download = 'pixel-character.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },
  };

  // ============================================================
  //  初始化入口
  // ============================================================
  function init() {
    _cacheDOM();

    // 步骤指示器点击
    $.stepBtns.forEach(b => b.addEventListener('click', () => Steps.switchTo(parseInt(b.dataset.step, 10))));
    $.prevBtn.addEventListener('click', () => Steps.prev());
    $.nextBtn.addEventListener('click', () => Steps.next());

    // 步骤①
    Upload.init();

    // 步骤②
    Prompts.initTemplates();
    $.tplTextarea?.addEventListener('input', () => { S.set('customPrompt', $.tplTextarea.value); Prompts._updateCounter(); });
    $.confirmPromptBtn?.addEventListener('click', () => Prompts.confirm());
    $.resetPromptBtn?.addEventListener('click', () => Prompts.reset());

    // 步骤③
    if ($.generateBtn) {
      $.generateBtn.addEventListener('click', async () => {
        const img = S.get('image');
        const prompt = S.get('activePrompt');
        if (!img || !prompt) { alert('请先上传图片并确认提示词'); return; }
        Generate.showLoading('正在生成，请等待...');
        $.generateBtn.disabled = true;
        try {
          const size = '2K';
          const result = await generatePixelArt(img, prompt, { size }, (msg) => { Generate.showLoading(msg); });
          S.set({ generatedImage: result.image, generatedDataUrl: result.dataUrl });
          Generate.displayPreview(result.image);
          Steps.switchTo(4);
        } catch (err) {
          alert('❌ 生成失败: ' + err.message);
          Generate.showPlaceholder('生成失败，请重试');
        } finally {
          $.generateBtn.disabled = false;
        }
      });
    }
    $.backPromptBtn?.addEventListener('click', () => Steps.switchTo(2));
    $.downloadPngBtn?.addEventListener('click', () => {
      const dataUrl = S.get('generatedDataUrl');
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'pixel-art.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    // 步骤④ — 配件操作按钮
    $.accScaleSlider?.addEventListener('input', () => Accessories.onScaleChange());
    $.accRotSlider?.addEventListener('input', () => Accessories.onRotChange());
    // 手机版工具栏按钮
    qs('#accRotLeftBtn')?.addEventListener('click', () => Accessories._rotateBy(-15));
    qs('#accRotRightBtn')?.addEventListener('click', () => Accessories._rotateBy(15));
    qs('#accFlipBtnMob')?.addEventListener('click', () => Accessories.flipSelected());
    qs('#accDupBtnMob')?.addEventListener('click', () => Accessories.duplicateSelected());
    qs('#accDelBtnMob')?.addEventListener('click', () => Accessories.removeSelected());
    // 撤销/重做按钮
    $.undoBtn?.addEventListener('click', () => Accessories.undo());
    $.redoBtn?.addEventListener('click', () => Accessories.redo());
    // 清除/下载
    $.clearAccBtn?.addEventListener('click', () => Accessories.clearAll());
    $.downloadAccBtn?.addEventListener('click', () => Accessories.download());
    // 兼容桌面版按钮 ID
    $.removeAccBtn?.addEventListener('click', () => Accessories.removeSelected());
    $.flipAccBtn?.addEventListener('click', () => Accessories.flipSelected());

    // 窗口缩放
    let _resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeT);
      _resizeT = setTimeout(() => {
        const step = S.get('currentStep');
        if (step === 3 && S.get('generatedImage')) Generate.displayPreview(S.get('generatedImage'));
        if (step === 4 && S.get('generatedImage')) Accessories.renderPreview();
      }, 250);
    });

    // 初始显示步骤①
    Steps.switchTo(1);
  }

  // ============================================================
  //  挂载到全局命名空间
  // ============================================================
  App.UI = { init, Steps, Upload, Prompts, Generate, Accessories };

  // 向后兼容
  window.StepManager = Steps;
  window.AccessoryUI = Accessories;

})();

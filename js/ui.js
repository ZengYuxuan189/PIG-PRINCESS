/**
 * 像素表情包工厂 — UI 模块 v1.0
 *
 * 所有界面渲染和用户交互逻辑。
 * 通过 App.State 读写状态，通过 App.Events 发送事件。
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
    $.removeAccBtn = qs('#removeAccBtn');
    $.flipAccBtn = qs('#flipAccBtn');
    $.clearAccBtn = qs('#clearAccBtn');
    $.downloadAccBtn = qs('#downloadAccBtn');
  }

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  // ============================================================
  //  步骤导航 UI
  // ============================================================
  const Steps = {
    switchTo(stepNum) {
      const old = S.get('currentStep');
      if (stepNum === old) return;

      // 正向守卫检查
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
      el.style.outline = '6px solid var(--accent-red)';
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
      // 指示器
      $.stepBtns.forEach(b => {
        const n = parseInt(b.dataset.step, 10);
        b.classList.toggle('active', n === s);
        if (n === s) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      // 导航按钮
      $.prevBtn.disabled = (s === 1);
      $.nextBtn.disabled = (s === C.TOTAL_STEPS);
      $.nextBtn.textContent = s === C.TOTAL_STEPS ? '已完成' : '下一步 ▶';
      // 进度点
      $.progressDots.forEach(d => {
        const n = parseInt(d.dataset.dot, 10);
        d.classList.remove('active', 'completed');
        if (n === s) d.classList.add('active');
        else if (n < s) d.classList.add('completed');
      });
    },
  };

  // ============================================================
  //  步骤①：上传 + API Key
  // ============================================================
  const Upload = {
    init() {
      // API Key
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

      // 文件选择
      $.selectBtn.addEventListener('click', (e) => { e.stopPropagation(); $.fileInput.click(); });
      $.uploadZone.addEventListener('click', () => $.fileInput.click());

      $.fileInput.addEventListener('change', async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { await this._load(f); } catch (err) { alert('❌ ' + err.message); }
        $.fileInput.value = '';
      });

      // 拖拽
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
  //  步骤②：提示词配置
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
  //  步骤③：AI 生成
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
      const maxW = (stage ? stage.clientWidth : 500) - 20;
      const maxH = Math.min(600, window.innerHeight * 0.5);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      $.pixelCanvas.width = Math.round(img.width * scale);
      $.pixelCanvas.height = Math.round(img.height * scale);
      const ctx = $.pixelCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, $.pixelCanvas.width, $.pixelCanvas.height);
      ctx.drawImage(img, 0, 0, $.pixelCanvas.width, $.pixelCanvas.height);
    },

    async generate() {
      if (!hasSeedreamApiKey()) { alert('请先设置API Key'); Steps.switchTo(1); return; }
      if (!S.get('activePrompt')) { alert('请先确认提示词'); Steps.switchTo(2); return; }
      if (!S.get('image')) { alert('请先上传照片'); Steps.switchTo(1); return; }

      $.generateBtn.disabled = true; $.generateBtn.textContent = '⏳ 生成中...';
      try {
        const result = await generatePixelArt(S.get('image'), S.get('activePrompt'), { size: S.get('outputSize') },
          (s) => { if (s) this.showLoading(s); });
        S.set({ generatedImage: result.image, generatedDataUrl: result.dataUrl });
        this.displayPreview(result.image);
        if (window.AccessoryManager) AccessoryManager.clear();
      } catch (err) {
        console.error('[UI] 生成失败：', err);
        alert('❌ 生成失败：' + err.message);
        this.showPlaceholder('生成失败，请重试');
      } finally {
        $.generateBtn.disabled = false; $.generateBtn.textContent = '🚀 生成像素图';
      }
    },

    downloadPng() {
      const img = S.get('generatedImage');
      let url = S.get('generatedDataUrl');
      if (!url && img) {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0);
        url = c.toDataURL('image/png');
      }
      if (!url) return;
      const a = document.createElement('a'); a.href = url; a.download = 'pixel-sprite.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },
  };

  // ============================================================
  //  步骤④：配件装饰
  // ============================================================
  const Accessories = {
    _accEventsBound: false,

    // 撤销/重做命令栈
    _undoStack: [], _redoStack: [], _maxUndo: 50,

    _pushCmd(undoFn, redoFn) {
      this._undoStack.push({ undo: undoFn, redo: redoFn });
      if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
      this._redoStack = [];
    },

    undo() {
      if (this._undoStack.length === 0) return;
      const cmd = this._undoStack.pop();
      cmd.undo();
      this._redoStack.push(cmd);
      this.renderPreview(); this._updateButtons();
    },

    redo() {
      if (this._redoStack.length === 0) return;
      const cmd = this._redoStack.pop();
      cmd.redo();
      this._undoStack.push(cmd);
      this.renderPreview(); this._updateButtons();
    },
    init() {
      this.showCanvas();
      this._autoCategory();
      this.initCategories();
      this.initGrid();
      this._updateButtons();

      const img = S.get('generatedImage');
      if (img) {
        const stage = $.accCanvas.parentElement;
        const stageW = stage ? Math.max(stage.clientWidth, 300) : 500;
        const maxW = Math.max(100, stageW - 20);
        const maxH = Math.max(100, Math.min(500, window.innerHeight * 0.45));
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        $.accCanvas.width = Math.max(1, Math.round(img.width * scale));
        $.accCanvas.height = Math.max(1, Math.round(img.height * scale));
        this.renderPreview();
      }
      if (!this._accEventsBound) { this._bindCanvas(); this._accEventsBound = true; }
    },

    _autoCategory() {
      const map = {
        'classic-nes': 'nes-classic', 'retro-arcade': 'nes-classic',
        'cute-chibi': 'cute', 'anime-pixel': 'cute',
        'fighting-game': 'fighting',
        'jrpg': 'fantasy', 'gba-style': 'fantasy', 'dark-gothic': 'fantasy',
        'exaggerated': 'funny',
        'minecraft': 'universal', 'cyberpunk': 'universal',
        'custom': 'all',
      };
      S.set('accCategory', map[S.get('selectedTemplate')] || 'all');
    },

    showPlaceholder() {
      if ($.accPlaceholder) $.accPlaceholder.style.display = '';
      $.accCanvas.style.display = 'none';
    },
    showCanvas() {
      if ($.accPlaceholder) $.accPlaceholder.style.display = 'none';
      $.accCanvas.style.display = 'block';
    },

    initCategories() {
      if (!$.accCategories) return;
      $.accCategories.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.className = 'acc-cat-btn'; allBtn.type = 'button'; allBtn.dataset.catId = 'all';
      allBtn.textContent = '📋 全部'; allBtn.title = '所有配件';
      allBtn.addEventListener('click', () => this._selectCategory('all'));
      $.accCategories.appendChild(allBtn);
      ACCESSORY_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'acc-cat-btn'; btn.type = 'button'; btn.dataset.catId = cat.id;
        btn.textContent = cat.icon + ' ' + cat.name; btn.title = cat.desc;
        btn.addEventListener('click', () => this._selectCategory(cat.id));
        $.accCategories.appendChild(btn);
      });
      this._highlightCategory(S.get('accCategory'));
    },

    _selectCategory(id) { S.set('accCategory', id); this._highlightCategory(id); this.initGrid(); },
    _highlightCategory(id) {
      $.accCategories?.querySelectorAll('.acc-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.catId === id));
    },

    initGrid() {
      if (!$.accGrid) return;
      $.accGrid.innerHTML = '';
      const items = getAccessoriesByCategory(S.get('accCategory'));

      items.forEach(acc => {
        const thumb = renderAccessoryToCanvas(acc, 2, true);
        const tc = document.createElement('canvas');
        const ts = C.ACCESSORY_THUMB_SIZE;
        tc.width = ts; tc.height = ts;
        const tctx = tc.getContext('2d'); tctx.imageSmoothingEnabled = false;
        const s = Math.min(ts / thumb.width, ts / thumb.height);
        tctx.drawImage(thumb, Math.round((ts - thumb.width * s) / 2), Math.round((ts - thumb.height * s) / 2), Math.round(thumb.width * s), Math.round(thumb.height * s));

        const card = document.createElement('button');
        card.className = 'acc-card'; card.type = 'button'; card.title = acc.name;
        card.innerHTML = `<span class="acc-card-preview"><img src="${tc.toDataURL()}" alt="${acc.name}" style="image-rendering:pixelated;width:${ts}px;height:${ts}px;"></span><span class="acc-card-name">${acc.name}</span>`;
        card.addEventListener('click', () => this._add(acc));
        // 悬浮预览
        card.addEventListener('mouseenter', (e) => this._showHover(acc, e));
        card.addEventListener('mousemove', (e) => this._moveHover(e));
        card.addEventListener('mouseleave', () => this._hideHover());
        $.accGrid.appendChild(card);
      });
    },

    // —— 悬浮预览 ——
    _showHover(acc, e) {
      const preview = qs('#accHoverPreview');
      const canvas = qs('#accHoverCanvas');
      if (!preview || !canvas) return;
      const large = renderAccessoryToCanvas(acc, 4, true);
      const size = 120;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const sc = Math.min(size / large.width, size / large.height);
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(large, Math.round((size - large.width * sc) / 2), Math.round((size - large.height * sc) / 2), Math.round(large.width * sc), Math.round(large.height * sc));
      preview.style.display = 'block';
      this._moveHover(e);
    },
    _moveHover(e) {
      const preview = qs('#accHoverPreview');
      if (!preview || preview.style.display === 'none') return;
      const x = e.clientX + 16, y = e.clientY - 140;
      preview.style.left = Math.min(x, window.innerWidth - 140) + 'px';
      preview.style.top = Math.max(y, 10) + 'px';
    },
    _hideHover() {
      const preview = qs('#accHoverPreview');
      if (preview) preview.style.display = 'none';
    },


    renderPreview() {
      const canvas = $.accCanvas;
      const img = S.get('generatedImage');
      if (!img || !canvas || canvas.width < 1 || canvas.height < 1) return;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (let i = 0; i < AccessoryManager.items.length; i++) {
        const c = AccessoryManager.getScaledCanvas(i);
        if (!c) continue;
        const item = AccessoryManager.items[i];
        ctx.drawImage(c, item.x, item.y);
        if (i === S.get('accSelectedIndex')) {
          ctx.strokeStyle = '#f8b800'; ctx.lineWidth = 3; ctx.setLineDash([4, 2]);
          ctx.strokeRect(item.x, item.y, c.width, c.height); ctx.setLineDash([]);
        }
      }
    },

    _add(acc) {
      const img = S.get('generatedImage');
      if (!img) return;
      const stage = $.accCanvas.parentElement;
      const stageW = stage ? Math.max(stage.clientWidth, 300) : 500;
      const maxW = Math.max(100, stageW - 20);
      const maxH = Math.max(100, Math.min(500, window.innerHeight * 0.45));
      const scl = Math.min(maxW / img.width, maxH / img.height, 1);
      const charW = Math.round(img.width * scl), charH = Math.round(img.height * scl);
      const idx = AccessoryManager.add(acc, charW, charH);
      S.set('accSelectedIndex', idx);
	      // 撤销命令
	      this._pushCmd(
	        () => { AccessoryManager.remove(idx); S.set('accSelectedIndex', -1); },
	        () => { const i = AccessoryManager.add(acc, charW, charH); S.set('accSelectedIndex', i); }
	      );

      this.renderPreview(); this._updateButtons();
    },

    _updateButtons() {
      const sel = S.get('accSelectedIndex') >= 0;
      $.removeAccBtn.disabled = !sel;
      $.flipAccBtn.disabled = !sel;
      $.accScaleSlider.disabled = !sel;
      $.accRotSlider.disabled = !sel;
      if (sel) {
        const item = AccessoryManager.items[S.get('accSelectedIndex')];
        $.accScaleSlider.value = item.scale;
        $.accScaleVal.textContent = item.scale.toFixed(1) + 'x';
        $.accRotSlider.value = item.rotation || 0;
        $.accRotVal.textContent = (item.rotation || 0) + '°';
      } else {
        $.accScaleSlider.value = 1.0; $.accScaleVal.textContent = '1.0x';
        $.accRotSlider.value = 0; $.accRotVal.textContent = '0°';
      }
    },

    onScaleChange() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      const v = parseFloat($.accScaleSlider.value);
      const oldScale = AccessoryManager.items[idx] ? AccessoryManager.items[idx].scale : 1.0;
      AccessoryManager.setScale(idx, v);
      const newScale = v;
      if (oldScale !== newScale) { this._pushCmd(() => { AccessoryManager.setScale(idx, oldScale); $.accScaleSlider.value = oldScale; $.accScaleVal.textContent = oldScale.toFixed(1) + "x"; }, () => { AccessoryManager.setScale(idx, newScale); $.accScaleSlider.value = newScale; $.accScaleVal.textContent = newScale.toFixed(1) + "x"; }); }
    },

    onRotChange() {
      const idx = S.get("accSelectedIndex");
      if (idx < 0) return;
      const oldRot = AccessoryManager.items[idx].rotation || 0;
      const v = parseInt($.accRotSlider.value);
      AccessoryManager.setRotation(idx, v);
      $.accRotVal.textContent = v + "°";
      if (oldRot !== v) {
        this._pushCmd(
          () => { AccessoryManager.setRotation(idx, oldRot); $.accRotSlider.value = oldRot; $.accRotVal.textContent = oldRot + "°"; },
          () => { AccessoryManager.setRotation(idx, v); $.accRotSlider.value = v; $.accRotVal.textContent = v + "°"; }
        );
      }
      this.renderPreview();
    },

    removeSelected() {
      if (S.get('accSelectedIndex') >= 0) {
        const rmIdx = S.get('accSelectedIndex');
        const rmItem = AccessoryManager.items[rmIdx];
        const rmAcc = rmItem ? rmItem.acc : null;
        const rmX = rmItem ? rmItem.x : 0;
        const rmY = rmItem ? rmItem.y : 0;
        const rmScale = rmItem ? rmItem.scale : 1.0;
        if (rmAcc) {
          AccessoryManager.remove(rmIdx);
          // 撤销命令
          this._pushCmd(
            () => { const ni = AccessoryManager.add(rmAcc, 1, 1); AccessoryManager.moveTo(ni, rmX, rmY); AccessoryManager.setScale(ni, rmScale); S.set('accSelectedIndex', ni); },
            () => { AccessoryManager.remove(rmIdx); S.set('accSelectedIndex', -1); }
          );
        }
        S.set('accSelectedIndex', -1);
        this.renderPreview(); this._updateButtons();
      }
    },


    flipSelected() {
      const idx = S.get('accSelectedIndex');
      if (idx < 0) return;
      AccessoryManager.flipHorizontal(idx);
      this.renderPreview();
    },
    clearAll() {
      AccessoryManager.clear();
      S.set('accSelectedIndex', -1);
      this.renderPreview(); this._updateButtons();
    },

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

    _bindCanvas() {
      const canvas = $.accCanvas;
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const hit = AccessoryManager.hitTest(mx, my);
        if (hit >= 0) {
          S.set({ accSelectedIndex: hit, accDragging: true, _accDragOX: mx - AccessoryManager.items[hit].x, _accDragOY: my - AccessoryManager.items[hit].y });
        this._dragStartX = AccessoryManager.items[hit] ? AccessoryManager.items[hit].x : 0;
        this._dragStartY = AccessoryManager.items[hit] ? AccessoryManager.items[hit].y : 0;
          canvas.style.cursor = 'grabbing';
        } else { S.set({ accSelectedIndex: -1, accDragging: false }); }
        this.renderPreview(); this._updateButtons();
      });
      canvas.addEventListener('mousemove', (e) => {
        if (!S.get('accDragging')) {
          const hit = AccessoryManager.hitTest(e.clientX - canvas.getBoundingClientRect().left, e.clientY - canvas.getBoundingClientRect().top);
          canvas.style.cursor = hit >= 0 ? 'grab' : 'default'; return;
        }
        const rect = canvas.getBoundingClientRect();
        const rx = e.clientX - rect.left - S.get('_accDragOX');
        const ry = e.clientY - rect.top - S.get('_accDragOY');
        const snap = 5;
        AccessoryManager.moveTo(S.get('accSelectedIndex'), Math.round(rx / snap) * snap, Math.round(ry / snap) * snap);
        this.renderPreview();
      });
      canvas.addEventListener('mouseup', () => {
        if (S.get('accDragging')) {
          const idx2 = S.get('accSelectedIndex');
          if (idx2 >= 0 && this._dragStartX !== undefined) {
            const endX = AccessoryManager.items[idx2].x;
            const endY = AccessoryManager.items[idx2].y;
            const sx = this._dragStartX, sy = this._dragStartY;
            if (sx !== endX || sy !== endY) {
              this._pushCmd(() => { AccessoryManager.moveTo(idx2, sx, sy); }, () => { AccessoryManager.moveTo(idx2, endX, endY); });
            }
          }
        }
        S.set('accDragging', false); $.accCanvas.style.cursor = 'default';
      });
      canvas.addEventListener('mouseleave', () => { S.set('accDragging', false); canvas.style.cursor = 'default'; });
    },
  };

  // ============================================================
  //  全局键盘导航
  // ============================================================
  function _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // 撤销/重做（全局）
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); Accessories.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); Accessories.redo(); return; }
      // 步骤④ 配件快捷键
      if (S.get('currentStep') === 4) {
        const sel = S.get('accSelectedIndex');
        if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { e.preventDefault(); Accessories.removeSelected(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && sel >= 0) { e.preventDefault(); const it = AccessoryManager.items[sel]; if (it) { const ni = AccessoryManager.add(it.acc, 1, 1); AccessoryManager.moveTo(ni, it.x + 15, it.y + 15); AccessoryManager.setScale(ni, it.scale); S.set('accSelectedIndex', ni); Accessories.renderPreview(); Accessories._updateButtons(); } return; }
        if (e.key === '[' && sel >= 0) { e.preventDefault(); const ns = Math.max(0.1, AccessoryManager.items[sel].scale - 0.1); Accessories.setScale(sel, ns); Accessories.renderPreview(); Accessories._updateButtons(); return; }
        if (e.key === 'q' && sel >= 0) { e.preventDefault(); const cr = AccessoryManager.items[sel].rotation || 0; AccessoryManager.setRotation(sel, cr - 15); Accessories.renderPreview(); Accessories._updateButtons(); return; }
        if (e.key === 'e' && sel >= 0) { e.preventDefault(); const cr2 = AccessoryManager.items[sel].rotation || 0; AccessoryManager.setRotation(sel, cr2 + 15); Accessories.renderPreview(); Accessories._updateButtons(); return; }
        if (e.key === ']' && sel >= 0) { e.preventDefault(); const ns2 = Math.min(10, AccessoryManager.items[sel].scale + 0.1); Accessories.setScale(sel, ns2); Accessories.renderPreview(); Accessories._updateButtons(); return; }
        if (sel >= 0) {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowUp') { e.preventDefault(); AccessoryManager.moveTo(sel, AccessoryManager.items[sel].x, AccessoryManager.items[sel].y - step); Accessories.renderPreview(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); AccessoryManager.moveTo(sel, AccessoryManager.items[sel].x, AccessoryManager.items[sel].y + step); Accessories.renderPreview(); return; }
          if (e.key === 'ArrowLeft') { e.preventDefault(); AccessoryManager.moveTo(sel, AccessoryManager.items[sel].x - step, AccessoryManager.items[sel].y); Accessories.renderPreview(); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); AccessoryManager.moveTo(sel, AccessoryManager.items[sel].x + step, AccessoryManager.items[sel].y); Accessories.renderPreview(); return; }
        }
      }
      // 步骤导航（不在配件编辑模式时）
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); Steps.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); Steps.prev(); }
    });
  }

  // ============================================================
  //  窗口缩放
  // ============================================================
  let _resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeT);
    _resizeT = setTimeout(() => {
      const step = S.get('currentStep');
      if (step === 3 && S.get('generatedImage')) Generate.displayPreview(S.get('generatedImage'));
      if (step === 4 && S.get('generatedImage')) Accessories.renderPreview();
    }, 200);
  });

  // ============================================================
  //  初始化入口
  // ============================================================
  function init() {
    _cacheDOM();

    // 步骤指示器点击
    $.stepBtns.forEach(b => b.addEventListener('click', () => Steps.switchTo(parseInt(b.dataset.step, 10))));
    $.prevBtn.addEventListener('click', () => Steps.prev());
    $.nextBtn.addEventListener('click', () => Steps.next());
    _bindKeyboard();

    // 步骤①
    Upload.init();

    // 步骤②
    Prompts.initTemplates();
    $.tplTextarea?.addEventListener('input', () => { S.set('customPrompt', $.tplTextarea.value); Prompts._updateCounter(); });
    $.confirmPromptBtn?.addEventListener('click', () => Prompts.confirm());
    $.resetPromptBtn?.addEventListener('click', () => Prompts.reset());

    // 步骤③
    $.generateBtn?.addEventListener('click', () => Generate.generate());
    $.backPromptBtn?.addEventListener('click', () => Steps.switchTo(2));
    $.downloadPngBtn?.addEventListener('click', () => Generate.downloadPng());
    qsa('input[name="outputSize"]').forEach(r => r.addEventListener('change', (e) => { if (e.target.checked) S.set('outputSize', e.target.value); }));

    // 步骤④
    $.flipAccBtn?.addEventListener('click', () => Accessories.flipSelected());
    $.accScaleSlider?.addEventListener('input', () => Accessories.onScaleChange());
    $.accRotSlider?.addEventListener('input', () => Accessories.onRotChange());
    $.removeAccBtn?.addEventListener('click', () => Accessories.removeSelected());
    $.clearAccBtn?.addEventListener('click', () => Accessories.clearAll());
    $.downloadAccBtn?.addEventListener('click', () => Accessories.download());

    // 初始显示步骤①
    Steps._updateAll();
    $.panels[1].classList.add('active');
  }

  // ============================================================
  //  挂载
  // ============================================================
  App.UI = { Steps, Upload, Prompts, Generate, Accessories, init, $ };
})();

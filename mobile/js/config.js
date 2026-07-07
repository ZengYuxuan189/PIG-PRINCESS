/**
 * 像素表情包工厂 — 核心配置 + 事件系统 + 状态管理
 *
 * 全局命名空间：window.App
 * 所有模块通过 App.Events 通信，通过 App.State 共享状态。
 */

// ============================================================
//  全局命名空间
// ============================================================
window.App = window.App || {};

// ============================================================
//  事件总线
// ============================================================
(function () {
  const listeners = {};

  /** 订阅事件，返回取消订阅函数 */
  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return () => off(event, handler);
  }

  /** 取消订阅 */
  function off(event, handler) {
    const list = listeners[event];
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  /** 触发事件 */
  function emit(event, data) {
    const list = listeners[event];
    if (list) {
      for (const handler of [...list]) {
        try { handler(data); }
        catch (e) { console.error('[Events] 处理 ' + event + ' 时出错：', e); }
      }
    }
  }

  /** 一次性订阅 */
  function once(event, handler) {
    const wrapper = (data) => { off(event, wrapper); handler(data); };
    on(event, wrapper);
  }

  App.Events = { on, off, emit, once };
})();

// ============================================================
//  配置常量
// ============================================================
App.Config = {
  // API
  SEEDREAM_ENDPOINT: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
  SEEDREAM_MODEL: 'doubao-seedream-5-0-260128',
  SEEDREAM_ENDPOINT_ID: 'ep-20260706154600-rz5gc',
  DEFAULT_API_KEY: 'ark-8aa5632a-4957-40b9-bd33-6430b271d80a-49193',
  API_TIMEOUT: 60000,
  MAX_PROMPT_LENGTH: 300,
  DEFAULT_OUTPUT_SIZE: '2K',
  STORAGE_KEY: 'pixel_princess_seedream_key',

  // 配件
  ACCESSORY_BASE_PIXEL: 5,
  ACCESSORY_MAX_PIXEL: 100,
  ACCESSORY_SCALE_MIN: 0.1,
  ACCESSORY_SCALE_MAX: 10,
  ACCESSORY_SCALE_STEP: 0.1,
  ACCESSORY_THUMB_SIZE: 44,

  // 步骤
  TOTAL_STEPS: 4,
};

// ============================================================
//  中心化状态管理
// ============================================================
(function () {
  const _state = {
    currentStep: 1,
    image: null,
    selectedTemplate: 'classic-nes',
    customPrompt: '',
    activePrompt: '',
    generatedImage: null,
    generatedDataUrl: null,
    outputSize: '2K',
    accCategory: 'nes-classic',
    accSelectedIndex: -1,
    accDragging: false,
    _accDragOX: 0,
    _accDragOY: 0,
  };

  /** 获取状态值 */
  function get(key) {
    if (key === undefined) return Object.freeze({ ..._state });
    return _state[key];
  }

  /**
   * 设置状态值，带验证
   * 触发 'state:changed' 事件，UI可订阅刷新
   */
  function set(key, value) {
    if (typeof key === 'object') {
      // 批量设置
      const changes = [];
      for (const [k, v] of Object.entries(key)) {
        if (_validate(k, v) && _state[k] !== v) {
          _state[k] = v;
          changes.push(k);
        }
      }
      if (changes.length > 0) {
        App.Events.emit('state:changed', { keys: changes, state: get() });
      }
    } else {
      if (_validate(key, value) && _state[key] !== value) {
        _state[key] = value;
        App.Events.emit('state:changed', { keys: [key], state: get() });
      }
    }
  }

  /** 状态验证规则 */
  function _validate(key, value) {
    switch (key) {
      case 'currentStep':
        if (typeof value !== 'number' || value < 1 || value > App.Config.TOTAL_STEPS) {
          console.warn('[State] currentStep 无效：', value);
          return false;
        }
        break;
      case 'selectedTemplate':
        if (typeof value !== 'string') return false;
        break;
      case 'accSelectedIndex':
        if (typeof value !== 'number' || value < -1) return false;
        break;
      case 'accDragging':
        if (typeof value !== 'boolean') return false;
        break;
      case 'outputSize':
        if (!['2K'].includes(value)) return false;
        break;
    }
    return true;
  }

  /** 重置步骤相关状态（新生成时调用） */
  function resetGeneration() {
    set({
      generatedImage: null,
      generatedDataUrl: null,
      accSelectedIndex: -1,
      accDragging: false,
    });
  }

  /** 获取只读快照 */
  function snapshot() {
    return Object.freeze({ ..._state });
  }

  App.State = { get, set, resetGeneration, snapshot };
})();

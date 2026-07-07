/**
 * PIG PRINCESS — 主入口 v5.0（模块化架构）
 *
 * 架构：
 *   config.js → seedream-api.js → prompt-templates.js → accessories.js → ui.js → app.js
 *
 * 职责：
 *   - 页面加载入口
 *   - 向后兼容别名（旧代码通过 window 访问的变量）
 */

// ============================================================
//  向后兼容别名
//  旧代码可能通过 window.AppState / window.StepManager 访问，
//  这里提供兼容映射。
// ============================================================
Object.defineProperty(window, 'AppState', {
  get() { return App.State.snapshot(); },
  configurable: true,
});

window.StepManager = {
  get goToStep() { return (n) => App.UI.Steps.switchTo(n); },
  get nextStep()  { return () => App.UI.Steps.next(); },
  get prevStep()  { return () => App.UI.Steps.prev(); },
};

// ============================================================
//  启动
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  App.UI.init();
});

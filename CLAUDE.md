# 像素表情包工厂 — 项目文档

## 项目概述
一个 Windows 上运行的纯静态网页应用，将照片人物通过火山方舟 Seedream 5.0 AI 转化为像素风格角色，再用像素配件自由装饰后导出成品。
双击 `index.html` 即可在浏览器中运行，无需任何服务器或构建工具。

## 目标用户
- **代码小白**：项目所有者是编程初学者
- 所有代码必须有详细中文注释
- 运行方式必须简单（双击打开）
- 界面全中文

## 技术栈
| 层面 | 方案 |
|------|------|
| 运行方式 | 纯静态网页，file:// 协议直接打开 |
| 前端 | HTML5 + CSS3 + 原生 JavaScript (ES6+) |
| 图像处理 | Canvas 2D API |
| GIF 生成 | 自写轻量 GIF 编码器（gif-encoder.js），不依赖 CDN |
| 外部依赖 | **零依赖**，所有代码自包含 |

## 设计约束
- **禁止使用**：Node.js、npm、React/Vue、Python、任何需要编译的工具
- **禁止 CDN 依赖**：方便离线使用，所有库自写或内嵌
- **兼容性**：Chrome / Edge / Firefox 最新版
- **文件协议**：代码需兼容 `file://` 协议下的运行限制

## 项目结构
```
pixel-emoji-web/
├── index.html              # 主页面（4步骤面板）
├── css/
│   └── pixel-theme.css     # 像素风格主题
├── js/
│   ├── app.js              # 主流程控制器
│   ├── seedream-api.js     # Seedream 5.0 API 集成
│   ├── prompt-templates.js # 提示词模板系统（6套）
│   ├── accessories.js      # 像素配件库（38个配件 + 6大类）
│   └── bouncing-decorations.js # 背景装饰动画
├── example/                # 测试图片素材
├── CLAUDE.md               # 本文件
└── .gitignore
```

## ⚠️ 重要规则

**在没有完全搞清楚用户需求时，必须先向用户提问，直到完全理解用户需求后再动手写代码。**

- 不要猜测用户想要什么
- 不要看到不完整的需求就开始实现
- 用简洁的问题逐一确认关键细节
- 用户给了参考图片/文件时，先仔细分析，再提问确认理解是否正确
- 确认理解后，先说明方案，再动手

## 代码约定
- 所有变量名和函数名使用英文（驼峰命名）
- 所有注释使用中文
- 每个 JS 文件用 IIFE 或模块化方式避免全局污染
- CSS 类名使用 kebab-case
- 使用 ES6+ 语法（const/let、箭头函数、模板字符串）

## 已完成模块
- ✅ `index.html` — 主页面 4 步骤框架 + 像素风 UI 结构
- ✅ `css/pixel-theme.css` — NES 8-bit 像素风主题样式
- ✅ `js/app.js` — 步骤切换控制器 + 全局状态管理
- ✅ `js/seedream-api.js` — Seedream 5.0 图生图 API 封装
- ✅ `js/prompt-templates.js` — 6 套提示词模板（经典NES/可爱Q版/格斗/日系RPG/搞笑/自定义）
- ✅ `js/accessories.js` — 38个像素配件 + 6风格分类 + 拖放管理器
- ✅ `js/bouncing-decorations.js` — 背景弹跳像素装饰

## 待开发模块
- 更多配件（可随时扩充 accessories.js）
- 配件层级调整（上移/下移）
- 配件旋转/翻转
- 8-bit 音效（可选，Web Audio API）

## 项目状态
- 当前阶段：**v4 配件版完成** — Seedream 5.0 + 38个像素配件 + 自由拖放（2026-07-06）
- 下一阶段：**测试调试** — 全流程验证 + API 联调

## 未来可优化方向
- 🔮 AI 人像分割：使用 MediaPipe Selfie Segmentation（浏览器端免费运行）
- 🔊 8-bit 音效：Web Audio API 合成方波音效
- ✨ 像素粒子特效：Canvas 粒子动画
- 🌐 部署到 GitHub Pages：方便分享给朋友使用
- 📱 PWA 支持：可安装到桌面，离线使用
- 🎨 更多配色方案和动画模板
- 🖼️ 批量处理：一次上传多张照片
- 🔧 像素级手动编辑：点击修改单个像素格颜色

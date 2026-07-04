# 像素表情包工厂 — 项目文档

## 项目概述
一个 Windows 上运行的纯静态网页应用，将照片人物转化为像素风格表情包并生成动图 GIF。
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
├── index.html              # 主页面
├── css/
│   └── pixel-theme.css     # 像素风格主题
├── js/
│   ├── app.js              # 主流程
│   ├── pixelate.js         # 像素化算法
│   ├── color-quantize.js   # 颜色量化 ✅
│   ├── animation.js        # 动画引擎
│   ├── gif-encoder.js      # GIF 编码器
│   └── nes-palette.js      # NES 调色板 ✅
├── assets/                 # 静态资源
├── CLAUDE.md               # 本文件
└── .gitignore
```

## 代码约定
- 所有变量名和函数名使用英文（驼峰命名）
- 所有注释使用中文
- 每个 JS 文件用 IIFE 或模块化方式避免全局污染
- CSS 类名使用 kebab-case
- 使用 ES6+ 语法（const/let、箭头函数、模板字符串）

## 已完成模块
- ✅ `js/nes-palette.js` — NES 56 色调色板 + 5 套配色方案
- ✅ `js/color-quantize.js` — 颜色量化算法

## 待开发模块（按阶段）
1. `index.html` + `css/pixel-theme.css` — 页面骨架 + 像素风 UI
2. `js/app.js` — 主流程控制
3. 图片上传 + 裁剪功能
4. `js/pixelate.js` — 像素化核心算法
5. 编辑控件（滑块、调色板选择）
6. `js/animation.js` — 动画引擎
7. `js/gif-encoder.js` — GIF 编码器
8. 动图预览 + 下载

## 未来可优化方向
- 🔮 AI 人像分割：使用 MediaPipe Selfie Segmentation（浏览器端免费运行）
- 🔊 8-bit 音效：Web Audio API 合成方波音效
- ✨ 像素粒子特效：Canvas 粒子动画
- 🌐 部署到 GitHub Pages：方便分享给朋友使用
- 📱 PWA 支持：可安装到桌面，离线使用
- 🎨 更多配色方案和动画模板
- 🖼️ 批量处理：一次上传多张照片
- 🔧 像素级手动编辑：点击修改单个像素格颜色

## 项目状态
- 当前阶段：**阶段 1** — HTML 骨架 + CSS 像素主题（2026-07-04）
- 下一阶段：**阶段 2** — 图片上传 + 裁剪框选

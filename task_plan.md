# 任务计划：像素表情包工厂 v3（Seedream 5.0）

## 目标
制作一个 Windows 上双击 index.html 即可运行的纯静态网页，功能：上传照片 → 配置提示词 → Seedream 5.0 AI 生成像素图 → 添加动画 → 导出 GIF。全中文界面，NES 8-bit 像素风。

## 当前阶段
阶段 4：测试调试 + API 联调

## 各阶段

### 阶段 0：环境配置
- [x] 初始化 Git 仓库
- [x] 创建 .gitignore
- [x] 编写 CLAUDE.md 项目文档
- [x] 建立任务规划体系
- **状态：** complete

### 阶段 1：HTML 骨架 + CSS 像素主题
- [x] 创建 index.html 主页面结构
- [x] 编写 css/pixel-theme.css 像素风主题
- [x] 实现 4 步骤标签切换框架
- [x] 响应式布局
- **状态：** complete

### 阶段 2：图片上传 + 裁剪（已废弃）
- [x] 拖拽上传 / 点击上传 / Ctrl+V 粘贴
- [x] Canvas 裁剪交互
- **状态：** deprecated（v3 中已移除裁剪步骤）

### 阶段 3：Seedream 5.0 v3 重构
- [x] js/seedream-api.js — API 封装 + 图片压缩 + base64 响应
- [x] js/prompt-templates.js — 6套提示词模板
- [x] js/animation-engine.js — 6种动画帧生成器
- [x] js/gif-encoder.js — GIF89a + LZW 压缩
- [x] 重写 index.html + js/app.js
- [x] 更新 css/pixel-theme.css
- [x] 删除 5 个不再需要的旧文件
- [x] 更新项目文档
- **状态：** complete

### 阶段 4：测试调试 + API 联调
- [ ] 在浏览器中打开 index.html
- [ ] 测试上传流程
- [ ] 测试提示词模板切换
- [ ] 调用 Seedream API 生成像素图
- [ ] 测试动画预览
- [ ] 测试 GIF 导出
- [ ] 修复发现的问题
- **状态：** pending

### 阶段 5：风格打磨
- [ ] 动画细节优化（眼睛检测精度等）
- [ ] 提示词效果调优
- [ ] 像素风 UI 细节完善
- **状态：** future

## 已做决策
| 决策 | 理由 |
|------|------|
| 纯静态网页，零依赖 | 用户是代码小白，双击即用最简单 |
| Seedream 5.0 替代 Gemini | 图生图直接生成像素图，效果更好 |
| 去掉手动裁剪 | AI 自动识别，用户体验更好 |
| b64_json 响应格式 | 兼容 file:// 协议，避免 CORS 问题 |
| 自写 GIF 编码器 | 零依赖，符合项目约束 |
| API Key 前端硬编码 | 个人使用，可接受 |

## 关键风险
1. Seedream API 跨域 — 使用 b64_json 规避；如 API 无 CORS 头则需回退
2. LZW 压缩正确性 — GIF 编码器需实测验证
3. 生成时间 — 5-30秒，需充分 loading 状态

## 备注
- 随着进度更新阶段状态：pending → in_progress → complete
- 做重大决策前重新读取此计划
- 记录所有错误，避免重复

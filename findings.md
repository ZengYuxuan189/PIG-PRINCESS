# 发现与决策

## 需求
- 用户是代码小白，需要极简运行方式（双击即用）
- Windows 平台，浏览器运行
- 上传照片 → 像素化人物 → 生成动图 GIF
- 任天堂 NES 8-bit 像素风格
- 全中文界面
- 输出便于保存（GIF 下载到本地）

## 研究发现

### NES 调色板
- NES PPU 2C02 硬件生成 64 色（8 个重复/黑色 → 实际 56 色）
- 颜色基于 YUV 色彩空间，通过特定电压值映射
- 已整理为 js/nes-palette.js，含 5 套配色方案

### 颜色量化算法
- 使用加权欧几里得距离（考虑人眼对不同波长的敏感度）
- 红色均值权重公式：`(2 + rMean/256) * ΔR² + 4 * ΔG² + (2 + (255-rMean)/256) * ΔB²`
- 已实现为 js/color-quantize.js

### GIF 文件格式
- 需要实现：Header + Logical Screen Descriptor + Global Color Table + Application Extension + Graphic Control Extension + Image Descriptor + LZW 压缩数据 + Trailer
- LZW 压缩是核心难点：需要可变长度编码（最小 2 bits，最大 12 bits），Clear Code 和 End Code
- GIF89a 支持动画（通过 Graphic Control Extension 设置帧延迟）

### 像素化渲染方案
- 流程：缩小图片 → 取平均色 → 颜色量化 → 放大绘制
- Canvas 的 `imageSmoothingEnabled = false` 可以实现最近邻插值
- 也可以用离屏 Canvas 手动采样每个像素块

## 技术决策
| 决策 | 理由 |
|------|------|
| 纯静态网页 | 双击即用，零安装 |
| 零外部依赖 | 兼容 file:// 协议，离线可用 |
| Canvas 2D API | 浏览器原生，性能足够 |
| 自写 GIF 编码器 | 不依赖 CDN，完全自包含 |
| 手动框选裁剪 | 简单可靠，AI 后期再加 |
| NES 56 色调色板 | 经典 8-bit 风格 |
| 单页应用（步骤切换） | 无需页面跳转，体验流畅 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 微信小程序方案用户推翻 | 改为纯网页方案，更适合用户需求 |
| 用户要求一个阶段一个阶段来 | 暂停批量开发，转为阶段性推进 |

## 资源
- NES 调色板参考：https://www.nesdev.org/wiki/Palette
- GIF89a 规范：https://www.w3.org/Graphics/GIF/spec-gif89a.txt
- Canvas API：https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API

## 视觉/浏览器发现
<!-- 关键：每执行2次查看/浏览器操作后必须更新此部分 -->
- 暂无（尚未开始浏览器预览）

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*

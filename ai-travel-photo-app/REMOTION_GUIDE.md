# Remotion 视频制作与素材下载指南

## 📦 已集成功能

本项目已经集成了以下两个功能模块：

1. **Media Downloader** - 景点素材图片下载器
2. **Remotion Video** - 营销视频创建工具

---

## 🖼️ 景点素材下载器

### 功能说明
自动从 Unsplash 下载高质量的旅游景点图片，用于应用模板制作。

### 使用步骤

#### 1. 获取 Unsplash API Key

访问 [Unsplash Developers](https://unsplash.com/developers)
1. 注册账号并登录
2. 点击 "New Application"
3. 填写应用信息
4. 获取 Access Key

#### 2. 设置环境变量

在项目根目录的 `.env` 文件中添加：

```env
UNSPLASH_ACCESS_KEY=your_access_key_here
```

#### 3. 运行下载脚本

```bash
pnpm run download:photos
```

#### 4. 下载结果

- 图片会保存到 `public/scenic-templates/` 目录
- 文件命名格式：`景点名_序号_图片ID.jpg`
- 每个景点默认下载 3 张图片

### 内置景点列表

脚本已预设 19 个热门景点：

- **长沙**：橘子洲、岳麓山、天心阁
- **北京**：天安门、故宫、长城
- **上海**：外滩、东方明珠
- **西安**：兵马俑、大雁塔
- **杭州**：西湖
- **苏州**：园林
- **成都**：宽窄巷子
- **重庆**：洪崖洞
- **桂林**：漓江
- **张家界**：天门山
- **三亚**：天涯海角
- **丽江**：古城
- **拉萨**：布达拉宫

### 自定义景点

编辑 `scripts/download-scenic-photos.ts` 文件，修改 `SCENIC_SPOTS` 数组：

```typescript
const SCENIC_SPOTS = [
  { name: '城市-景点名', keywords: 'English keywords for search' },
  // 添加更多景点...
];
```

---

## 🎬 Remotion 视频制作

### 功能说明
使用代码创建专业的营销视频，支持两种视频类型：

1. **营销宣传视频** - 展示应用功能和特色
2. **用户照片相册视频** - 将用户生成的照片制作成动态相册

### 使用步骤

#### 1. 预览视频

启动 Remotion Studio 进行实时预览和编辑：

```bash
pnpm run video:preview
```

浏览器会自动打开 `http://localhost:3000`，你可以：
- 实时预览视频效果
- 调整参数和配置
- 查看每一帧的渲染结果

#### 2. 渲染营销视频

```bash
pnpm run video:render
```

输出文件：`out/marketing-video.mp4`

默认参数：
- 标题：AI 旅拍照片
- 副标题：一键生成你的专属旅行大片
- 时长：10 秒
- 分辨率：1080x1920（竖屏）

#### 3. 渲染照片相册视频

```bash
pnpm run video:render:album
```

输出文件：`out/photo-album.mp4`

---

## 🎨 视频定制

### 修改营销视频内容

编辑 `remotion/Root.tsx`，修改 `MarketingVideo` 组件的 `defaultProps`：

```tsx
<Composition
  id="MarketingVideo"
  component={MarketingVideo}
  durationInFrames={300} // 修改时长（帧数）
  fps={30}
  width={1080}
  height={1920}
  defaultProps={{
    title: '你的标题',
    subtitle: '你的副标题',
    features: [
      '✨ 功能点 1',
      '🎯 功能点 2',
      '💎 功能点 3',
      '🚀 功能点 4',
    ],
    ctaText: '立即使用',
  }}
/>
```

### 自定义照片相册

通过代码传入照片数据：

```tsx
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const bundled = await bundle({
  entryPoint: './remotion/index.ts',
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: 'PhotoAlbumVideo',
  inputProps: {
    photos: [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg',
    ],
    username: '张三',
    location: '长沙·橘子洲',
  },
});

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: 'h264',
  outputLocation: 'out/custom-album.mp4',
});
```

---

## 🎯 视频特效说明

### 营销视频（MarketingVideo）

包含 3 个场景：

1. **场景 1：标题介绍**（0-3 秒）
   - 标题淡入 + 缩放动画
   - 副标题滑入动画
   - 渐变紫色背景

2. **场景 2：功能展示**（3-8 秒）
   - 功能点逐个滑入
   - 白色卡片悬浮效果
   - 渐变粉红背景

3. **场景 3：行动号召**（8-10 秒）
   - CTA 按钮脉冲动画
   - 扫码提示
   - 渐变橙黄背景

### 照片相册视频（PhotoAlbumVideo）

- **片头**：用户名 + 地点信息（1 秒）
- **照片轮播**：
  - 淡入淡出过渡
  - Ken Burns 效果（缓慢放大）
  - 照片序号标记
- **片尾**：应用品牌展示（1 秒）

---

## 🔧 进阶配置

### 修改视频分辨率

编辑 `remotion/Root.tsx`：

```tsx
<Composition
  width={1920}  // 横屏宽度
  height={1080} // 横屏高度
  // ...其他配置
/>
```

### 修改帧率和质量

编辑 `remotion.config.ts`：

```typescript
Config.setFrameRate(60);      // 60fps 更流畅
Config.setQuality(100);       // 最高质量
Config.setConcurrency(8);     // 更高并发（需要更好的硬件）
```

### 添加音频

在视频组件中使用 `<Audio>` 组件：

```tsx
import { Audio } from 'remotion';

<Audio src="/audio/background-music.mp3" volume={0.5} />
```

---

## 📝 注意事项

### Media Downloader

1. **API 限流**：Unsplash 免费账户有 50 次/小时的请求限制
2. **图片版权**：下载的图片遵循 Unsplash 许可，可免费商用
3. **网络要求**：需要稳定的国际网络连接

### Remotion 视频

1. **渲染性能**：视频渲染需要较好的 CPU 性能
2. **文件大小**：高质量视频文件较大，建议使用 H.264 编码
3. **浏览器支持**：Remotion Studio 需要现代浏览器（Chrome/Edge 推荐）

---

## 🚀 快速开始示例

### 完整工作流程

```bash
# 1. 下载景点素材
pnpm run download:photos

# 2. 预览营销视频
pnpm run video:preview

# 3. 渲染最终视频
pnpm run video:render

# 4. 查看输出文件
# 文件位置：out/marketing-video.mp4
```

---

## 📚 参考资源

- [Unsplash API 文档](https://unsplash.com/documentation)
- [Remotion 官方文档](https://www.remotion.dev/docs)
- [Remotion 示例库](https://www.remotion.dev/showcase)
- [Remotion 最佳实践](https://www.remotion.dev/docs/best-practices)

---

## 🆘 常见问题

### Q: 下载脚本报错 "请先设置 UNSPLASH_ACCESS_KEY"

A: 检查 `.env` 文件是否正确配置了 API Key。

### Q: Remotion Studio 无法打开

A: 确保端口 3000 未被占用，或修改 Remotion 配置使用其他端口。

### Q: 视频渲染很慢

A: 降低并发数（`Config.setConcurrency(2)`）或降低视频分辨率。

### Q: 照片相册视频显示 "暂无照片"

A: 确保传入了有效的 `photos` 数组参数。

---

## 💡 技巧与建议

1. **素材优化**：下载的图片建议压缩后再使用，提高加载速度
2. **视频预览**：使用 Remotion Studio 实时预览，避免反复渲染
3. **批量生成**：编写脚本批量生成用户照片相册视频
4. **云端渲染**：使用 Remotion Lambda 实现云端并行渲染，大幅提升速度

---

**祝你使用愉快！🎉**

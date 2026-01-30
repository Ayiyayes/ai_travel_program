# AI旅拍项目 - 全局README

本项目包含三部分：后端服务 + 管理后台（同一套应用）、微信小程序前端。本文档用于帮助开发者在本地快速复现与启动。

---

## 目录结构

```
ai_travel_program/
  ai-travel-photo-app/   # 后端服务 + 管理后台
  wx-miniapp/            # 微信小程序前端
  ai_travel_前端功能梳理.md
  ai_travel_需求文档.md
  TROUBLESHOOTING.md
```

---

## 技术栈概览

- 后端：Node.js + Express + tRPC + Drizzle ORM + MySQL
- 管理后台：Vite + React
- 小程序：微信小程序原生（WXML/WXSS/JS）
- 存储：本地 / 腾讯云 COS（可切换）
- 其他：WebSocket、Coze 接口、腾讯地图

---

## 环境要求

- Node.js 18+（建议 20+）
- pnpm 10+
- MySQL 8+
- 微信开发者工具（用于小程序）

---

## 一键启动（推荐）

首次运行会自动生成 `.env` 并提示输入 MySQL 连接信息（直接回车使用默认值即可）。如果本机已安装 `mysql` 客户端，脚本会尝试自动创建数据库。

**macOS / Linux：**
```
bash start.sh
```

**Windows：**
```
start.bat
```

启动后：
- 管理后台地址：`http://localhost:3000/admin`
- API 基地址：`http://localhost:3000`

开发环境超级管理员登录入口：
```
http://localhost:3000/api/dev/super-admin/login
```

如果浏览器阻止 HttpOnly Cookie 或无法登录，可在开发环境开启管理员绕过（仅本地调试）：
```
DEV_ADMIN_BYPASS=true
```

---

## 手动启动（后端 + 管理后台）

### 1）进入后端目录

```
cd ai-travel-photo-app
```

### 2）安装依赖

```
pnpm install
```

### 3）准备数据库

确保 MySQL 已运行，并创建数据库：

```
CREATE DATABASE ai_travel DEFAULT CHARSET utf8mb4;
```

### 4）配置环境变量

在 `ai-travel-photo-app/.env` 填写以下关键配置（示例字段，**请替换为你的真实值**）。也可以运行 `node scripts/init-env.mjs` 生成 `.env` 模板：

```
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/ai_travel
JWT_SECRET=your-secret
TENCENT_MAP_API_KEY=your-key
STORAGE_TYPE=local   # local 或 cloud
DEV_ADMIN_BYPASS=false

COS_SECRET_ID=...
COS_SECRET_KEY=...
COS_BUCKET=...
COS_REGION=...
```

### 5）执行数据库迁移

```
pnpm run db:push
```

### 6）启动服务（一键启动）

```
pnpm run dev
```

启动后：
- 管理后台地址：`http://localhost:3000/admin`
- API 基地址：`http://localhost:3000`

---

## 微信小程序启动

### 1）打开小程序项目

用微信开发者工具打开目录：`wx-miniapp`

### 2）配置 API 地址

在 `wx-miniapp/app.js` 中修改：

```
apiBaseUrl: 'http://localhost:3000'
```

### 3）开发者工具设置

开发阶段请关闭合法域名校验：
```
详情 → 本地设置 → 勾选“不校验合法域名、web-view、TLS 版本”
```

---

## 模板导入与显示（后台 → 小程序）

### 1）导入模板图片
进入后台 **模板配置**：
1. 点击“导入文件夹”
2. 等待上传完成（必须看到 X/X 成功）
3. 点击“生成模板ID”
4. 点击“保存模板库”

> 注意：仅“导入”不会写入模板库，必须“保存模板库”才会进数据库。

### 2）人群类型代码一致性
后台导入会使用人群类型代码（如 `girl_young`）。  
请确保数据库的 `groupTypes.code` 与导入的人群类型一致，否则小程序会显示为空。

### 3）刷新模板缓存
如果小程序还是旧图，可手动提升模板版本：
```sql
UPDATE systemConfigs
SET configValue = CAST(configValue AS UNSIGNED) + 1
WHERE configKey='template_version';
```
然后在微信开发者工具中“清除缓存并重启”。

---

## 生成能力依赖（拍照后生成失败时必读）

生成链路依赖 Coze 与公网可访问图片：

### 必需配置（Coze）
```
COZE_API_KEY=你的key
COZE_BOT_ID=可选（如工作流需要）
COZE_SINGLE_FACE_WORKFLOW_ID=...
COZE_DOUBLE_FACE_WORKFLOW_ID=...
COZE_USER_ANALYZE_WORKFLOW_ID=...
```

### 存储建议
本地存储（`STORAGE_TYPE=local`）的图片无法被 Coze 访问。  
要跑通真实生成，建议使用 COS（`STORAGE_TYPE=cloud`）。

---

## 一键启动（GitHub 复现建议）

开发者从 GitHub 拉取后，执行以下命令即可快速启动（后端 + 管理后台）：

```
bash start.sh   # macOS / Linux
start.bat    # Windows
```

小程序部分需通过微信开发者工具打开 `wx-miniapp` 目录运行。

---

## 常见问题

如遇启动失败、接口报错、权限/域名问题，请查看：

- `TROUBLESHOOTING.md`
- `ai_travel_前端功能梳理.md`
- `ai_travel_需求文档.md`

---

## 备注

- 若启用云存储（`STORAGE_TYPE=cloud`），请确保 COS 配置完整且可用  
- AI 换脸依赖 Coze 额度与密钥配置  
- P8 景点/人群类型乱码问题通常为编码不一致，请确保相关文件统一使用 UTF-8  

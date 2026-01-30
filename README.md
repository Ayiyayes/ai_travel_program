# AI旅拍项目 - 全局README

本项目包含三部分：后端服务 + 管理后台（同一套应用）、微信小程序前端。本文档用于帮助开发者在本地快速复现与启动。

---

## 目录结构

```
ai_travel_code_20260112/
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

## 快速启动（后端 + 管理后台）

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

在 `ai-travel-photo-app/.env` 填写以下关键配置（示例字段，**请替换为你的真实值**）：

```
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/ai_travel
JWT_SECRET=your-secret
TENCENT_MAP_API_KEY=your-key
STORAGE_TYPE=local   # local 或 cloud

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

## 一键启动（GitHub 复现建议）

开发者从 GitHub 拉取后，执行以下命令即可快速启动（后端 + 管理后台）：

```
cd ai-travel-photo-app
pnpm install
pnpm run db:push
pnpm run dev
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


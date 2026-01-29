# 城市和景点管理功能故障排查指南

## 问题描述
后台管理系统中，新增城市和景点时出现 "Failed to fetch" 错误。

## 错误截图分析
- 表单显示：城市名称输入框、拼音自动生成框
- 错误信息：页面右下角显示 "Failed to fetch"
- 状态：提交时网络请求失败

---

## 原因分析

### 1. 后端服务器未运行
**症状**：
- TRPC API 无法访问
- 浏览器控制台显示网络错误
- 所有API请求都失败

**检查方法**：
```bash
# 检查3000端口是否被占用
netstat -ano | findstr ":3000"

# 检查Node进程
tasklist | findstr "node"
```

### 2. 数据库连接失败
**症状**：
- 服务器启动但API调用返回错误
- 后端日志显示数据库连接错误

**数据库配置**（位于 `.env` 文件）：
```
DATABASE_URL=mysql://root:bademan2025@localhost:3306/ai_travel
```

**检查方法**：
```bash
# 检查MySQL服务是否运行
net start | findstr "MySQL"

# 或者尝试连接数据库
mysql -u root -pbademan2025 -e "USE ai_travel; SHOW TABLES;"
```

### 3. CORS跨域问题
如果前端和后端运行在不同域名/端口，可能存在跨域限制。

### 4. 权限问题
管理员路由使用 `adminProcedure`，需要：
- 用户已登录
- 用户角色为 `admin`

---

## 解决方案

### 步骤1：启动MySQL数据库

**Windows系统**：
```bash
# 启动MySQL服务
net start MySQL80
# 或
net start MySQL

# 检查服务状态
sc query MySQL80
```

**检查数据库是否存在**：
```bash
mysql -u root -pbademan2025 -e "SHOW DATABASES LIKE 'ai_travel';"
```

如果数据库不存在，需要创建并运行迁移：
```bash
cd F:\AI拍照玩偶素材内容\软件开发代码\ai_travel_code_20260112\ai-travel-photo-app
pnpm run db:push
```

---

### 步骤2：启动后端服务器

在项目根目录 `ai-travel-photo-app` 下运行：

```bash
cd F:\AI拍照玩偶素材内容\软件开发代码\ai_travel_code_20260112\ai-travel-photo-app

# 安装依赖（如果还未安装）
pnpm install

# 启动开发服务器
pnpm run dev
```

**预期输出**：
```
Server running on http://localhost:3000/
```

**如果端口被占用**：
- 服务器会自动尝试使用3001、3002等端口
- 控制台会显示实际使用的端口

---

### 步骤3：确认管理员权限

**开发环境快速登录**：

浏览器访问：
```
http://localhost:3000/api/dev/super-admin/login
```

这会自动创建超级管理员账户并登录（仅开发环境可用）。

**检查当前用户权限**：
在浏览器开发者工具的Console中执行：
```javascript
// 查看Cookie中的会话
document.cookie

// 或者调用API检查当前用户
fetch('/api/trpc/auth.me')
  .then(r => r.json())
  .then(console.log)
```

---

### 步骤4：测试API连接

**在浏览器开发者工具的Network标签中检查**：

1. 刷新管理页面
2. 查看是否有 `/api/trpc` 的请求
3. 检查请求状态码：
   - `200`: 正常
   - `401`: 未登录或权限不足
   - `403`: 权限被拒绝（非管理员）
   - `500`: 服务器内部错误（可能是数据库问题）
   - `Failed to fetch`: 服务器未运行或无法访问

**手动测试API**：

在浏览器Console中执行：
```javascript
// 测试创建城市API
fetch('/api/trpc/admin.createCity', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    name: "测试城市",
    pinyin: "ceshichengshi"
  })
}).then(r => r.json()).then(console.log).catch(console.error)
```

---

### 步骤5：检查环境配置

确保 `.env` 文件配置正确：

**位置**：`ai-travel-photo-app/.env`

**必需配置**：
```env
# 数据库连接
DATABASE_URL=mysql://root:bademan2025@localhost:3306/ai_travel

# JWT密钥
JWT_SECRET=dummy-secret

# 超级管理员OpenID（开发环境）
OWNER_OPEN_ID=local-super-admin

# OAuth服务器（开发环境可用dummy值）
OAUTH_SERVER_URL=http://localhost:3000
VITE_OAUTH_PORTAL_URL=http://localhost:3000
VITE_APP_ID=dummy-app-id

# 腾讯地图API Key（用于景点经纬度查询）
TENCENT_MAP_API_KEY=你的腾讯地图API密钥
```

**注意**：
- 如果没有腾讯地图API Key，景点经纬度自动获取功能将无法使用
- 但手动输入经纬度仍然可以工作

---

## 完整的启动流程

### 方式一：正常开发流程

**终端1 - 启动开发服务器**：
```bash
cd F:\AI拍照玩偶素材内容\软件开发代码\ai_travel_code_20260112\ai-travel-photo-app
pnpm run dev
```

这个命令会同时启动：
- Express后端服务器（处理TRPC API）
- Vite开发服务器（热重载前端代码）

**浏览器**：
1. 访问 `http://localhost:3000`
2. 先访问 `http://localhost:3000/api/dev/super-admin/login` 登录为管理员
3. 访问 `http://localhost:3000/admin` 进入管理后台

---

## 故障排查清单

### ✅ 检查项清单

- [ ] MySQL服务已启动
- [ ] 数据库 `ai_travel` 已创建
- [ ] 数据库表已通过迁移创建（`pnpm run db:push`）
- [ ] `.env` 文件存在且配置正确
- [ ] `pnpm install` 已完成
- [ ] 后端服务器已启动（`pnpm run dev`）
- [ ] 已通过开发登录接口获得管理员权限
- [ ] 浏览器控制台无CORS错误
- [ ] Network标签显示 `/api/trpc` 请求返回200

---

## 常见错误及解决方案

### 错误1：`Failed to fetch`

**原因**：后端服务器未启动或无法访问

**解决**：
```bash
cd ai-travel-photo-app
pnpm run dev
```

---

### 错误2：`需要管理员权限` (403 Forbidden)

**原因**：当前用户不是管理员

**解决**：
访问 `http://localhost:3000/api/dev/super-admin/login` 重新登录

---

### 错误3：`Cannot connect to database`

**原因**：MySQL服务未启动或数据库不存在

**解决**：
```bash
# 启动MySQL
net start MySQL80

# 创建数据库和表
cd ai-travel-photo-app
pnpm run db:push
```

---

### 错误4：`Port 3000 is already in use`

**原因**：端口被占用

**解决方案A - 自动使用其他端口**：
服务器会自动尝试3001、3002等端口，查看控制台输出的实际端口号

**解决方案B - 手动指定端口**：
```bash
PORT=4000 pnpm run dev
```

**解决方案C - 释放端口**：
```bash
# 查找占用进程
netstat -ano | findstr ":3000"

# 结束进程（替换PID）
taskkill /PID <进程ID> /F
```

---

## 代码结构说明

### 前端代码
**文件**：`client/src/pages/admin/CitySpots.tsx`

**关键功能**：
- 城市列表展示和管理
- 景点列表展示和管理（可按城市筛选）
- 新增/编辑/删除城市
- 新增/编辑/删除景点
- 自动拼音生成（使用 `pinyin-pro` 库）
- 腾讯地图API获取景点经纬度

### 后端API路由
**文件**：`server/routers.ts`

**城市管理端点**：
- `admin.cities` - 查询所有城市
- `admin.createCity` - 创建城市
- `admin.updateCity` - 更新城市
- `admin.deleteCity` - 删除城市

**景点管理端点**：
- `admin.spots` - 查询景点（可按城市筛选）
- `admin.createSpot` - 创建景点
- `admin.updateSpot` - 更新景点
- `admin.deleteSpot` - 删除景点

**地图服务端点**：
- `map.searchLocation` - 使用腾讯地图API查询经纬度

### 数据库操作
**文件**：`server/db.ts`

**表结构**：
```typescript
// 城市表
cities {
  id: number (主键)
  name: string (唯一)
  pinyin: string
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}

// 景点表
spots {
  id: number (主键)
  name: string
  cityId: number (外键 -> cities.id)
  latitude: decimal(10,7)
  longitude: decimal(10,7)
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## 验证修复成功

### 测试步骤

1. **测试新增城市**：
   - 点击"新增城市"按钮
   - 输入城市名称（如"长沙"）
   - 查看拼音自动生成（changsha）
   - 点击"创建"
   - ✅ 应该显示"城市创建成功"
   - ✅ 城市列表应该更新

2. **测试新增景点**：
   - 点击景点列表的"新增景点"
   - 选择城市
   - 输入景点名称
   - （可选）点击"获取经纬度"自动填充
   - 或手动输入经纬度
   - 点击"创建"
   - ✅ 应该显示"景点创建成功"
   - ✅ 景点列表应该更新

3. **测试更新和删除**：
   - 点击城市/景点的"编辑"按钮
   - 修改信息后保存
   - ✅ 应该显示更新成功
   - 点击"删除"按钮（带确认对话框）
   - ✅ 应该显示删除成功

---

## 技术栈说明

### 前端
- **框架**：React 19 + TypeScript
- **API通信**：TRPC + TanStack Query
- **UI组件**：Radix UI + Tailwind CSS
- **表单管理**：React Hook Form
- **提示消息**：Sonner (Toast)
- **拼音转换**：pinyin-pro

### 后端
- **运行时**：Node.js + Express
- **API框架**：TRPC
- **数据库**：MySQL + Drizzle ORM
- **认证**：JWT + Cookie
- **地图API**：腾讯地图Web服务API

### 开发工具
- **构建工具**：Vite 7
- **包管理器**：pnpm
- **热重载**：tsx watch

---

## 需要帮助？

如果按照以上步骤仍然无法解决问题，请检查：

1. **浏览器控制台错误信息**（F12 -> Console标签）
2. **网络请求详情**（F12 -> Network标签）
3. **后端服务器日志**（运行 `pnpm run dev` 的终端输出）
4. **数据库连接**（查看后端日志中的数据库错误）

收集以上信息后，可以更准确地诊断问题。

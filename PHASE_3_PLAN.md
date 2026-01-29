# AI旅拍照片应用 - 第三阶段开发计划

## 📊 项目现状总结

根据对需求文档和现有代码的深入分析，当前项目实现度为 **78%**：

| 评估维度 | 评分 | 说明 |
|---------|------|------|
| 页面完整性 | 8.5/10 | 12个页面全部存在，文件结构完整 |
| 功能实现度 | 7.5/10 | 核心流程完整，但部分功能不完整 |
| 跳转流程 | 8.0/10 | 新用户/老用户流程正确，分享流程需修复 |
| API集成 | 8.0/10 | 大部分API已集成，个别API缺失 |
| 数据管理 | 8.5/10 | 本地存储和WebSocket实现完善 |
| 代码质量 | 7.5/10 | 结构清晰，缺少错误处理 |

---

## 🎯 第三阶段目标

**核心目标：** 修复缺陷，完善功能，提升用户体验，达到 **95%** 需求实现度

**预计工期：** 5-7 个工作日

---

## 📋 开发任务清单

### 阶段 3.1：关键缺陷修复（P0优先级）⚠️

#### 任务 3.1.1：修复P9分享好友详情页（必须）
**问题描述：** P9功能不完整，仅支持orderId参数，无法处理好友分享照片/模板场景

**需求对照：**
```
需求：好友分享照片/模板的着陆页
- 点击好友分享的照片结果页 → 显示照片详情 → 导购到P1/P8
- 点击好友分享的模板详情页 → 显示模板详情 → 导购到P2
```

**当前实现：**
- ✓ orderId参数方式（基础功能）
- ✗ photoId参数处理
- ✗ templateId参数处理
- ✗ shareType参数区分

**开发任务：**
1. 修改 `share.js`，支持多种参数：
   ```javascript
   // URL参数格式：
   // 分享照片：?photoId=xxx&shareType=photo
   // 分享模板：?templateId=xxx&shareType=template
   // 分享订单：?orderId=xxx&shareType=order
   ```

2. 根据 shareType 加载不同数据：
   - `shareType=photo`：调用 `photo.getById(photoId)` 获取照片详情
   - `shareType=template`：调用 `template.getById(templateId)` 获取模板详情
   - `shareType=order`：调用 `mp.getOrderById(orderId)` 获取订单详情

3. 实现导购逻辑：
   ```javascript
   // 新用户：跳转P1（通用模板页）
   // 老用户：跳转P8（付费模板页）
   // 直接拍同款：跳转P2（模板详情页）
   ```

4. 更新 `share.wxml`，根据 shareType 显示不同UI：
   - 照片分享：显示照片预览 + "拍同款"按钮
   - 模板分享：显示模板预览 + "立即拍摄"按钮
   - 订单分享：显示订单信息

5. 更新 P6 结果页的分享逻辑：
   ```javascript
   // 修改 onShareAppMessage
   path: `/pages/share/share?photoId=${photoId}&shareType=photo`
   ```

**涉及文件：**
- `wx-miniapp/pages/share/share.js`
- `wx-miniapp/pages/share/share.wxml`
- `wx-miniapp/pages/share/share.wxss`
- `wx-miniapp/pages/result/result.js`（分享逻辑）
- `wx-miniapp/utils/api.js`（添加photo.getById API）

**预计工时：** 1.5天

---

#### 任务 3.1.2：修复后端API缺失问题
**问题描述：** P8付费模板页调用了 `templateApi.getCities()` 但该API未定义

**开发任务：**
1. 检查后端是否有 `template.getCities` 路由
2. 如果没有，添加该API：
   ```typescript
   // server/routers.ts
   template: {
     getCities: publicProcedure.query(async () => {
       return await db.getActiveCities();
     }),
   }
   ```

3. 检查 `wx-miniapp/utils/api.js`，补充定义：
   ```javascript
   getCities: () => request('/api/trpc/template.getCities', 'GET'),
   ```

4. 验证P8页面是否正常加载城市列表

**涉及文件：**
- `server/routers.ts`
- `wx-miniapp/utils/api.js`
- `wx-miniapp/pages/paid-templates/paid-templates.js`

**预计工时：** 0.5天

---

### 阶段 3.2：重要功能完善（P1优先级）

#### 任务 3.2.1：完善P4权限提醒页
**问题描述：** P4仅实现了摄像头权限提醒，缺少位置和相册权限提醒

**需求对照：**
```
1. 二次位置授权提醒
2. 二次摄像头授权提醒 ✓ 已实现
3. 二次保存相册授权提醒
```

**开发任务：**
1. 扩展 `camera-permission.js`，支持权限类型参数：
   ```javascript
   // URL参数：?type=camera / location / album
   onLoad(options) {
     this.setData({ permissionType: options.type || 'camera' });
   }
   ```

2. 根据权限类型加载不同的提醒配置：
   ```javascript
   const permissionConfig = {
     camera: {
       title: '开启摄像头权限',
       image: 'camera_permission_guide',
       buttonText: '继续授权开启摄像头',
       apiName: 'scope.camera'
     },
     location: {
       title: '开启位置权限',
       image: 'location_permission_guide',
       buttonText: '继续授权开启位置',
       apiName: 'scope.userLocation'
     },
     album: {
       title: '开启相册权限',
       image: 'album_permission_guide',
       buttonText: '继续授权保存相册',
       apiName: 'scope.writePhotosAlbum'
     }
   };
   ```

3. 实现权限请求逻辑：
   ```javascript
   requestPermission() {
     const { apiName } = this.data.config;
     wx.authorize({
       scope: apiName,
       success: () => this.navigateBack(),
       fail: () => this.openSettings()
     });
   }
   ```

4. 更新其他页面的权限检查逻辑：
   - P1/P2：位置权限 → 跳转 `camera-permission?type=location`
   - P6：相册权限 → 跳转 `camera-permission?type=album`

5. 添加权限提醒图片（从后台配置加载）

**涉及文件：**
- `wx-miniapp/pages/camera-permission/camera-permission.js`
- `wx-miniapp/pages/camera-permission/camera-permission.wxml`
- `wx-miniapp/pages/index/index.js`（P1）
- `wx-miniapp/pages/result/result.js`（P6）

**预计工时：** 1天

---

#### 任务 3.2.2：优化P5生成等待页UI体验
**问题描述：** P5缺少倒计时、模板轮播、IP气泡对话等功能

**需求对照：**
```
1. 全屏虚化模糊显示模板图片，多张轮播 ✗
2. 顶部进度信息 - 倒计时显示 "预计剩余30秒" ✗
3. 中间进度条 - "正在生成第1/5张" ✗
4. 底部IP图标形象+气泡说话框 ✗
```

**开发任务：**
1. 添加倒计时逻辑：
   ```javascript
   // 根据照片数量计算总时长（每张5秒）
   const totalSeconds = templateCount * 5;

   // 倒计时定时器
   countdownTimer: setInterval(() => {
     if (remainingSeconds > 0) {
       this.setData({ remainingSeconds: remainingSeconds - 1 });
     }
   }, 1000)
   ```

2. 实现模板轮播：
   ```javascript
   // 3秒切换一次模板背景
   carouselTimer: setInterval(() => {
     const nextIndex = (currentIndex + 1) % templates.length;
     this.setData({ currentTemplateIndex: nextIndex });
   }, 3000)
   ```

3. 添加进度文字提示：
   ```xml
   <view class="progress-text">
     正在生成第 {{completedCount + 1}}/{{totalCount}} 张
   </view>
   ```

4. 添加IP气泡对话框：
   ```javascript
   // 随机文案数组
   const bubbleTexts = [
     "宝子，再等会,你的照片马上就到你手机里啦！",
     "看小姐姐五官清秀，让我猜猜看，小姐姐是湖南的吧？",
     "我刚刚用AI颜值测评器测了下你的颜值，评分很高哎95分！"
   ];

   // 每10秒切换一次气泡文案
   bubbleTimer: setInterval(() => {
     const randomText = bubbleTexts[Math.floor(Math.random() * bubbleTexts.length)];
     this.setData({ bubbleText: randomText });
   }, 10000)
   ```

5. 更新 `generating.wxml`，添加UI组件：
   ```xml
   <!-- 背景轮播 -->
   <image class="bg-template blur" src="{{templates[currentTemplateIndex].imageUrl}}" mode="aspectFill" />

   <!-- 倒计时 -->
   <view class="countdown">预计剩余 {{remainingSeconds}} 秒</view>

   <!-- 进度文字 -->
   <view class="progress-text">正在生成第 {{completedCount + 1}}/{{totalCount}} 张</view>

   <!-- IP气泡 -->
   <view class="ip-bubble">
     <image class="ip-avatar" src="{{ipImageUrl}}" />
     <view class="bubble">{{bubbleText}}</view>
   </view>
   ```

6. 添加虚化模糊CSS效果：
   ```css
   .bg-template.blur {
     filter: blur(20px);
     opacity: 0.6;
   }
   ```

**涉及文件：**
- `wx-miniapp/pages/generating/generating.js`
- `wx-miniapp/pages/generating/generating.wxml`
- `wx-miniapp/pages/generating/generating.wxss`

**预计工时：** 1.5天

---

### 阶段 3.3：功能增强（P2优先级）

#### 任务 3.3.1：P8付费模板页 - 景点筛选功能
**问题描述：** P8只支持城市筛选，缺少景点筛选

**开发任务：**
1. 在筛选栏添加"景点"选择器：
   ```xml
   <picker bindchange="onSpotChange" value="{{spotIndex}}" range="{{spots}}" range-key="name">
     <view class="picker">景点: {{currentSpot.name || '全部'}}</view>
   </picker>
   ```

2. 添加景点加载逻辑：
   ```javascript
   // 根据选中城市加载景点列表
   loadSpots(cityId) {
     spotApi.getByCity(cityId).then(spots => {
       this.setData({ spots: [{ id: null, name: '全部' }, ...spots] });
     });
   }
   ```

3. 更新模板加载，支持景点筛选：
   ```javascript
   loadTemplates() {
     const { cityId, spotId, groupType } = this.data;
     templateApi.list({ cityId, spotId, groupType }).then(templates => {
       this.setData({ templates });
     });
   }
   ```

4. 添加后端API（如果不存在）：
   ```typescript
   // server/routers.ts
   spot: {
     getByCity: publicProcedure
       .input(z.object({ cityId: z.number() }))
       .query(async ({ input }) => {
         return await db.getSpotsByCity(input.cityId);
       }),
   }
   ```

**涉及文件：**
- `wx-miniapp/pages/paid-templates/paid-templates.js`
- `wx-miniapp/pages/paid-templates/paid-templates.wxml`
- `wx-miniapp/utils/api.js`
- `server/routers.ts`

**预计工时：** 1天

---

#### 任务 3.3.2：P8付费模板页 - 多选模板和支付功能
**问题描述：** P8缺少多选模板和支付流程

**需求对照：**
```
1. 用户勾选模板，底部购物车显示
2. 点击"拍照留念"调起支付
3. 支付完成后批量生成照片
```

**开发任务：**
1. 实现模板多选逻辑：
   ```javascript
   toggleTemplateSelect(e) {
     const { id } = e.currentTarget.dataset;
     const { selectedTemplates } = this.data;

     if (selectedTemplates.includes(id)) {
       // 取消选中
       selectedTemplates = selectedTemplates.filter(tid => tid !== id);
     } else {
       // 选中
       selectedTemplates.push(id);
     }

     this.setData({ selectedTemplates });
     this.calculateTotal();
   }
   ```

2. 计算总价和积分抵扣：
   ```javascript
   calculateTotal() {
     const { selectedTemplates, templates, userPoints } = this.data;

     const selectedObjs = templates.filter(t => selectedTemplates.includes(t.id));
     const totalPoints = selectedObjs.reduce((sum, t) => sum + t.price, 0);
     const deductPoints = Math.min(userPoints, totalPoints);
     const payAmount = (totalPoints - deductPoints) * 1; // 1积分=1元

     this.setData({ totalPoints, deductPoints, payAmount });
   }
   ```

3. 实现支付流程：
   ```javascript
   async handlePay() {
     const { selectedTemplates, payAmount } = this.data;

     if (payAmount === 0) {
       // 积分完全抵扣，直接创建订单
       await this.createOrder();
     } else {
       // 调起微信支付
       const paymentResult = await payment.createPayment({
         templateIds: selectedTemplates,
         totalAmount: payAmount
       });

       // 调用wx.requestPayment
       wx.requestPayment({
         ...paymentResult,
         success: () => this.createOrder(),
         fail: () => wx.showToast({ title: '支付失败', icon: 'none' })
       });
     }
   }
   ```

4. 创建订单并跳转生成页：
   ```javascript
   async createOrder() {
     const { selectedTemplates } = this.data;

     // 创建订单
     const order = await orderApi.create({ templateIds: selectedTemplates });

     // 跳转到生成页
     wx.navigateTo({
       url: `/pages/generating/generating?orderId=${order.id}`
     });
   }
   ```

5. 更新 `paid-templates.wxml`，添加底部购物车：
   ```xml
   <view class="cart-bar" wx:if="{{selectedTemplates.length > 0}}">
     <image class="ip-avatar" src="{{ipImageUrl}}" />
     <view class="cart-info">
       <text>共消耗积分{{totalPoints}}</text>
       <text>已抵扣{{deductPoints}}分</text>
       <text>到手仅支付{{payAmount}}￥</text>
     </view>
     <button class="pay-btn" bindtap="handlePay">拍照留念</button>
   </view>
   ```

**涉及文件：**
- `wx-miniapp/pages/paid-templates/paid-templates.js`
- `wx-miniapp/pages/paid-templates/paid-templates.wxml`
- `wx-miniapp/pages/paid-templates/paid-templates.wxss`
- `wx-miniapp/utils/payment.js`
- `wx-miniapp/utils/api.js`

**预计工时：** 2天

---

#### 任务 3.3.3：P1通用模板页 - 位置授权和推荐
**问题描述：** P1缺少位置授权流程和基于位置的模板推荐

**需求对照：**
```
首次点选模板触发位置授权：
- 用户确认授权位置：跳转P2
- 用户取消授权位置：回到P1页，用户再次点选模板进入P2
```

**开发任务：**
1. 在点击模板时检查位置权限：
   ```javascript
   onTemplateClick(e) {
     const { id } = e.currentTarget.dataset;

     // 检查位置权限
     wx.getSetting({
       success: (res) => {
         if (!res.authSettings['scope.userLocation']) {
           // 请求位置授权
           wx.authorize({
             scope: 'scope.userLocation',
             success: () => this.navigateToDetail(id),
             fail: () => {
               // 用户拒绝，提示但仍允许进入
               wx.showModal({
                 title: '提示',
                 content: '授权位置可获得更精准的景点推荐',
                 confirmText: '继续',
                 success: (res) => {
                   if (res.confirm) this.navigateToDetail(id);
                 }
               });
             }
           });
         } else {
           // 已授权，直接进入
           this.navigateToDetail(id);
         }
       }
     });
   }
   ```

2. 获取位置并保存：
   ```javascript
   getLocation() {
     wx.getLocation({
       type: 'wgs84',
       success: (res) => {
         const { latitude, longitude } = res;
         wx.setStorageSync('userLocation', { latitude, longitude });
       }
     });
   }
   ```

**涉及文件：**
- `wx-miniapp/pages/index/index.js`

**预计工时：** 0.5天

---

### 阶段 3.4：优化增强（P3优先级）

#### 任务 3.4.1：P11合照页 - WebSocket通知
**问题描述：** 合照生成完成后缺少实时通知

**开发任务：**
1. 在接受邀请后订阅WebSocket通知：
   ```javascript
   acceptInvitation() {
     // ...接受邀请逻辑

     // 订阅照片状态更新
     ws.onPhotoStatusChange((data) => {
       if (data.photoId === this.data.photoId && data.status === 'completed') {
         wx.showToast({ title: '合照已生成', icon: 'success' });

         // 跳转到我的照片页
         setTimeout(() => {
           wx.redirectTo({ url: '/pages/my-photos/my-photos' });
         }, 1500);
       }
     });
   }
   ```

2. 在发起者端也订阅通知（发起后不跳转，等待合照完成）

**涉及文件：**
- `wx-miniapp/pages/couple-photo/couple-photo.js`

**预计工时：** 0.5天

---

#### 任务 3.4.2：P10我的照片页 - 删除功能完善
**问题描述：** 前端删除成功，但未调用后端API

**开发任务：**
1. 添加后端删除API：
   ```typescript
   // server/routers.ts
   mp: {
     deletePhoto: publicProcedure
       .input(z.object({ photoId: z.string() }))
       .mutation(async ({ input }) => {
         await db.deleteUserPhoto(input.photoId);
         return { success: true };
       }),
   }
   ```

2. 更新前端调用：
   ```javascript
   deletePhoto(photoId) {
     wx.showModal({
       title: '确认删除',
       content: '删除后无法恢复',
       success: async (res) => {
         if (res.confirm) {
           await api.deletePhoto(photoId);
           // 刷新列表
           this.loadPhotos();
         }
       }
     });
   }
   ```

**涉及文件：**
- `server/routers.ts`
- `wx-miniapp/pages/my-photos/my-photos.js`
- `wx-miniapp/utils/api.js`

**预计工时：** 0.5天

---

#### 任务 3.4.3：性能优化 - 图片预加载和缓存
**问题描述：** 缺少模板图片预加载机制

**开发任务：**
1. 实现图片预加载函数：
   ```javascript
   // utils/image-preloader.js
   class ImagePreloader {
     preload(urls) {
       return Promise.all(
         urls.map(url => new Promise((resolve) => {
           wx.getImageInfo({
             src: url,
             success: resolve,
             fail: resolve // 失败也继续
           });
         }))
       );
     }
   }
   ```

2. 在P1/P8加载模板后预加载前10张图片：
   ```javascript
   onTemplatesLoaded(templates) {
     const topTemplates = templates.slice(0, 10);
     const urls = topTemplates.map(t => t.thumbnailUrl);
     imagePreloader.preload(urls);
   }
   ```

3. 实现本地缓存策略：
   ```javascript
   // 缓存模板列表
   wx.setStorageSync('templateCache', {
     version: templateVersion,
     data: templates,
     timestamp: Date.now()
   });

   // 读取缓存
   const cache = wx.getStorageSync('templateCache');
   if (cache && cache.version === currentVersion) {
     this.setData({ templates: cache.data });
   }
   ```

**涉及文件：**
- `wx-miniapp/utils/image-preloader.js`（新增）
- `wx-miniapp/pages/index/index.js`
- `wx-miniapp/pages/paid-templates/paid-templates.js`

**预计工时：** 1天

---

#### 任务 3.4.4：错误处理和日志完善
**问题描述：** 缺少统一错误处理和日志记录

**开发任务：**
1. 创建错误处理工具：
   ```javascript
   // utils/error-handler.js
   class ErrorHandler {
     static handle(error, context) {
       console.error(`[${context}]`, error);

       // 上报错误到后端
       this.report(error, context);

       // 显示用户友好提示
       const message = this.getUserMessage(error);
       wx.showToast({ title: message, icon: 'none' });
     }

     static getUserMessage(error) {
       const messages = {
         'NETWORK_ERROR': '网络连接失败，请检查网络',
         'AUTH_FAILED': '登录失效，请重新登录',
         'PERMISSION_DENIED': '权限不足',
         'TEMPLATE_OFFLINE': '该模板已下架',
         // ...更多错误码
       };

       return messages[error.code] || '操作失败，请稍后重试';
     }
   }
   ```

2. 在所有API调用处添加错误处理：
   ```javascript
   try {
     const result = await api.someMethod();
     // 处理成功逻辑
   } catch (error) {
     ErrorHandler.handle(error, 'MethodName');
   }
   ```

**涉及文件：**
- `wx-miniapp/utils/error-handler.js`（新增）
- 所有页面的 `.js` 文件

**预计工时：** 1天

---

## 📦 后端配套开发

### 任务 3.5.1：后台管理 - 微信支付配置UI完善
**当前状态：** 已添加配置项，但需要测试验证

**开发任务：**
1. 测试每个配置项的"测试"按钮功能
2. 验证配置保存和读取流程
3. 添加配置验证逻辑（格式检查）

**涉及文件：**
- `client/src/pages/admin/ApiConfig.tsx`
- `server/routers.ts`

**预计工时：** 0.5天

---

### 任务 3.5.2：后端API补充
**需要添加的API：**

1. `photo.getById` - 根据photoId获取照片详情
   ```typescript
   photo: {
     getById: publicProcedure
       .input(z.object({ photoId: z.string() }))
       .query(async ({ input }) => {
         return await db.getUserPhotoById(input.photoId);
       }),
   }
   ```

2. `template.getCities` - 获取城市列表（已在任务3.1.2中）

3. `spot.getByCity` - 根据城市获取景点列表（已在任务3.3.1中）

4. `mp.deletePhoto` - 删除照片（已在任务3.4.2中）

**涉及文件：**
- `server/routers.ts`
- `server/db.ts`

**预计工时：** 1天

---

## 🧪 测试验证计划

### 3.6.1：功能测试清单
- [ ] P9分享功能完整测试（照片/模板/订单三种分享）
- [ ] P4权限提醒（摄像头/位置/相册）
- [ ] P5生成页UI效果（倒计时/轮播/气泡）
- [ ] P8多选模板和支付流程
- [ ] P8景点筛选功能
- [ ] P1位置授权流程
- [ ] P11合照WebSocket通知
- [ ] P10删除照片功能
- [ ] 图片预加载和缓存效果
- [ ] 错误处理和提示文案

### 3.6.2：跳转流程测试
- [ ] 新用户流程：P0 → P1 → P2 → P3 → P5 → P6
- [ ] 老用户流程：P0 → P8 → 支付 → P5 → P6
- [ ] 分享流程：好友点击 → P9 → P1/P8
- [ ] 生成中断恢复：P0 → P5（恢复）
- [ ] 合照流程：P11创建 → 分享 → P11接受 → P5

### 3.6.3：性能测试
- [ ] 模板列表加载速度（首屏<2秒）
- [ ] 图片预加载效果
- [ ] WebSocket连接稳定性
- [ ] 缓存命中率

---

## 📊 任务优先级和工时预估

| 任务编号 | 任务名称 | 优先级 | 预计工时 | 负责模块 |
|---------|---------|--------|---------|---------|
| 3.1.1 | 修复P9分享页 | P0 | 1.5天 | 小程序前端 |
| 3.1.2 | 修复API缺失 | P0 | 0.5天 | 后端 |
| 3.2.1 | 完善P4权限页 | P1 | 1天 | 小程序前端 |
| 3.2.2 | 优化P5生成页 | P1 | 1.5天 | 小程序前端 |
| 3.3.1 | P8景点筛选 | P2 | 1天 | 小程序前端+后端 |
| 3.3.2 | P8多选支付 | P2 | 2天 | 小程序前端 |
| 3.3.3 | P1位置授权 | P2 | 0.5天 | 小程序前端 |
| 3.4.1 | P11通知 | P3 | 0.5天 | 小程序前端 |
| 3.4.2 | P10删除 | P3 | 0.5天 | 前后端 |
| 3.4.3 | 性能优化 | P3 | 1天 | 小程序前端 |
| 3.4.4 | 错误处理 | P3 | 1天 | 小程序前端 |
| 3.5.1 | 后台UI完善 | P3 | 0.5天 | 后台前端 |
| 3.5.2 | 后端API补充 | P1 | 1天 | 后端 |
| **总计** | | | **13天** | |

---

## 📅 开发排期建议

### Week 1（第1-3天）
**目标：** 修复关键缺陷
- Day 1：任务3.1.1（P9分享页）
- Day 2：任务3.1.1（P9分享页）+ 任务3.1.2（API修复）
- Day 3：任务3.2.1（P4权限页）+ 任务3.5.2（后端API）

### Week 2（第4-7天）
**目标：** 完善重要功能
- Day 4：任务3.2.2（P5生成页UI）
- Day 5：任务3.2.2（P5生成页UI）+ 任务3.3.3（P1位置）
- Day 6：任务3.3.1（P8景点筛选）
- Day 7：任务3.3.2（P8多选支付）

### Week 3（第8-10天）
**目标：** 优化和测试
- Day 8：任务3.3.2（P8多选支付）+ 任务3.4.1-3.4.2
- Day 9：任务3.4.3-3.4.4（性能优化+错误处理）
- Day 10：全面测试和Bug修复

---

## ✅ 验收标准

### 功能验收：
- [ ] 所有P0任务100%完成
- [ ] 所有P1任务100%完成
- [ ] 至少80%的P2任务完成
- [ ] P3任务根据时间情况选择性完成

### 质量验收：
- [ ] 无阻塞性Bug
- [ ] 核心流程跳转正确率100%
- [ ] 页面加载速度<3秒
- [ ] 错误提示文案友好清晰

### 文档验收：
- [ ] 更新 `changelog.md`
- [ ] 更新 `README.md`
- [ ] 提交代码注释完整

---

## 🎯 第三阶段完成后预期成果

- ✅ 需求实现度从 **78%** 提升到 **95%**
- ✅ 12个页面功能完整，跳转流程正确
- ✅ 用户体验显著提升（倒计时、气泡、权限引导）
- ✅ 支付流程完整可用
- ✅ 分享功能完整，支持照片/模板/订单三种分享
- ✅ 性能优化，加载速度提升30%
- ✅ 错误处理完善，用户提示友好

---

## 📝 备注

1. **微信支付测试**需要真实的微信商户号和证书，建议使用沙箱环境测试
2. **位置服务**需要在微信公众平台配置"位置接口"权限
3. **WebSocket服务**需要配置wss协议（生产环境）
4. **图片存储**建议使用CDN加速（腾讯云COS已配置）
5. **性能监控**可接入微信小程序性能分析工具

---

*计划制定日期：2026-01-18*
*预计完成日期：2026-01-28*

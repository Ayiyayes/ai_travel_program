# AI旅拍微信小程序

纯原生微信小程序版本,无需编译,可直接在微信开发者工具中打开!

## 🚀 快速开始

### 1. 打开微信开发者工具

如果还没安装,请下载:
https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 导入项目

1. 打开微信开发者工具
2. 点击"导入项目"或"+"
3. 填写信息:
   - **项目目录**: 选择 `wx-miniapp` 文件夹
     ```
     F:\AI拍照玩偶素材内容\软件开发代码\ai_travel_code_20260112\wx-miniapp
     ```
   - **AppID**: 使用测试号(或填写你的AppID)
   - **项目名称**: AI旅拍小程序
4. 点击"导入"

### 3. 查看效果

导入成功后,左侧会显示小程序模拟器,可以看到页面效果!

## 📱 项目结构

```
wx-miniapp/
├── pages/                 # 页面目录
│   ├── index/             # 首页(模板列表)
│   ├── template-detail/   # 模板详情
│   ├── camera/            # 相机拍照
│   ├── generating/        # 生成中
│   ├── result/            # 结果展示
│   ├── my-photos/         # 我的照片
│   └── share/             # 分享页面
├── utils/                 # 工具函数
│   ├── request.js         # 网络请求封装
│   └── api.js             # API接口封装
├── images/                # 图片资源(需补充)
├── app.js                 # 小程序入口
├── app.json               # 小程序配置
├── app.wxss               # 全局样式
├── project.config.json    # 项目配置
└── README.md              # 本文件
```

## ⚙️ 配置说明

### 修改API地址

编辑 `app.js` 文件,修改第4行:

```javascript
globalData: {
  apiBaseUrl: 'http://localhost:3000', // 改成你的API地址
  // ...
}
```

### 修改AppID

编辑 `project.config.json` 文件,修改 `appid` 字段:

```json
{
  "appid": "your_wechat_appid",
  // ...
}
```

或者在微信开发者工具的"详情"中修改。

## 📋 功能清单

### ✅ 已完成

- [x] 首页模板列表(瀑布流布局)
- [x] 人群类型切换
- [x] 模板详情页
- [x] 相机拍照/相册选择
- [x] 照片上传
- [x] 生成中页面(轮询状态)
- [x] 结果展示(轮播查看)
- [x] 保存到相册
- [x] 分享功能
- [x] 我的照片列表
- [x] 推广链接绑定
- [x] 微信登录(自动)

### ⚠️ 待补充

- [ ] tabbar图标(images/home.png等)
- [ ] 默认头像(images/default-avatar.png)
- [ ] 后端小程序登录接口

## 🔧 开发相关

### 查看日志

在微信开发者工具的"控制台"标签可以看到:
- `console.log()` 输出
- 网络请求
- 错误信息

### 真机调试

1. 点击开发者工具顶部的"预览"按钮
2. 会生成二维码
3. 用手机微信扫码即可在真机上测试

### 开发版/体验版

- 开发版: 点击"预览"
- 体验版: 点击"上传" -> 在公众平台设置为体验版

## 🌐 后端对接

### 需要新增的API接口

```
POST /api/miniprogram/wx-login
```

请求参数:
```json
{
  "code": "微信登录凭证"
}
```

响应数据:
```json
{
  "success": true,
  "token": "JWT token",
  "user": {
    "id": 1,
    "nickname": "用户昵称",
    "avatar": "头像URL",
    "credits": 10
  }
}
```

详细的后端对接说明,请参考uni-app项目中的 `BACKEND_INTEGRATION.md`

## 🎨 自定义样式

### 修改主题色

编辑 `app.wxss` 文件,搜索以下颜色值并替换:

- 主色: `#e89a8d` (粉色)
- 背景色: `#fdf9f6` (米白色)
- 文字灰: `#bcaea8` (灰色)

### 修改导航栏

编辑各页面的 `.json` 文件,例如:

```json
{
  "navigationBarTitleText": "页面标题",
  "navigationBarBackgroundColor": "#fdf9f6"
}
```

## 📸 图标资源

需要准备以下图标(81x81px):

- `images/home.png` - 首页图标(未选中)
- `images/home-active.png` - 首页图标(选中)
- `images/user.png` - 我的图标(未选中)
- `images/user-active.png` - 我的图标(选中)
- `images/default-avatar.png` - 默认头像(120x120px)

如果没有准备,可以暂时在 `app.json` 中注释掉 `tabBar` 配置。

## 🐛 常见问题

### Q: 为什么显示"不在以下request合法域名列表中"?

A: 开发阶段可以忽略:
1. 打开"详情"标签
2. 找到"本地设置"
3. 勾选"不校验合法域名..."

### Q: 如何修改API地址?

A: 编辑 `app.js`,修改 `globalData.apiBaseUrl`

### Q: 如何在真机上测试?

A: 点击"预览"按钮,扫码即可

### Q: 为什么相机打不开?

A: 确保在 `app.json` 中配置了 `permission` 权限

### Q: 如何发布小程序?

A:
1. 点击"上传"按钮
2. 前往微信公众平台
3. 提交审核
4. 审核通过后发布

## 📞 技术支持

- 微信小程序官方文档: https://developers.weixin.qq.com/miniprogram/dev/framework/
- 遇到问题可以查看控制台的错误信息
- 检查API地址是否正确
- 确保后端服务正在运行

## 🎉 项目特点

- ✅ **纯原生开发** - 无需编译,直接打开
- ✅ **代码清晰** - 注释完整,易于理解
- ✅ **功能完整** - 涵盖所有核心功能
- ✅ **样式精美** - 还原H5设计
- ✅ **即开即用** - 配置简单,快速上手

---

**开始你的AI旅拍小程序之旅吧!** 🚀


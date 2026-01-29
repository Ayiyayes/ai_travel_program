AI旅拍照片应用 - 功能与需求说明文档
文档版本: 1.2

生成日期: 2026年1月16日
最后更新: 2026年1月17日

项目路径: F:\AI拍照玩偶素材内容\软件开发代码\ai_travel_code_20260112

一、功能概述
本程序是一个AI旅拍照片生成平台，为游客提供在各旅游景点拍摄照片并通过AI技术生成精美换脸照片的服务。系统采用前后端分离架构，包含用户端H5应用、微信小程序、管理后台、渠道门户和推广员门户五大模块。

核心应用场景：

游客在景点扫描推广二维码进入应用
选择人群类型（如花季少女、成熟大叔等）和照片模板
拍摄自拍照后，系统调用AI工作流生成换脸照片
用户可分享、下载生成的照片
输入输出逻辑：

输入：用户自拍照（Base64/文件）、选择的模板ID、人群类型
输出：AI生成的换脸照片URL、生成状态、订单信息

二、核心功能清单
2.1 用户端功能
功能名称	触发条件	执行逻辑	预期结果
扫码进入	用户扫描推广二维码	解析URL中的channel/sales/city/spot参数，调用promotion.bindUserToSales绑定用户到推广员	用户与渠道/推广员建立关联，获赠初始积分
人群类型选择	用户进入首页	调用template.groupTypes获取人群类型列表，按photoType(单人/合照)分类显示	展示19种人群类型供用户选择
模板浏览	选择人群类型后	调用template.list获取对应模板，支持按城市/景点/脸型筛选	展示模板列表，显示价格、预览图
拍照上传	点击模板进入拍照页	调用摄像头API拍照，转Base64调用photo.uploadSelfie上传到存储	返回自拍照URL
照片生成	确认拍照后	创建订单，调用photo.generate触发AI工作流（Coze API），轮询photo.getStatus查询进度	生成完成后展示结果照片
照片分享	点击分享按钮	生成带用户信息的分享页面URL，调用微信分享API	好友可通过链接查看分享的照片
积分消费	选择付费模板	检查用户积分余额，扣除模板价格对应积分，创建积分记录	积分扣除成功，生成照片

2.2 管理后台功能
功能名称	触发条件	执行逻辑	预期结果
模板管理	访问/admin/templates	支持CRUD操作，批量导入，排序调整，遮盖区域配置	模板数据持久化到数据库
城市景点管理	访问/admin/city-spots	管理城市和景点数据，支持经纬度配置	建立城市-景点层级关系
渠道管理	访问/admin/channels	创建机构/个人渠道，配置佣金比例、合作期限、新用户积分	渠道可登录门户查看数据
订单管理	访问/admin/orders	查看所有订单，按状态/渠道/时间筛选，查看生成结果	订单数据可视化展示
用户管理	访问/admin/users	查看用户列表，关联的渠道、积分余额、生成历史	用户数据管理
人群类型配置	访问/admin/group-types	管理19种人群类型的显示名、排序、启用状态	控制前端显示的人群选项
API配置	访问/admin/api-config	配置Coze API Key、工作流ID等	AI服务配置生效
分享页配置	访问/admin/share-config	配置分享页面的标题、封面、描述	分享链接展示自定义内容

2.3 渠道门户功能
功能名称	触发条件	执行逻辑	预期结果
数据总览	登录渠道门户	调用channelPortal.dashboardStats获取扫码数、订单数、佣金等统计	展示渠道经营数据
订单查询	访问订单页	按时间范围查询该渠道的订单	展示订单列表和详情
推广码管理	访问推广页	查看/生成推广二维码（普通/微信/抖音三种）	获取推广物料
推广员管理	机构渠道访问销售页	添加/编辑/禁用下属推广员，配置推广员的城市景点权限	管理推广团队
2.4 推广员门户功能
功能名称	触发条件	执行逻辑	预期结果
个人数据	登录推广员门户	查看个人推广数据、订单、佣金	了解推广业绩
推广码	访问推广页	查看分配的城市景点对应的推广二维码	获取个人推广物料
2.5 微信小程序功能
功能名称	触发条件	执行逻辑	预期结果
微信登录	打开小程序	调用wx.login获取code，后端换取openId，创建/更新用户	自动登录，获取用户身份
模板浏览	进入首页	同H5端，调用相同API	展示模板列表
拍照生成	选择模板后	调用微信相机API拍照，上传生成	生成AI照片
保存相册	查看结果时	调用wx.saveImageToPhotosAlbum	照片保存到手机
脸型分析	拍照完成后	调用mp.analyzeFace分析脸型，自动识别宽脸/窄脸	智能匹配合适模板
实时状态推送	照片生成中	通过WebSocket接收服务器推送的状态更新	实时显示生成进度
微信支付	购买模板/充值	调用mp.createPayment创建订单，wx.requestPayment调起支付	完成支付流程
双人合照	邀请好友	创建邀请码，好友扫码加入，双方完成拍照后生成合照	生成双人合照

2.6 关键页面UI规范

**P5 照片生成加载等待页**
- 全屏虚化模糊显示用户选择的模板图片
- 单张模板显示该模板图片；多张模板以每3秒的速度进行轮播
- 顶部：倒计时胶囊显示"还剩N秒"
- 中间：加载进度条 + "正在生成中..."文字
- 底部：IP头像 + 气泡对话框（随机显示鼓励话术）

**P6 照片生成结果页**
- 顶部：返回按钮
- 中间主体：全屏显示结果照片，支持左右滑动切换
- 左右滑动箭头（多张结果图时）：
  - 首张图右侧显示 `>` 箭头
  - 中间图左右两侧都显示 `<` `>` 箭头
  - 最后一张左侧显示 `<` 箭头
  - 箭头显示逻辑：页面加载时显示3秒后消失；用户滑动切换时重新显示3秒后消失
- 底部导航栏：IP头像、保存相册、再来一张、分享好友

三、业务逻辑规则
3.1 用户与渠道绑定规则

规则1: 新用户首次通过推广链接访问时，自动绑定到对应渠道和推广员
规则2: 已绑定用户再次通过其他推广链接访问，不更换绑定关系
规则3: 渠道可配置新用户赠送积分数量(newUserPoints)
规则4: 用户的channelId和salesId一旦绑定，终身关联
3.2 积分规则

规则1: 新用户注册时获得渠道配置的初始积分
规则2: 选择付费模板时扣除对应积分
规则3: 积分不足时无法选择该模板
规则4: 生成失败可申请积分退还
规则5: 积分变动必须记录到pointsRecords表
规则6: 积分类型: earn(获得), spend(消费), refund(退还), gift(赠送)
3.3 模板排序规则

规则1: 同一城市+景点+人群类型下的模板按sortOrder升序排列
规则2: sortOrder从1开始，删除模板后自动重新计算排序
规则3: 拖拽排序时批量更新所有受影响模板的sortOrder
规则4: 只有选择了特定城市+景点+人群类型后才能拖拽排序
3.4 脸型匹配规则

规则1: 以下5种人群类型支持宽/窄脸选择:
       - girl_young (花季少女)
       - woman_mature (成熟女性)
       - man_young (青年男性)
       - woman_elder (成熟大叔)
       - man_elder (老年男性)
规则2: 其他人群类型固定为窄脸模板
规则3: 模板faceType字段: narrow(窄脸), wide(宽脸), both(通用)
规则4: 用户选择宽脸时只显示faceType为wide或both的模板
3.5 模板文件名编码规则

格式: {人群类型代码}_{5位随机码}[_{脸型后缀}].{扩展名}
示例:
  - girl_young_abc12_n.jpg (花季少女窄脸版)
  - girl_young_abc12_w.jpg (花季少女宽脸版)
  - girl_child_xyz99.jpg (小女孩，不区分脸型)

规则1: 人群类型代码必须是有效的groupType.code值
规则2: 随机码为5位字母数字组合，在数据库中唯一
规则3: 脸型后缀: _n表示窄脸, _w表示宽脸, 无后缀表示通用
规则4: templateId等于文件名（不含扩展名）

3.6 智能文件夹上传与模板配对规则

**文件夹结构约定：**
```
人群类型文件夹/                  # 支持中文名(少女)或代码名(girl_young)
├── 配对组1/                    # 子文件夹，内含一对宽/窄脸模板
│   ├── 宽脸模板.jpg
│   └── 窄脸模板.jpg
├── 配对组2/
│   ├── template_w.jpg         # _w后缀表示宽脸
│   └── template_n.jpg         # _n后缀表示窄脸
└── 单独模板.jpg                # 根目录文件默认窄脸
```

**中文人群类型映射表（19种）：**
| 中文名 | 代码 |
|-------|------|
| 幼女 | girl_child |
| 少女 | girl_young |
| 熟女 | woman_mature |
| 奶奶 | woman_elder |
| 幼男 | boy_child |
| 少男 | man_young |
| 大叔 | man_elder |
| 情侣 | couple_love |
| 闺蜜 | friends_girls |
| 兄弟 | friends_boys |
| 异性伙伴 | friends_mixed |
| 母子(少年) | mom_son_child |
| 母子(青年) | mom_son_adult |
| 母女(少年) | mom_daughter_child |
| 母女(青年) | mom_daughter_adult |
| 父子(少年) | dad_son_child |
| 父子(青年) | dad_son_adult |
| 父女(少年) | dad_daughter_child |
| 父女(青年) | dad_daughter_adult |

**脸型识别规则：**
- 宽脸识别：文件名包含 `宽`/`wide`/`_w.`/`_w_`/`w_`/`-w.`
- 窄脸识别：文件名包含 `窄`/`narrow`/`_n.`/`_n_`/`n_`/`-n.`

**智能配对规则：**
规则1: 同一子文件夹内的两张图片自动共享同一配对ID（templateGroupId）
规则2: 配对ID格式为 `pair_<人群类型代码>_<5位随机码>`
规则3: 如果只识别出宽脸，另一张自动设为窄脸；反之亦然
规则4: 如果两张都无法识别脸型，按文件名排序，第一个为窄脸，第二个为宽脸
规则5: 根目录下的单独文件默认为窄脸模板
3.6 佣金计算规则

规则1: 渠道佣金 = 订单金额 × 渠道佣金比例(commissionRate) / 100
规则2: 机构渠道分成:
       - 机构留存 = 渠道佣金 × institutionRetentionRate / 100
       - 推广员分成 = 渠道佣金 × salesCommissionRate / 100
规则3: 个人渠道全额获得渠道佣金
规则4: 佣金结算周期由系统配置决定
3.7 渠道类型权限规则

机构渠道(institution):
  - 可添加/管理下属推广员
  - 可查看所有下属推广员的数据
  - 佣金按机构留存比例分配

个人渠道(individual):
  - 不能添加推广员
  - 只能查看自己的数据
  - 全额获得渠道佣金
3.8 合照邀请规则

规则1: 发起者创建邀请后生成唯一邀请码
规则2: 邀请码有效期由expiresAt字段控制
规则3: 被邀请人扫码后进入合照流程
规则4: 双方都完成自拍后开始合照生成
规则5: 邀请状态: pending → accepted → completed/expired/cancelled
四、数据结构定义
4.1 核心数据表
users (用户表)
字段名	类型	约束	说明
id	int	主键,自增	用户ID
openId	varchar(100)	唯一	OAuth标识
name	text	-	用户昵称
email	varchar(100)	-	邮箱
avatar	text	-	头像URL
role	enum	user/admin	角色
points	int	默认0	积分余额
initialFreeCredits	int	默认5	初始赠送积分
hasUsedFreeCredits	boolean	默认false	是否已使用赠送
channelId	int	外键	关联渠道
salesId	int	外键	关联推广员
gender	varchar(20)	-	性别
userType	varchar(50)	-	用户类型
faceType	varchar(20)	-	脸型偏好
lastSelfieUrl	text	-	最后自拍照
templates (模板表)
字段名	类型	约束	说明
id	int	主键,自增	模板ID
templateId	varchar(100)	唯一	模板编号
name	varchar(200)	-	模板名称
imageUrl	text	-	原图URL
thumbnailUrl	text	-	缩略图URL
city	varchar(50)	-	城市
scenicSpot	varchar(100)	-	景点
groupType	varchar(50)	-	人群类型代码
photoType	enum	single/group	单人/合照
faceType	enum	wide/narrow/both	适用脸型
isNational	boolean	默认false	全国通用
price	int	默认0	价格(积分)
isFree	boolean	默认false	是否免费
status	enum	active/inactive	状态
sortOrder	int	默认0	排序号
hasMaskRegions	boolean	默认false	有遮盖区域
maskRegions	text	JSON	遮盖区域配置
prompt	text	-	AI提示词
viewCount	int	默认0	浏览数
selectCount	int	默认0	选择数
purchaseCount	int	默认0	购买数
orders (订单表)
字段名	类型	约束	说明
id	int	主键,自增	订单ID
orderNo	varchar(50)	唯一	订单号
userId	int	外键	用户ID
channelId	int	外键	渠道ID
salesId	int	外键	推广员ID
orderType	enum	single_photo/batch_photo/membership	订单类型
orderAmount	int	-	订单金额(积分)
pointsUsed	int	-	使用积分
commissionAmount	int	-	佣金金额
orderStatus	enum	pending/paid/completed/failed	状态
selfieUrl	text	-	自拍照URL
templateIds	text	JSON数组	模板ID列表
resultUrls	text	JSON数组	结果图URL
photoCount	int	-	生成数量
channels (渠道表)
字段名	类型	约束	说明
id	int	主键,自增	渠道ID
channelCode	varchar(20)	唯一	渠道编码
channelName	varchar(100)	-	渠道名称
channelType	enum	institution/individual	类型
contactPerson	varchar(50)	-	联系人
contactPhone	varchar(20)	-	联系电话
cities	text	JSON	授权城市
scenicSpots	text	JSON	授权景点
status	enum	active/inactive/expired	状态
cooperationStartDate	timestamp	-	合作开始日期
cooperationDays	int	-	合作天数
commissionRate	int	默认10	佣金比例(%)
institutionRetentionRate	int	默认70	机构留存(%)
salesCommissionRate	int	默认30	推广员分成(%)
newUserPoints	int	默认5	新用户赠送积分
loginAccount	varchar(50)	-	登录账号
loginPassword	varchar(100)	-	登录密码
groupTypes (人群类型表)
字段名	类型	约束	说明
id	int	主键,自增	ID
code	varchar(50)	唯一	类型代码
displayName	varchar(100)	-	显示名称
photoType	enum	single/group	照片类型
sortOrder	int	-	排序号
isActive	boolean	默认true	是否启用
4.2 预定义人群类型（共19种）
单人照类型(13种)：

代码	显示名称	脸型配置
girl_child	可爱小女孩	固定窄脸
boy_child	活泼小男孩	固定窄脸
girl_young	花季少女	支持宽/窄脸选择
boy_young	阳光少年	固定窄脸
woman_mature	成熟女性	支持宽/窄脸选择
man_young	青年男性	支持宽/窄脸选择
woman_elder	优雅女性	固定窄脸
man_elder	成熟大叔	支持宽/窄脸选择
grandma	慈祥奶奶	支持宽/窄脸选择
grandpa	和蔼爷爷	固定窄脸
pet_cat	萌宠猫咪	不适用
pet_dog	萌宠狗狗	不适用
other_single	其他单人	固定窄脸
合照类型(6种)：

代码	显示名称	说明
friends_boys	男生闺蜜	固定窄脸
friends_girls	闺蜜合照	固定窄脸
friends_mixed	朋友混合	固定窄脸
couple	情侣合照	固定窄脸
family	家庭合照	固定窄脸
other_group	其他合照	固定窄脸
五、外部依赖说明
5.1 数据库依赖
依赖	版本要求	用途
MySQL	8.0+	主数据库存储
Drizzle ORM	0.44.5	数据库操作层
mysql2	3.15.0	MySQL驱动
5.2 AI服务依赖
依赖	说明	配置位置
Coze API	字节跳动AI平台	系统配置表
单人换脸工作流	workflow_id配置	COZE_SINGLE_FACE_WORKFLOW_ID
双人换脸工作流	workflow_id配置	COZE_DOUBLE_FACE_WORKFLOW_ID
用户判别工作流	workflow_id配置	COZE_USER_ANALYZE_WORKFLOW_ID
脸型分析工作流	workflow_id配置	COZE_FACE_ANALYZE_WORKFLOW_ID (7554026919391150095)
智能体ID	关联Bot ID（可选）	COZE_BOT_ID

**Coze API 调用注意事项：**
- `template_image_url` 参数必须使用**数组格式**，而非字符串
- 图片URL必须是**公网可访问的HTTPS地址**（localhost地址无法被Coze云服务访问）
5.3 地图服务依赖
依赖	说明	配置
腾讯地图API	地点搜索、经纬度查询	TENCENT_MAP_API_KEY
5.4 存储服务依赖
模式	依赖	说明
local	本地文件系统	开发环境，存储到dist/public/uploads
cloud	腾讯云COS	生产环境，需配置腾讯云COS凭证

**腾讯云COS配置项：**
| 环境变量 | 说明 | 示例值 |
|---------|------|--------|
| `COS_SECRET_ID` | 腾讯云 SecretId | `AKID...` |
| `COS_SECRET_KEY` | 腾讯云 SecretKey | `xxx...` |
| `COS_BUCKET` | 存储桶名称 | `ai-travel-photo-xxx` |
| `COS_REGION` | 地域代码 | `ap-guangzhou` |

**URL转换机制：**
当 `STORAGE_TYPE=cloud` 时，系统会自动将本地图片上传到腾讯云COS获取公网HTTPS URL，确保Coze云服务可以访问。
5.5 前端依赖
依赖	版本	用途
React	19.2.1	UI框架
Vite	7.1.7	构建工具
tRPC	11.6.0	类型安全API调用
TanStack Query	5.90.2	数据状态管理
Tailwind CSS	4.1.14	样式框架
Radix UI	最新	无头组件库
Framer Motion	12.23.22	动画库
Sharp	0.34.5	图片处理

5.6 WebSocket 实时通知服务
**服务端 (server/websocket.ts)**
- 基于 `ws` 库实现 WebSocket 服务器
- 路径: `ws://host:port/ws`
- 消息格式: JSON `{ type, photoId, status, resultUrls, error }`
- 关键函数:
  - `initWebSocket(server)` - 初始化 WebSocket 服务
  - `notifyPhotoStatus(openId, photoId, status, resultUrls?)` - 通知用户照片状态
  - `sendToUser(openId, message)` - 发送消息给指定用户
  - `broadcast(message)` - 广播消息

**小程序端 (wx-miniapp/utils/websocket.js)**
- 使用 `wx.connectSocket` 实现连接
- 自动心跳检测（30秒间隔）
- 断线自动重连机制
- 关键函数:
  - `connect(openId)` - 建立连接
  - `onPhotoStatusChange(callback)` - 监听照片状态变化
  - `disconnect()` - 断开连接
六、非功能性需求
6.1 安全性要求

1. 用户密码使用bcrypt算法加密存储
2. 会话Token使用JWT(jose库)签名，httpOnly Cookie存储
3. Cookie设置secure:true(HTTPS)、sameSite:'Lax'
4. 管理接口需验证admin角色
5. 敏感操作(删除、批量修改)需二次确认
6. API请求超时设置为30秒(AXIOS_TIMEOUT_MS)
6.2 性能要求

1. 请求体大小限制500MB(支持大图片Base64上传)
2. 图片上传采用分批处理(每批5张)，避免请求过大
3. Coze配置缓存60秒，减少数据库查询
4. 模板列表支持分页和筛选，避免一次加载过多数据
5. 使用Sharp库压缩图片，生成缩略图
6.3 可用性要求

1. 服务器启动时自动查找可用端口(3000-3019)
2. 支持开发/生产环境切换(NODE_ENV)
3. 本地/云存储可通过环境变量切换(STORAGE_TYPE)
4. 前端支持HMR热更新(开发模式)
5. 错误信息国际化，返回用户友好提示
6.4 可维护性要求

1. TypeScript全栈类型安全
2. tRPC确保前后端API类型一致
3. Drizzle ORM提供类型安全的数据库操作
4. 统一的错误处理机制(HttpError类)
5. 模块化的路由组织(按业务域划分)
七、待优化/未完善部分
7.1 已知问题

1. [性能] 模板图片未启用CDN加速，大量用户访问时可能存在延迟
2. [安全] 部分公开API(publicProcedure)未做频率限制
3. [功能] 合照功能的邀请过期清理机制尚未实现定时任务
4. [体验] 照片生成失败时的重试机制需要优化
7.2 建议优化

1. 添加Redis缓存层，缓存热门模板数据
2. 实现图片懒加载和渐进式加载
3. 添加API请求频率限制(rate limiting)
4. ~~实现WebSocket推送，替代轮询查询生成状态~~ ✅ 已完成 (v1.2.0)
5. 添加日志收集和监控告警系统
6. 实现自动化测试覆盖
八、API接口清单
8.1 公开接口 (publicProcedure)
接口路径	方法	说明
auth.me	query	获取当前用户信息
auth.logout	mutation	退出登录
template.list	query	获取模板列表
template.getById	query	获取模板详情
template.cities	query	获取城市列表
template.scenicSpots	query	获取景点列表
template.groupTypes	query	获取人群类型
template.getNationalTemplates	query	获取全国通用模板
template.getRecommendedByLocation	query	按位置推荐模板
promotion.getCodeInfo	query	获取推广码信息
promotion.bindUserToSales	mutation	绑定用户到推广员
channelPortal.channelInfo	query	获取渠道信息
channelPortal.dashboardStats	query	渠道统计数据
photo.uploadSelfiePublic	mutation	上传自拍照（公开，用于小程序）
photo.createSinglePublic	mutation	创建单人换脸任务（公开）
photo.getStatusPublic	query	查询生成状态（公开）

8.1.1 小程序专用接口 (mp.*)
接口路径	方法	说明
mp.getUserStatus	query	获取用户状态（积分、脸型等）
mp.getPendingOrder	query	获取未完成订单
mp.markFreeCreditsUsed	mutation	标记免费积分已使用
mp.saveSelfie	mutation	保存用户自拍照
mp.saveFaceAnalysis	mutation	保存脸型分析结果
mp.getMyPhotos	query	获取用户历史照片列表
mp.analyzeFace	mutation	AI脸型分析（调用Coze工作流）
mp.createPayment	mutation	创建微信支付订单
mp.queryPayment	query	查询支付结果

8.1.2 邀请相关接口 (invitation.*)
接口路径	方法	说明
invitation.create	mutation	创建合照邀请
invitation.getByCode	query	获取邀请详情
invitation.accept	mutation	接受邀请生成合照
8.2 需登录接口 (protectedProcedure)
接口路径	方法	说明
user.profile	query	获取用户档案
user.updateProfile	mutation	更新用户档案
user.points	query	获取积分余额
photo.uploadSelfie	mutation	上传自拍照
photo.generate	mutation	生成照片
photo.getStatus	query	查询生成状态
photo.getResult	query	获取生成结果
order.create	mutation	创建订单
order.list	query	订单列表
map.searchLocation	query	搜索位置
8.3 管理员接口 (adminProcedure)
接口路径	方法	说明
admin.allTemplates	query	所有模板(含未启用)
template.create	mutation	创建模板
template.update	mutation	更新模板
template.delete	mutation	删除模板
template.batchImport	mutation	批量导入模板
admin.cities	query	城市管理
admin.createCity	mutation	创建城市
admin.spots	query	景点管理
admin.createSpot	mutation	创建景点
admin.channels	query	渠道管理
admin.createChannel	mutation	创建渠道
admin.groupTypes	query	人群类型管理
admin.systemConfig	query	系统配置
九、环境配置清单
9.1 必需环境变量
变量名	说明	示例
DATABASE_URL	MySQL连接字符串	mysql://user:pass@host:3306/db
JWT_SECRET	JWT签名密钥	random-secret-string
STORAGE_TYPE	存储类型	local / cloud
9.2 可选环境变量
变量名	说明	默认值
PORT	服务端口	3000
NODE_ENV	运行环境	development
COZE_API_KEY	Coze API密钥	(数据库配置)
COZE_BOT_ID	Coze智能体ID	(可选)
TENCENT_MAP_API_KEY	腾讯地图密钥	-
COS_SECRET_ID	腾讯云SecretId	(cloud模式必需)
COS_SECRET_KEY	腾讯云SecretKey	(cloud模式必需)
COS_BUCKET	COS存储桶名称	(cloud模式必需)
COS_REGION	COS地域代码	(cloud模式必需)

9.3 微信支付配置（商户提供）
变量名	说明	状态
WECHAT_APP_ID	小程序 AppID	待配置
WECHAT_MCH_ID	商户号	待配置
WECHAT_API_KEY	API 密钥 (v2)	待配置
WECHAT_API_V3_KEY	API v3 密钥	待配置
WECHAT_SERIAL_NO	商户证书序列号	待配置
WECHAT_PRIVATE_KEY	商户私钥	待配置
WECHAT_PAY_NOTIFY_URL	支付回调地址	待配置
十、启动与部署
10.1 开发环境启动

# 1. 安装依赖
cd ai-travel-photo-app
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑.env填写必需配置

# 3. 初始化数据库
pnpm run db:push

# 4. 启动开发服务器
pnpm run dev

# 5. 管理员登录(开发模式)
# 访问: http://localhost:3000/api/dev/super-admin/login
10.2 生产环境部署

# 1. 构建
pnpm run build

# 2. 设置生产环境变量
export NODE_ENV=production
export STORAGE_TYPE=cloud
# 设置其他生产环境变量...

# 3. 启动
pnpm run start

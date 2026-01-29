import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

// 用户表
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // 积分
  points: int("points").default(0).notNull(),
  // 新用户赠送积分相关
  initialFreeCredits: int("initialFreeCredits").default(0).notNull(),
  hasUsedFreeCredits: boolean("hasUsedFreeCredits").default(false).notNull(),
  // 渠道来源
  channelId: int("channelId"),
  salesId: int("salesId"),
  promotionCodeId: int("promotionCodeId"),
  // 用户判别信息
  gender: varchar("gender", { length: 10 }),
  userType: varchar("userType", { length: 20 }),
  faceType: varchar("faceType", { length: 10 }),
  // 时间戳
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // 上次自拍照相关
  lastSelfieUrl: text("lastSelfieUrl"),
  lastSelfieTime: timestamp("lastSelfieTime"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 模板表
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  templateId: varchar("templateId", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  // 分类信息
  city: varchar("city", { length: 50 }).notNull(),
  scenicSpot: varchar("scenicSpot", { length: 100 }).notNull(),
  groupType: varchar("groupType", { length: 50 }).notNull(),
  photoType: mysqlEnum("photoType", ["single", "group"]).default("single").notNull(),
  faceType: mysqlEnum("faceType", ["wide", "narrow", "both"]).default("both").notNull(),
  isNational: boolean("isNational").default(false).notNull(), // 是否全国通用
  // 价格
  price: int("price").default(0).notNull(),
  isFree: boolean("isFree").default(false).notNull(),
  // 状态
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  // 模板分组
  templateGroupId: varchar("templateGroupId", { length: 50 }),
  // 遮盖功能
  hasMaskRegions: boolean("hasMaskRegions").default(false).notNull(),
  maskRegions: text("maskRegions"),
  maskedImageUrl: text("maskedImageUrl"),
  regionCacheUrl: text("regionCacheUrl"),
  // Coze 相关
  prompt: text("prompt"),
  // 统计字段
  viewCount: int("viewCount").default(0).notNull(),
  selectCount: int("selectCount").default(0).notNull(),
  purchaseCount: int("purchaseCount").default(0).notNull(),
  // 时间戳
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// 渠道表
export const channels = mysqlTable("channels", {
  id: int("id").autoincrement().primaryKey(),
  channelCode: varchar("channelCode", { length: 20 }).notNull().unique(),
  channelName: varchar("channelName", { length: 100 }).notNull(),
  channelType: mysqlEnum("channelType", ["institution", "individual"]).notNull(),
  contactPerson: varchar("contactPerson", { length: 50 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 20 }),
  cities: text("cities"),
  scenicSpots: text("scenicSpots"),
  status: mysqlEnum("status", ["active", "inactive", "expired"]).default("active").notNull(),
  cooperationStartDate: timestamp("cooperationStartDate").notNull(),
  cooperationDays: int("cooperationDays").notNull().default(360),
  cooperationEndDate: timestamp("cooperationEndDate").notNull(),
  commissionRate: int("commissionRate").notNull().default(20),
  institutionRetentionRate: int("institutionRetentionRate").default(40),
  salesCommissionRate: int("salesCommissionRate").default(60),
  newUserPoints: int("newUserPoints").default(10),
  promotionActivity: text("promotionActivity"),
  loginAccount: varchar("loginAccount", { length: 50 }).unique(),
  loginPassword: varchar("loginPassword", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = typeof channels.$inferInsert;

// 推广码表
export const promotionCodes = mysqlTable("promotionCodes", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channelId").notNull(),
  salesId: int("salesId"),
  promoCode: varchar("promoCode", { length: 50 }).notNull().unique(),
  city: varchar("city", { length: 50 }).notNull(),
  scenicSpot: varchar("scenicSpot", { length: 100 }).notNull(),
  promotionLink: text("promotionLink").notNull(),
  qrCodeUrl: text("qrCodeUrl"),
  wechatLink: text("wechatLink"),
  wechatQrCodeUrl: text("wechatQrCodeUrl"),
  douyinLink: text("douyinLink"),
  douyinQrCodeUrl: text("douyinQrCodeUrl"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  scanCount: int("scanCount").default(0).notNull(),
  orderCount: int("orderCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromotionCode = typeof promotionCodes.$inferSelect;
export type InsertPromotionCode = typeof promotionCodes.$inferInsert;

// 销售人员表
export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  channelId: int("channelId").notNull(),
  salesCode: varchar("salesCode", { length: 20 }).notNull().unique(),
  salesName: varchar("salesName", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  commissionRate: int("commissionRate").notNull().default(60),
  city: varchar("city", { length: 50 }),
  scenicSpot: varchar("scenicSpot", { length: 100 }),
  promoCode: varchar("promoCode", { length: 50 }),
  promotionLink: text("promotionLink"),
  assignedScenics: text("assignedScenics"),
  loginAccount: varchar("loginAccount", { length: 50 }).unique(),
  loginPassword: varchar("loginPassword", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sales = typeof sales.$inferSelect;
export type InsertSales = typeof sales.$inferInsert;

// 订单表
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNo: varchar("orderNo", { length: 50 }).notNull().unique(),
  userId: int("userId").notNull(),
  channelId: int("channelId"),
  salesId: int("salesId"),
  promotionCodeId: int("promotionCodeId"),
  orderType: mysqlEnum("orderType", ["single_photo", "batch_photo", "membership"]).notNull(),
  orderAmount: int("orderAmount").notNull(),
  pointsUsed: int("pointsUsed").default(0).notNull(),
  commissionAmount: int("commissionAmount").default(0).notNull(),
  orderStatus: mysqlEnum("orderStatus", ["pending", "paid", "completed", "failed"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 20 }),
  paymentTime: timestamp("paymentTime"),
  thirdPartyOrderNo: varchar("thirdPartyOrderNo", { length: 100 }),
  city: varchar("city", { length: 50 }),
  scenicSpot: varchar("scenicSpot", { length: 100 }),
  faceType: varchar("faceType", { length: 20 }),
  selfieUrl: text("selfieUrl"),
  templateIds: text("templateIds"),
  resultUrls: text("resultUrls"),
  photoCount: int("photoCount").default(1).notNull(),
  errorCode: varchar("errorCode", { length: 50 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// 用户照片表
export const userPhotos = mysqlTable("userPhotos", {
  id: int("id").autoincrement().primaryKey(),
  photoId: varchar("photoId", { length: 50 }).notNull().unique(),
  userId: int("userId").notNull(),
  orderId: int("orderId"),
  templateId: int("templateId").notNull(),
  selfieUrl: text("selfieUrl").notNull(),
  selfie2Url: text("selfie2Url"),
  resultUrl: text("resultUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(),
  errorCode: varchar("errorCode", { length: 20 }),
  errorMessage: text("errorMessage"),
  workflowRunId: varchar("workflowRunId", { length: 100 }),
  faceAnalysisId: varchar("faceAnalysisId", { length: 100 }),
  detectedFaceType: varchar("detectedFaceType", { length: 10 }),
  detectedGender: varchar("detectedGender", { length: 10 }),
  detectedUserType: varchar("detectedUserType", { length: 20 }),
  faceAnalysisResult: text("faceAnalysisResult"),
  photoType: mysqlEnum("photoType", ["single", "group"]).default("single").notNull(),
  invitationId: int("invitationId"),
  shareCount: int("shareCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type UserPhoto = typeof userPhotos.$inferSelect;
export type InsertUserPhoto = typeof userPhotos.$inferInsert;

// 合照邀请表
export const photoInvitations = mysqlTable("photoInvitations", {
  id: int("id").autoincrement().primaryKey(),
  invitationCode: varchar("invitationCode", { length: 20 }).notNull().unique(),
  initiatorId: int("initiatorId").notNull(),
  partnerId: int("partnerId"),
  templateId: int("templateId").notNull(),
  initiatorSelfieUrl: text("initiatorSelfieUrl").notNull(),
  partnerSelfieUrl: text("partnerSelfieUrl"),
  status: mysqlEnum("status", ["pending", "accepted", "completed", "expired", "cancelled"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhotoInvitation = typeof photoInvitations.$inferSelect;
export type InsertPhotoInvitation = typeof photoInvitations.$inferInsert;

// 渠道用户登录表
export const channelUsers = mysqlTable("channelUsers", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["institution_channel", "individual_channel", "sales"]).notNull(),
  channelId: int("channelId"),
  salesId: int("salesId"),
  status: mysqlEnum("status", ["enabled", "disabled"]).default("enabled").notNull(),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  lastLoginTime: timestamp("lastLoginTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChannelUser = typeof channelUsers.$inferSelect;
export type InsertChannelUser = typeof channelUsers.$inferInsert;

// 销售推广码表
export const salesPromotionCodes = mysqlTable("salesPromotionCodes", {
  id: int("id").autoincrement().primaryKey(),
  salesId: int("salesId").notNull(),
  channelId: int("channelId").notNull(),
  city: varchar("city", { length: 50 }).notNull(),
  scenicSpot: varchar("scenicSpot", { length: 100 }).notNull(),
  promoCode: varchar("promoCode", { length: 50 }).notNull().unique(),
  wechatLink: text("wechatLink"),
  wechatQrCodeUrl: text("wechatQrCodeUrl"),
  douyinLink: text("douyinLink"),
  douyinQrCodeUrl: text("douyinQrCodeUrl"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  scanCount: int("scanCount").default(0).notNull(),
  orderCount: int("orderCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SalesPromotionCode = typeof salesPromotionCodes.$inferSelect;
export type InsertSalesPromotionCode = typeof salesPromotionCodes.$inferInsert;

// 积分记录表
export const pointsRecords = mysqlTable("pointsRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["earn", "spend", "refund", "gift"]).notNull(),
  amount: int("amount").notNull(),
  balance: int("balance").notNull(),
  description: text("description"),
  relatedOrderId: int("relatedOrderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointsRecord = typeof pointsRecords.$inferSelect;
export type InsertPointsRecord = typeof pointsRecords.$inferInsert;

// 系统配置表
export const systemConfigs = mysqlTable("systemConfigs", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 50 }).notNull().unique(),
  configValue: text("configValue").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfigs.$inferSelect;
export type InsertSystemConfig = typeof systemConfigs.$inferInsert;

// 城市表
export const cities = mysqlTable("cities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  pinyin: varchar("pinyin", { length: 50 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type City = typeof cities.$inferSelect;
export type InsertCity = typeof cities.$inferInsert;

// 景点表
export const spots = mysqlTable("spots", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  cityId: int("cityId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Spot = typeof spots.$inferSelect;
export type InsertSpot = typeof spots.$inferInsert;

// 分享配置表
export const shareConfigs = mysqlTable("shareConfigs", {
  id: int("id").autoincrement().primaryKey(),
  pageCode: varchar("pageCode", { length: 20 }).notNull().unique(),
  pageName: varchar("pageName", { length: 50 }).notNull(),
  title: varchar("title", { length: 100 }),
  coverUrl: text("coverUrl"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShareConfig = typeof shareConfigs.$inferSelect;
export type InsertShareConfig = typeof shareConfigs.$inferInsert;

// 人群类型配置表
export const groupTypes = mysqlTable("groupTypes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  displayName: varchar("displayName", { length: 20 }).notNull(),
  photoType: mysqlEnum("photoType", ["single", "group"]).default("single").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GroupType = typeof groupTypes.$inferSelect;
export type InsertGroupType = typeof groupTypes.$inferInsert;

// 模板草稿表
export const templateDrafts = mysqlTable("templateDrafts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  batchId: varchar("batchId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  city: varchar("city", { length: 50 }),
  scenicSpot: varchar("scenicSpot", { length: 100 }),
  groupType: varchar("groupType", { length: 50 }),
  faceType: varchar("faceType", { length: 20 }),
  price: varchar("price", { length: 20 }),
  templateId: varchar("templateId", { length: 100 }),
  aiDescription: text("aiDescription"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type TemplateDraft = typeof templateDrafts.$inferSelect;
export type InsertTemplateDraft = typeof templateDrafts.$inferInsert;

// 图片缓存表
export const imageCache = mysqlTable("imageCache", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  batchName: varchar("batchName", { length: 255 }),
  batchId: varchar("batchId", { length: 50 }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  previewUrl: text("previewUrl"),
  s3Key: varchar("s3Key", { length: 500 }),
  city: varchar("city", { length: 50 }).notNull(),
  spot: varchar("spot", { length: 100 }).notNull(),
  groupType: varchar("groupType", { length: 50 }).notNull(),
  faceType: mysqlEnum("faceType", ["wide", "narrow", "both"]).default("both").notNull(),
  price: int("price").default(0).notNull(),
  templateId: varchar("templateId", { length: 100 }),
  prompt: text("prompt"),
  sortOrder: int("sortOrder").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ImageCache = typeof imageCache.$inferSelect;
export type InsertImageCache = typeof imageCache.$inferInsert;

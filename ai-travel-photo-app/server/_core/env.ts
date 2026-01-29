export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // 存储类型：local=本地存储，cloud=云存储（腾讯云COS）
  storageType: (process.env.STORAGE_TYPE ?? "local") as "local" | "cloud",
  // 腾讯云 COS 配置
  cosSecretId: process.env.COS_SECRET_ID ?? "",
  cosSecretKey: process.env.COS_SECRET_KEY ?? "",
  cosBucket: process.env.COS_BUCKET ?? "",
  cosRegion: process.env.COS_REGION ?? "ap-guangzhou",
};

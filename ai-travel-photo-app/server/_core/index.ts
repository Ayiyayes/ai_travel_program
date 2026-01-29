import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";
import { serveStatic, setupVite } from "./vite";
import { initWebSocket, getConnectionStats } from "../websocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  // 500MB limit to support large image uploads (base64 encoded images are ~33% larger than original)
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  if (process.env.NODE_ENV === "development") {
    app.get("/api/dev/super-admin/login", async (req, res) => {
      const openIdFromQuery = typeof req.query.openId === "string" ? req.query.openId : undefined;
      const openId = openIdFromQuery || process.env.OWNER_OPEN_ID || "local-super-admin";
      const name = typeof req.query.name === "string" ? req.query.name : "超级管理员";

      try {
        await db.upsertUser({
          openId,
          name,
          role: "admin",
          lastSignedIn: new Date(),
        });
      } catch {}

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/admin");
    });
  }

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // 微信支付回调（需要在 tRPC 之前注册，因为需要原始 body）
  app.post("/api/wechat/pay/notify", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const wechatpay = await import("../wechatpay");

      // 获取请求头中的签名信息
      const timestamp = req.headers["wechatpay-timestamp"] as string;
      const nonce = req.headers["wechatpay-nonce"] as string;
      const signature = req.headers["wechatpay-signature"] as string;
      const serialNo = req.headers["wechatpay-serial"] as string;

      const body = req.body.toString();

      // 验证签名
      const isValid = await wechatpay.verifyNotifySignature(timestamp, nonce, body, signature, serialNo);
      if (!isValid) {
        console.error("[WechatPay] 回调签名验证失败");
        res.status(401).json({ code: "SIGN_ERROR", message: "签名验证失败" });
        return;
      }

      // 解析回调数据
      const notifyData = JSON.parse(body);
      if (notifyData.event_type !== "TRANSACTION.SUCCESS") {
        // 非支付成功通知，直接返回成功
        res.status(200).json({ code: "SUCCESS", message: "OK" });
        return;
      }

      // 解密资源数据
      const resource = await wechatpay.decryptNotifyResource(notifyData.resource);

      console.log("[WechatPay] 支付成功回调:", {
        outTradeNo: resource.out_trade_no,
        transactionId: resource.transaction_id,
        tradeState: resource.trade_state,
        amount: resource.amount?.total,
      });

      // TODO: 根据 out_trade_no 更新订单状态
      // 如果是积分充值，给用户加积分
      // 如果是模板购买，解锁模板

      res.status(200).json({ code: "SUCCESS", message: "OK" });
    } catch (error: any) {
      console.error("[WechatPay] 回调处理失败:", error);
      res.status(500).json({ code: "INTERNAL_ERROR", message: error.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 初始化 WebSocket 服务
  initWebSocket(server);

  // WebSocket 连接统计 API（开发环境）
  if (process.env.NODE_ENV === "development") {
    app.get("/api/ws/stats", (req, res) => {
      res.json(getConnectionStats());
    });
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WebSocket server running on ws://localhost:${port}/ws`);
  });
}

startServer().catch(console.error);

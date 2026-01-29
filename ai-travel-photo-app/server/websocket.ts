// WebSocket 实时通知服务
import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';

// 消息类型定义
export interface WsMessage {
  type: 'photo_status' | 'notification' | 'ping' | 'pong';
  data?: any;
}

// 客户端连接信息
interface ClientInfo {
  ws: WebSocket;
  userOpenId?: string;
  lastPing: number;
}

// 全局 WebSocket 服务实例
let wss: WebSocketServer | null = null;
const clients = new Map<string, ClientInfo>();

// 初始化 WebSocket 服务
export function initWebSocket(server: HttpServer) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = generateClientId();
    const clientInfo: ClientInfo = {
      ws,
      lastPing: Date.now(),
    };
    clients.set(clientId, clientInfo);

    console.log(`[WebSocket] Client connected: ${clientId}`);

    // 处理消息
    ws.on('message', (data: RawData) => {
      try {
        const message = JSON.parse(data.toString()) as WsMessage;
        handleMessage(clientId, message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    });

    // 处理断开连接
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
    });

    // 处理错误
    ws.on('error', (error: Error) => {
      console.error(`[WebSocket] Client ${clientId} error:`, error);
      clients.delete(clientId);
    });

    // 发送欢迎消息
    sendToClient(clientId, {
      type: 'notification',
      data: { message: 'Connected to WebSocket server' },
    });
  });

  // 心跳检测，每30秒检查一次
  setInterval(() => {
    const now = Date.now();
    const timeout = 60000; // 60秒超时

    clients.forEach((client, clientId) => {
      if (now - client.lastPing > timeout) {
        console.log(`[WebSocket] Client ${clientId} timeout, disconnecting`);
        client.ws.terminate();
        clients.delete(clientId);
      } else {
        // 发送 ping
        sendToClient(clientId, { type: 'ping' });
      }
    });
  }, 30000);

  console.log('[WebSocket] Server initialized on /ws');
}

// 处理客户端消息
function handleMessage(clientId: string, message: WsMessage) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'pong':
      // 更新最后活跃时间
      client.lastPing = Date.now();
      break;

    case 'notification':
      // 客户端注册 userOpenId
      if (message.data?.userOpenId) {
        client.userOpenId = message.data.userOpenId;
        console.log(`[WebSocket] Client ${clientId} registered as user: ${client.userOpenId}`);
      }
      break;

    default:
      console.log(`[WebSocket] Unknown message type: ${message.type}`);
  }
}

// 发送消息给指定客户端
function sendToClient(clientId: string, message: WsMessage) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

// 发送消息给指定用户（通过 userOpenId）
export function sendToUser(userOpenId: string, message: WsMessage) {
  clients.forEach((client) => {
    if (client.userOpenId === userOpenId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// 广播消息给所有连接的客户端
export function broadcast(message: WsMessage) {
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// 通知照片状态更新
export function notifyPhotoStatus(userOpenId: string, photoId: string, status: string, resultUrls?: string[]) {
  sendToUser(userOpenId, {
    type: 'photo_status',
    data: {
      photoId,
      status,
      resultUrls,
      timestamp: Date.now(),
    },
  });
  console.log(`[WebSocket] Notified user ${userOpenId} about photo ${photoId} status: ${status}`);
}

// 生成客户端 ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取连接数统计
export function getConnectionStats() {
  let authenticated = 0;
  let anonymous = 0;

  clients.forEach((client) => {
    if (client.userOpenId) {
      authenticated++;
    } else {
      anonymous++;
    }
  });

  return {
    total: clients.size,
    authenticated,
    anonymous,
  };
}

// WebSocket 连接管理
let socketTask = null
let isConnected = false
let reconnectTimer = null
let heartbeatTimer = null
let messageHandlers = []
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5 // 最多重连5次

// 获取 WebSocket URL
function getWsUrl() {
  // 直接从 getApp() 获取，避免循环依赖
  try {
    const app = getApp()
    const baseUrl = app.globalData.apiBaseUrl || 'http://localhost:3000'
    // 将 http/https 转换为 ws/wss
    return baseUrl.replace(/^http/, 'ws') + '/ws'
  } catch (error) {
    console.error('[WebSocket] Failed to get base URL:', error)
    return 'ws://localhost:3000/ws'
  }
}

// 连接 WebSocket
function connect() {
  if (socketTask && isConnected) {
    console.log('[WebSocket] Already connected')
    return
  }

  const wsUrl = getWsUrl()
  console.log('[WebSocket] Connecting to:', wsUrl)

  socketTask = wx.connectSocket({
    url: wsUrl,
    success: () => {
      console.log('[WebSocket] Socket created')
    },
    fail: (err) => {
      console.error('[WebSocket] Connect failed:', err)
      scheduleReconnect()
    }
  })

  // 监听连接打开
  socketTask.onOpen(() => {
    console.log('[WebSocket] Connected')
    isConnected = true
    reconnectAttempts = 0 // 重置重连计数

    // 注册用户（如果有 userOpenId）
    try {
      const userOpenId = wx.getStorageSync('userOpenId')
      if (userOpenId) {
        send({
          type: 'register',
          data: { userOpenId }
        })
        console.log('[WebSocket] User registered:', userOpenId)
      }
    } catch (error) {
      console.error('[WebSocket] Failed to register user:', error)
    }

    // 开始心跳
    startHeartbeat()
  })

  // 监听消息
  socketTask.onMessage((res) => {
    try {
      const message = JSON.parse(res.data)
      handleMessage(message)
    } catch (err) {
      console.error('[WebSocket] Parse message failed:', err)
    }
  })

  // 监听关闭
  socketTask.onClose(() => {
    console.log('[WebSocket] Disconnected')
    isConnected = false
    socketTask = null
    stopHeartbeat()
    scheduleReconnect()
  })

  // 监听错误
  socketTask.onError((err) => {
    console.error('[WebSocket] Error:', err)
    isConnected = false
  })
}

// 断开连接
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  stopHeartbeat()

  if (socketTask) {
    socketTask.close()
    socketTask = null
    isConnected = false
  }
}

// 发送消息
function send(data) {
  if (!socketTask || !isConnected) {
    console.warn('[WebSocket] Not connected, cannot send')
    return false
  }

  socketTask.send({
    data: JSON.stringify(data),
    fail: (err) => {
      console.error('[WebSocket] Send failed:', err)
    }
  })
  return true
}

// 处理消息
function handleMessage(message) {
  // 处理 ping
  if (message.type === 'ping') {
    send({ type: 'pong' })
    return
  }

  // 通知所有处理器
  messageHandlers.forEach(handler => {
    try {
      handler(message)
    } catch (err) {
      console.error('[WebSocket] Handler error:', err)
    }
  })
}

// 添加消息处理器
function onMessage(handler) {
  if (typeof handler === 'function') {
    messageHandlers.push(handler)
  }
  // 返回取消订阅函数
  return () => {
    const index = messageHandlers.indexOf(handler)
    if (index > -1) {
      messageHandlers.splice(index, 1)
    }
  }
}

// 心跳
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (isConnected) {
      send({ type: 'pong' })
    }
  }, 25000) // 25秒发送一次心跳
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

// 重连
function scheduleReconnect() {
  if (reconnectTimer) return

  // 检查是否超过最大重连次数
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[WebSocket] Max reconnect attempts reached, stopping reconnect')
    return
  }

  reconnectAttempts++
  // 指数退避：第1次5秒，第2次10秒，第3次20秒...
  const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    console.log(`[WebSocket] Attempting to reconnect... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
    connect()
  }, delay)
}

// 获取连接状态
function getStatus() {
  return {
    connected: isConnected,
    hasSocket: !!socketTask
  }
}

// 监听照片状态更新
function onPhotoStatusChange(callback) {
  return onMessage((message) => {
    if (message.type === 'photo_status' && typeof callback === 'function') {
      callback(message.data)
    }
  })
}

module.exports = {
  connect,
  disconnect,
  send,
  onMessage,
  onPhotoStatusChange,
  getStatus
}

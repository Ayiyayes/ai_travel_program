// P0 欢迎页 - 路由判断页
const { request } = require('../../utils/request.js')

Page({
  data: {
    ipImageUrl: '', // IP形象图片URL
  },

  onLoad(options) {
    console.log('[P0] 欢迎页加载，参数:', options)

    // 保存场景参数
    this.sceneOptions = options

    // 加载IP形象配置
    this.loadIPConfig()

    // 延迟执行路由判断（显示欢迎页至少500ms）
    setTimeout(() => {
      this.handleRouting(options)
    }, 800)
  },

  // 加载IP形象配置
  async loadIPConfig() {
    try {
      const result = await request({
        url: '/api/trpc/config.getIPImage',
        method: 'GET'
      })
      if (result && result.imageUrl) {
        const apiBaseUrl = getApp().globalData.apiBaseUrl
        let imageUrl = result.imageUrl
        if (imageUrl.startsWith('/')) {
          imageUrl = apiBaseUrl + imageUrl
        }
        this.setData({ ipImageUrl: imageUrl })
      }
    } catch (error) {
      console.log('[P0] IP形象配置加载失败，使用默认样式')
    }
  },

  // 路由判断逻辑
  async handleRouting(options) {
    try {
      // 1. 获取用户状态
      const userStatus = await this.getUserStatus()
      console.log('[P0] 用户状态:', userStatus)

      // 2. 检查是否有未完成订单（第一优先级）
      const pendingOrder = await this.checkPendingOrders()
      if (pendingOrder) {
        console.log('[P0] 发现未完成订单，跳转P5')
        this.navigateToGenerating(pendingOrder)
        return
      }

      // 3. 检查进入方式（第二优先级）
      const { photoId, templateId, shareType } = options

      // 如果是从分享链接进入
      if (photoId || templateId || shareType) {
        console.log('[P0] 分享入口，跳转P9')
        this.navigateToShare(options)
        return
      }

      // 4. 处理推广参数
      if (options.channel || options.sales) {
        await this.handlePromotion(options)
      }

      // 5. 根据用户状态跳转
      if (userStatus.hasUsedFreeCredits) {
        console.log('[P0] 老用户，跳转P8')
        this.navigateToPaidTemplates()
      } else {
        console.log('[P0] 新用户，跳转P1')
        this.navigateToIndex()
      }

    } catch (error) {
      console.error('[P0] 路由判断失败:', error)
      // 默认跳转到首页
      this.navigateToIndex()
    }
  },

  // 获取用户状态
  async getUserStatus() {
    try {
      // 尝试从缓存获取
      let userOpenId = wx.getStorageSync('userOpenId')
      if (!userOpenId) {
        // 生成临时用户标识
        userOpenId = `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        wx.setStorageSync('userOpenId', userOpenId)
      }

      const result = await request({
        url: '/api/trpc/mp.getUserStatus',
        data: { userOpenId }
      })

      return result || { hasUsedFreeCredits: false, points: 0 }
    } catch (error) {
      console.error('[P0] 获取用户状态失败:', error)
      return { hasUsedFreeCredits: false, points: 0 }
    }
  },

  // 检查未完成订单
  async checkPendingOrders() {
    try {
      const userOpenId = wx.getStorageSync('userOpenId')
      if (!userOpenId) return null

      const result = await request({
        url: '/api/trpc/mp.getPendingOrder',
        data: { userOpenId }
      })

      if (result && result.orderId && result.status === 'generating') {
        return result
      }
      return null
    } catch (error) {
      console.log('[P0] 检查未完成订单失败:', error)
      return null
    }
  },

  // 处理推广参数
  async handlePromotion(options) {
    const { channel, sales, city, spot } = options
    if (!channel) return

    try {
      const userOpenId = wx.getStorageSync('userOpenId')
      await request({
        url: '/api/promotion/bind-user',
        method: 'POST',
        data: {
          userOpenId,
          channelCode: channel,
          salesCode: sales,
          city,
          scenicSpot: spot
        }
      })
      console.log('[P0] 推广绑定成功')
    } catch (error) {
      console.error('[P0] 推广绑定失败:', error)
    }
  },

  // 跳转到生成等待页（有未完成订单）
  navigateToGenerating(pendingOrder) {
    wx.setStorageSync('pendingOrder', JSON.stringify(pendingOrder))
    wx.redirectTo({
      url: '/pages/generating/generating?fromPending=true'
    })
  },

  // 跳转到分享页
  navigateToShare(options) {
    const params = []
    if (options.photoId) params.push(`photoId=${options.photoId}`)
    if (options.templateId) params.push(`templateId=${options.templateId}`)
    if (options.shareType) params.push(`shareType=${options.shareType}`)

    wx.redirectTo({
      url: `/pages/share/share?${params.join('&')}`
    })
  },

  // 跳转到首页（新用户P1）
  navigateToIndex() {
    wx.redirectTo({
      url: '/pages/index/index'
    })
  },

  // 跳转到付费模板选择页（老用户P8）
  navigateToPaidTemplates() {
    wx.redirectTo({
      url: '/pages/paid-templates/paid-templates'
    })
  }
})

// P5 生成等待页 - 增强版（倒计时/轮播/气泡）
const { photoApi } = require('../../utils/api.js')
const websocket = require('../../utils/websocket.js')

// IP对话气泡文案库
const IP_MESSAGES = [
  '宝子，再等会,你的照片马上就到你手机里啦！',
  '看小姐姐五官清秀，让我猜猜看，小姐姐是湖南的吧？',
  '我刚刚用AI颜值测评器测了下你的颜值，评分很高哎95分！',
  '正在为你创作独一无二的旅拍照片~',
  'AI小姐姐正在努力中，马上就好啦！',
  '再等等哦，好照片值得等待~',
  '快完成了，准备好被惊艳吧！',
]

Page({
  data: {
    template: null,
    photoId: '',
    progress: 0,
    fromPending: false,

    // 倒计时相关（每张照片5秒）
    countdown: 5,

    // 多模板轮播相关
    carouselTemplates: [],
    currentTemplateIndex: 0,

    // 进度文字
    totalPhotos: 1,
    currentPhotoIndex: 1,
    progressText: '正在生成中...',

    // IP气泡对话
    ipMessage: IP_MESSAGES[0],

    // IP头像fallback
    showAvatarFallback: false,

    // 重试按钮
    showRetry: false,
  },

  // WebSocket 取消订阅函数
  unsubscribeWs: null,
  // 定时器
  pollingTimer: null,
  countdownTimer: null,
  ipMessageTimer: null,
  carouselTimer: null,
  // 防止重复跳转
  hasNavigated: false,

  onLoad(options) {
    // 检查是否从未完成订单恢复
    if (options.fromPending === 'true') {
      this.setData({ fromPending: true })
      this.resumePendingOrder()
    } else {
      this.startGeneration()
    }

    // 订阅 WebSocket 照片状态更新
    this.subscribePhotoStatus()

    // 启动倒计时
    this.startCountdown()

    // 启动IP气泡消息切换
    this.startIpMessageRotation()

    // 启动模板轮播（如果有多个模板）
    this.startCarousel()
  },

  onUnload() {
    // 清理所有定时器
    this.stopPolling()
    this.stopCountdown()
    this.stopIpMessageRotation()
    this.stopCarousel()

    // 取消 WebSocket 订阅
    if (this.unsubscribeWs) {
      this.unsubscribeWs()
      this.unsubscribeWs = null
    }
  },

  // IP头像加载失败时显示fallback
  onAvatarError() {
    this.setData({ showAvatarFallback: true })
  },

  // ========== 倒计时功能 ==========
  startCountdown() {
    // 根据照片数量计算预计时间（每张照片约5秒）
    // 1张 = 5秒，3张 = 15秒，5张 = 25秒
    const totalPhotos = this.data.totalPhotos || 1
    const estimatedSeconds = totalPhotos * 5

    this.setData({
      countdown: estimatedSeconds,
      progressText: `正在生成第${this.data.currentPhotoIndex}/${totalPhotos}张`
    })

    this.countdownTimer = setInterval(() => {
      let countdown = this.data.countdown
      if (countdown > 1) {
        // 倒计时大于1时，减1
        countdown -= 1
        this.setData({ countdown })
      } else {
        // 倒计时为1或0时，显示"请耐心等待"并重新开始倒计时
        const newCountdown = (this.data.totalPhotos || 1) * 5
        this.setData({
          countdown: newCountdown,
          progressText: '请耐心等待，马上就好'
        })
      }
    }, 1000)
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  },

  // ========== 模板轮播功能（多模板时每3秒切换） ==========
  startCarousel() {
    const templates = this.data.carouselTemplates
    if (!templates || templates.length <= 1) {
      return // 只有一个模板时不轮播
    }

    this.carouselTimer = setInterval(() => {
      const nextIndex = (this.data.currentTemplateIndex + 1) % templates.length
      this.setData({ currentTemplateIndex: nextIndex })
    }, 3000) // 每3秒切换一次
  },

  stopCarousel() {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer)
      this.carouselTimer = null
    }
  },

  // ========== IP气泡消息轮换 ==========
  startIpMessageRotation() {
    let messageIndex = 0

    this.ipMessageTimer = setInterval(() => {
      messageIndex = (messageIndex + 1) % IP_MESSAGES.length
      this.setData({
        ipMessage: IP_MESSAGES[messageIndex]
      })
    }, 5000) // 每5秒切换一次鼓励语
  },

  stopIpMessageRotation() {
    if (this.ipMessageTimer) {
      clearInterval(this.ipMessageTimer)
      this.ipMessageTimer = null
    }
  },

  // ========== 重试功能 ==========
  onRetry() {
    this.setData({
      showRetry: false,
      progressText: '正在重新生成...'
    })
    this.hasNavigated = false

    // 重新开始轮询
    if (this.data.photoId) {
      this.startPolling(this.data.photoId)
      this.startCountdown()
    } else {
      // 如果没有photoId，重新开始整个流程
      this.startGeneration()
    }
  },

  // ========== 生成流程 ==========
  async startGeneration() {
    const pendingOrder = wx.getStorageSync('pendingOrder')
    const selectedTemplateStr = wx.getStorageSync('selectedTemplate')
    const selectedTemplates = wx.getStorageSync('selectedTemplates') // 多模板
    const originalImageUrl = wx.getStorageSync('originalImageUrl')

    // 解析模板
    let selectedTemplate = null
    if (selectedTemplateStr) {
      try {
        selectedTemplate = typeof selectedTemplateStr === 'string'
          ? JSON.parse(selectedTemplateStr)
          : selectedTemplateStr
      } catch (e) {
        console.error('[Generating] 解析模板失败:', e)
      }
    }

    console.log('[Generating] 开始生成:', { pendingOrder, selectedTemplate, selectedTemplates, originalImageUrl })

    // 先设置模板背景（虚化显示）
    let carouselTemplates = []
    if (selectedTemplates && selectedTemplates.length > 0) {
      carouselTemplates = selectedTemplates
    } else if (selectedTemplate) {
      carouselTemplates = [selectedTemplate]
    }

    this.setData({
      template: selectedTemplate,
      carouselTemplates: carouselTemplates
    })

    // 启动轮播（显示虚化背景）
    this.stopCarousel()
    this.startCarousel()

    if (pendingOrder && pendingOrder.photoId) {
      // 已有任务，直接轮询状态
      const photoCount = pendingOrder.photoCount || 1

      this.setData({
        photoId: pendingOrder.photoId,
        totalPhotos: photoCount,
        progressText: `正在生成第1/${photoCount}张`
      })

      // 重新计算倒计时
      this.stopCountdown()
      this.setData({ countdown: photoCount * 5 })
      this.startCountdown()

      // 开始轮询订单状态
      this.startPolling(pendingOrder.photoId)
    } else if (originalImageUrl && selectedTemplate) {
      // 没有pendingOrder，需要先分析脸型并创建任务
      await this.analyzeAndCreateTask(originalImageUrl, selectedTemplate)
    } else {
      console.error('[Generating] 没有找到待处理的订单或必要数据')
      wx.showModal({
        title: '错误',
        content: '未找到待生成的照片信息',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  // 分析脸型并创建生成任务
  async analyzeAndCreateTask(imageUrl, selectedTemplate) {
    try {
      // 1. 分析脸型
      this.setData({ progressText: '正在分析您的面部特征...' })

      const userOpenId = wx.getStorageSync('userOpenId')
      const analyzeResult = await photoApi.analyzeFace(imageUrl, userOpenId)

      console.log('[Generating] 脸型分析结果:', analyzeResult)

      // 保存脸型信息
      let detectedFaceType = null
      if (analyzeResult.success) {
        const userStatus = wx.getStorageSync('userStatus') || {}
        userStatus.faceType = analyzeResult.faceType
        userStatus.gender = analyzeResult.gender
        userStatus.userType = analyzeResult.userType
        wx.setStorageSync('userStatus', userStatus)
        detectedFaceType = analyzeResult.faceType

        this.setData({
          progressText: `分析完成：${analyzeResult.userType || ''}${analyzeResult.faceType ? '，' + analyzeResult.faceType : ''}`
        })

        // 短暂显示分析结果
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      // 2. 创建生成任务
      this.setData({ progressText: '正在创建生成任务...' })

      const createResult = await photoApi.createSingle(
        imageUrl,
        selectedTemplate.id,
        detectedFaceType,
        userOpenId
      )

      console.log('[Generating] 创建照片任务成功:', createResult)

      // 3. 保存 pendingOrder 并开始轮询
      const pendingOrder = {
        photoId: createResult.photoId,
        photoCount: 1
      }
      wx.setStorageSync('pendingOrder', pendingOrder)

      this.setData({
        photoId: createResult.photoId,
        totalPhotos: 1,
        progressText: '正在生成第1/1张'
      })

      // 重新计算倒计时
      this.stopCountdown()
      this.setData({ countdown: 5 })
      this.startCountdown()

      // 开始轮询
      this.startPolling(createResult.photoId)

    } catch (error) {
      console.error('[Generating] 分析或创建任务失败:', error)
      this.setData({
        showRetry: true,
        progressText: error.message || '处理失败，请重试'
      })
      this.stopCountdown()
    }
  },

  // 恢复未完成订单
  resumePendingOrder() {
    const pendingOrder = wx.getStorageSync('pendingOrder')
    const selectedTemplate = wx.getStorageSync('selectedTemplate')
    const selectedTemplates = wx.getStorageSync('selectedTemplates')

    console.log('[Generating] 恢复订单:', pendingOrder)

    if (pendingOrder && pendingOrder.photoId) {
      const photoCount = pendingOrder.photoCount || 1

      let carouselTemplates = []
      if (selectedTemplates && selectedTemplates.length > 0) {
        carouselTemplates = selectedTemplates
      } else if (selectedTemplate) {
        carouselTemplates = [selectedTemplate]
      }

      this.setData({
        photoId: pendingOrder.photoId,
        template: selectedTemplate,
        carouselTemplates: carouselTemplates,
        totalPhotos: photoCount,
        progressText: `正在生成第1/${photoCount}张`
      })

      this.stopCountdown()
      this.setData({ countdown: photoCount * 5 })
      this.startCountdown()

      this.stopCarousel()
      this.startCarousel()

      this.startPolling(pendingOrder.photoId)
    } else {
      wx.showModal({
        title: '提示',
        content: '未找到待恢复的订单',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/index/index'
          })
        }
      })
    }
  },

  // ========== WebSocket 订阅 ==========
  subscribePhotoStatus() {
    this.unsubscribeWs = websocket.onPhotoStatusChange((data) => {
      console.log('[Generating] WebSocket 照片状态更新:', data)

      if (data.photoId !== this.data.photoId) {
        return
      }

      // 更新进度
      if (data.progress !== undefined) {
        const totalPhotos = this.data.totalPhotos
        const currentIndex = Math.min(Math.ceil(data.progress / (100 / totalPhotos)), totalPhotos)
        this.setData({
          progress: data.progress,
          currentPhotoIndex: currentIndex,
          progressText: `正在生成第${currentIndex}/${totalPhotos}张`
        })
      }

      // 生成完成
      if (data.status === 'completed' && data.resultUrl) {
        console.log('[Generating] WebSocket 通知生成完成, resultUrl:', data.resultUrl)
        if (!this.hasNavigated) {
          this.hasNavigated = true
          this.stopPolling()
          this.setData({ progress: 100 })
          this.navigateToResult(data)
        }
      }

      // 生成失败
      if (data.status === 'failed') {
        console.log('[Generating] WebSocket 通知生成失败')
        if (!this.hasNavigated) {
          this.setData({
            showRetry: true,
            progressText: data.errorMessage || '生成失败，请重试'
          })
          this.stopPolling()
          this.stopCountdown()
        }
      }
    })
  },

  // ========== 轮询状态 ==========
  startPolling(photoId) {
    console.log('[Generating] 开始轮询状态:', photoId)

    this.queryPhotoStatus(photoId)

    this.pollingTimer = setInterval(async () => {
      this.queryPhotoStatus(photoId)
    }, 3000)
  },

  async queryPhotoStatus(photoId) {
    try {
      const result = await photoApi.getStatus(photoId)
      console.log('[Generating] 查询状态结果:', result)

      if (result.progress !== undefined && result.progress !== this.data.progress) {
        const totalPhotos = this.data.totalPhotos
        const currentIndex = Math.min(Math.ceil(result.progress / (100 / totalPhotos)), totalPhotos)
        this.setData({
          progress: result.progress,
          currentPhotoIndex: currentIndex,
          progressText: `正在生成第${currentIndex}/${totalPhotos}张`
        })
      }

      if (result.status === 'completed' && result.resultUrl) {
        console.log('[Generating] 轮询检测到生成完成, resultUrl:', result.resultUrl)
        if (!this.hasNavigated) {
          this.hasNavigated = true
          this.stopPolling()
          this.setData({ progress: 100 })
          this.navigateToResult(result)
        }
      } else if (result.status === 'failed') {
        console.log('[Generating] 轮询检测到生成失败')
        if (!this.hasNavigated) {
          this.setData({
            showRetry: true,
            progressText: result.errorMessage || '生成失败，请重试'
          })
          this.stopPolling()
          this.stopCountdown()
        }
      }
    } catch (error) {
      console.error('[Generating] 查询状态失败:', error)
    }
  },

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  },

  // ========== 跳转逻辑 ==========
  navigateToResult(result) {
    const apiBaseUrl = getApp().globalData.apiBaseUrl
    let resultUrl = result.resultUrl

    if (!resultUrl || typeof resultUrl !== 'string' || resultUrl.trim() === '') {
      console.error('[Generating] 错误：resultUrl 为空或无效', result)
      wx.showModal({
        title: '生成异常',
        content: '照片URL获取失败，请重试',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: '/pages/index/index'
          })
        }
      })
      return
    }

    if (resultUrl.startsWith('/')) {
      resultUrl = apiBaseUrl + resultUrl
    }

    console.log('[Generating] 跳转结果页, resultUrl:', resultUrl, ', photoId:', result.photoId)

    wx.setStorageSync('resultImageUrl', resultUrl)
    wx.setStorageSync('photoId', result.photoId)

    // 如果有多张结果图
    if (result.resultUrls && Array.isArray(result.resultUrls)) {
      const fullUrls = result.resultUrls.map(url => {
        return url.startsWith('/') ? apiBaseUrl + url : url
      })
      wx.setStorageSync('resultImageUrls', fullUrls)
    }

    wx.removeStorageSync('pendingOrder')

    wx.redirectTo({
      url: '/pages/result/result'
    })
  },

  navigateToFail(errorMessage, errorCode) {
    const template = this.data.template
    const params = []

    if (errorMessage) {
      params.push(`errorMessage=${encodeURIComponent(errorMessage)}`)
    }
    if (errorCode) {
      params.push(`errorCode=${errorCode}`)
    }
    if (template && template.id) {
      params.push(`templateId=${template.id}`)
    }
    if (this.data.photoId) {
      params.push(`photoId=${this.data.photoId}`)
    }

    wx.removeStorageSync('pendingOrder')

    wx.redirectTo({
      url: `/pages/fail/fail?${params.join('&')}`
    })
  }
})

// P11 双人合照页
const { request } = require('../../utils/request.js')
const { photoApi } = require('../../utils/api.js')
const websocket = require('../../utils/websocket.js')

Page({
  data: {
    statusBarHeight: 20,
    mode: 'create', // 'create' 创建邀请 | 'accept' 接受邀请
    invitationCode: '',

    // 创建邀请模式
    templateId: '',
    template: null,
    selfieUrl: '',
    createdInvitationCode: '',
    isCreating: false,
    waitingForPartner: false, // 等待伙伴接受邀请
    partnerAccepted: false,   // 伙伴是否已接受

    // 接受邀请模式
    invitation: null,
    inviterTemplate: null,
    partnerSelfieUrl: '',
    isAccepting: false,

    // 通用
    showCamera: false,
    generating: false,
    generatingText: ''
  },

  // WebSocket 取消订阅函数
  unsubscribeWs: null,

  onLoad(options) {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    // 连接 WebSocket
    websocket.connect()

    // 判断模式：有 code 则为接受邀请，否则为创建邀请
    if (options.code) {
      this.setData({
        mode: 'accept',
        invitationCode: options.code
      })
      this.loadInvitation(options.code)
    } else if (options.templateId) {
      this.setData({
        mode: 'create',
        templateId: options.templateId
      })
      this.loadTemplate(options.templateId)

      // 如果有传入 selfieUrl
      if (options.selfieUrl) {
        this.setData({
          selfieUrl: decodeURIComponent(options.selfieUrl)
        })
      }
    }

    // 订阅 WebSocket 消息
    this.subscribeWebSocket()
  },

  onUnload() {
    // 取消 WebSocket 订阅
    if (this.unsubscribeWs) {
      this.unsubscribeWs()
      this.unsubscribeWs = null
    }
  },

  // 订阅 WebSocket 消息
  subscribeWebSocket() {
    this.unsubscribeWs = websocket.onMessage((message) => {
      // 处理合照邀请相关通知
      if (message.type === 'invitation_accepted') {
        this.handleInvitationAccepted(message.data)
      } else if (message.type === 'couple_photo_completed') {
        this.handlePhotoCompleted(message.data)
      }
    })
  },

  // 处理邀请被接受的通知
  handleInvitationAccepted(data) {
    // 只有创建者需要处理此通知
    if (this.data.mode !== 'create') return
    if (data.invitationCode !== this.data.createdInvitationCode) return

    console.log('[P11] Partner accepted invitation:', data)

    this.setData({
      partnerAccepted: true,
      generating: true,
      generatingText: '伙伴已接受邀请，正在生成合照...'
    })

    // 显示通知
    wx.showToast({
      title: '伙伴已接受邀请！',
      icon: 'success',
      duration: 2000
    })
  },

  // 处理合照生成完成的通知
  handlePhotoCompleted(data) {
    if (!data.photoId) return

    console.log('[P11] Couple photo completed:', data)

    // 跳转到结果页
    wx.redirectTo({
      url: `/pages/result/result?photoId=${data.photoId}`
    })
  },

  // 加载模板信息
  async loadTemplate(templateId) {
    try {
      const template = await request({
        url: '/api/trpc/template.getById',
        data: { id: parseInt(templateId) }
      })
      this.setData({ template })
    } catch (error) {
      console.error('加载模板失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载邀请信息
  async loadInvitation(code) {
    wx.showLoading({ title: '加载中...' })
    try {
      const data = await request({
        url: '/api/trpc/invitation.getByCode',
        data: { code }
      })
      this.setData({
        invitation: data.invitation,
        inviterTemplate: data.template
      })
    } catch (error) {
      console.error('加载邀请失败:', error)
      wx.showModal({
        title: '邀请无效',
        content: error.message || '邀请链接已失效或不存在',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 拍照/选择照片
  async chooseSelfie() {
    const that = this
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 拍照
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['camera'],
            camera: 'front',
            success: (mediaRes) => {
              that.uploadSelfie(mediaRes.tempFiles[0].tempFilePath)
            }
          })
        } else {
          // 从相册选择
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album'],
            success: (mediaRes) => {
              that.uploadSelfie(mediaRes.tempFiles[0].tempFilePath)
            }
          })
        }
      }
    })
  },

  // 上传自拍照
  async uploadSelfie(tempFilePath) {
    wx.showLoading({ title: '上传中...' })

    try {
      // 将图片转为 base64
      const fileManager = wx.getFileSystemManager()
      const base64 = fileManager.readFileSync(tempFilePath, 'base64')

      // 上传到服务器
      const result = await photoApi.uploadSelfie(base64, 'image/jpeg')

      if (result && result.url) {
        if (this.data.mode === 'create') {
          this.setData({ selfieUrl: result.url })
        } else {
          this.setData({ partnerSelfieUrl: result.url })
        }
      } else {
        throw new Error('上传失败')
      }
    } catch (error) {
      console.error('上传失败:', error)
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 创建邀请
  async createInvitation() {
    if (!this.data.selfieUrl) {
      wx.showToast({
        title: '请先拍照',
        icon: 'none'
      })
      return
    }

    this.setData({ isCreating: true })

    try {
      const userOpenId = wx.getStorageSync('userOpenId')
      const result = await request({
        url: '/api/trpc/invitation.create',
        method: 'POST',
        data: {
          templateId: parseInt(this.data.templateId),
          selfieUrl: this.data.selfieUrl,
          userOpenId
        }
      })

      this.setData({
        createdInvitationCode: result.invitationCode,
        waitingForPartner: true // 开始等待伙伴接受
      })

      // 订阅该邀请的通知
      websocket.send({
        type: 'subscribe_invitation',
        data: {
          invitationCode: result.invitationCode,
          userOpenId
        }
      })
    } catch (error) {
      console.error('创建邀请失败:', error)
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isCreating: false })
    }
  },

  // 复制邀请链接
  copyInvitationLink() {
    const code = this.data.createdInvitationCode
    // 构造小程序页面路径，用于分享
    const path = `/pages/couple-photo/couple-photo?code=${code}`

    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        })
      }
    })
  },

  // 分享邀请
  onShareAppMessage() {
    if (this.data.createdInvitationCode) {
      return {
        title: '邀请你一起拍合照！',
        path: `/pages/couple-photo/couple-photo?code=${this.data.createdInvitationCode}`,
        imageUrl: this.data.template?.imageUrl || ''
      }
    }
    return {
      title: 'AI旅拍 - 双人合照',
      path: '/pages/index/index'
    }
  },

  // 接受邀请并生成合照
  async acceptInvitation() {
    if (!this.data.partnerSelfieUrl) {
      wx.showToast({
        title: '请先拍照',
        icon: 'none'
      })
      return
    }

    this.setData({
      isAccepting: true,
      generating: true,
      generatingText: '正在生成合照...'
    })

    try {
      const result = await request({
        url: '/api/trpc/invitation.accept',
        method: 'POST',
        data: {
          code: this.data.invitationCode,
          selfieUrl: this.data.partnerSelfieUrl
        }
      })

      // 生成成功，跳转到结果页
      wx.redirectTo({
        url: `/pages/result/result?photoId=${result.photoId}`
      })
    } catch (error) {
      console.error('接受邀请失败:', error)
      this.setData({
        generating: false,
        generatingText: ''
      })
      wx.showToast({
        title: error.message || '生成失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isAccepting: false })
    }
  },

  // 返回
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})

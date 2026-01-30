// pages/template-detail/template-detail.js
const { templateApi } = require('../../utils/api.js')

Page({
  data: {
    template: null,
    loading: true,
    templateId: 0,
    errorMessage: '',
    navTop: 0,
    navHeight: 44,
    navBarHeight: 88
  },

  onLoad(options) {
    this.initNavBar()
    const templateId = Number(options && options.id)
    if (!templateId || Number.isNaN(templateId)) {
      this.setData({
        loading: false,
        errorMessage: '模板参数缺失'
      })
      wx.showToast({
        title: '模板参数缺失',
        icon: 'none'
      })
      return
    }

    this.setData({
      templateId: templateId
    })

    // 优先使用从上一页传递的模板数据（避免白屏）
    const eventChannel = this.getOpenerEventChannel()
    if (eventChannel && eventChannel.on) {
      eventChannel.on('template', (tpl) => {
        const normalized = this.normalizeTemplate(tpl)
        if (normalized) {
          console.log('[TemplateDetail] 使用事件通道模板数据')
          this.setData({
            template: normalized,
            loading: false,
            errorMessage: ''
          })
        }
      })
    }

    this.loadTemplate()
  },

  initNavBar() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const statusBarHeight = systemInfo.statusBarHeight || 20
      const navTop = menuButton ? menuButton.top : statusBarHeight
      const navHeight = menuButton ? menuButton.height : 44
      const navBarHeight = menuButton ? menuButton.bottom : (navTop + navHeight)

      this.setData({
        navTop,
        navHeight,
        navBarHeight
      })
    } catch (error) {
      // fall back to defaults
      this.setData({
        navTop: 20,
        navHeight: 44,
        navBarHeight: 88
      })
    }
  },

  // 归一化模板数据
  normalizeTemplate(data) {
    if (!data) return null

    const apiBaseUrl = getApp().globalData.apiBaseUrl
    const normalized = { ...data }

    if (normalized.imageUrl && normalized.imageUrl.startsWith('/')) {
      normalized.imageUrl = apiBaseUrl + normalized.imageUrl
    }
    if (normalized.thumbnailUrl && normalized.thumbnailUrl.startsWith('/')) {
      normalized.thumbnailUrl = apiBaseUrl + normalized.thumbnailUrl
    }
    if (normalized.imageWebpUrl && normalized.imageWebpUrl.startsWith('/')) {
      normalized.imageWebpUrl = apiBaseUrl + normalized.imageWebpUrl
    }
    if (normalized.thumbnailWebpUrl && normalized.thumbnailWebpUrl.startsWith('/')) {
      normalized.thumbnailWebpUrl = apiBaseUrl + normalized.thumbnailWebpUrl
    }

    if (!normalized.imageUrl && normalized.thumbnailUrl) {
      normalized.imageUrl = normalized.thumbnailUrl
    }
    if (!normalized.thumbnailUrl && normalized.imageUrl) {
      normalized.thumbnailUrl = normalized.imageUrl
    }
    if (!normalized.thumbnailWebpUrl && normalized.imageWebpUrl) {
      normalized.thumbnailWebpUrl = normalized.imageWebpUrl
    }

    return normalized
  },

  // 读取本地缓存的模板（P1兜底）
  getCachedTemplate() {
    try {
      const cached = wx.getStorageSync('lastSelectedTemplate')
      if (!cached) return null

      const parsed = JSON.parse(cached)
      if (parsed && Number(parsed.id) === Number(this.data.templateId)) {
        console.log('[TemplateDetail] 使用缓存模板数据')
        return parsed
      }
    } catch (error) {
      console.log('[TemplateDetail] 读取缓存模板失败:', error)
    }

    return null
  },

  // 加载模板详情
  async loadTemplate() {
    const hasPreview = !!this.data.template
    this.setData({ loading: !hasPreview, errorMessage: '' })

    let data = null

    try {
      data = await templateApi.getDetail(this.data.templateId)
    } catch (error) {
      console.error('加载模板详情失败:', error)
    }

    if (!data) {
      data = this.getCachedTemplate()
    }

    const normalized = this.normalizeTemplate(data)

    if (normalized) {
      this.setData({
        template: normalized,
        loading: false,
        errorMessage: ''
      })
    } else {
      this.setData({
        template: null,
        loading: false,
        errorMessage: '模板加载失败，请稍后重试'
      })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  onImageError() {
    if (!this.data.errorMessage) {
      this.setData({ errorMessage: '图片加载失败，请检查网络' })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 开始拍照（首次点击弹出摄像头授权）
  startPhoto() {
    if (!this.data.template) return

    // 保存模板信息到本地
    wx.setStorageSync('selectedTemplate', JSON.stringify(this.data.template))

    const navigateToCamera = () => {
      wx.navigateTo({
        url: '/pages/camera/camera'
      })
    }

    wx.getSetting({
      success: (res) => {
        const status = res.authSetting['scope.camera']

        if (status === undefined) {
          // 首次请求摄像头授权，直接弹窗
          wx.authorize({
            scope: 'scope.camera',
            success: () => {
              navigateToCamera()
            },
            fail: () => {
              wx.navigateTo({
                url: '/pages/camera-permission/camera-permission?type=camera'
              })
            }
          })
          return
        }

        if (status === false) {
          // 之前拒绝过 → 跳转到权限提醒页
          wx.navigateTo({
            url: '/pages/camera-permission/camera-permission?type=camera'
          })
          return
        }

        // 已授权 → 直接进入P3
        navigateToCamera()
      },
      fail: () => {
        // getSetting 失败也直接跳转，让 camera 组件处理
        navigateToCamera()
      }
    })
  }
})

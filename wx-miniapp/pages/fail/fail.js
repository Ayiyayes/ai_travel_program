// P7 生成失败页
Page({
  data: {
    statusBarHeight: 20,
    errorMessage: '',
    errorCode: '',
    templateId: '',
    photoId: ''
  },

  onLoad(options) {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    // 获取错误信息
    const { errorMessage, errorCode, templateId, photoId } = options
    this.setData({
      errorMessage: errorMessage ? decodeURIComponent(errorMessage) : '照片生成遇到问题，请重新尝试',
      errorCode: errorCode || '',
      templateId: templateId || '',
      photoId: photoId || ''
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        // 如果没有上一页，跳转到首页
        this.goHome()
      }
    })
  },

  // 重新生成
  retryGeneration() {
    // 检查是否有模板信息
    const templateStr = wx.getStorageSync('selectedTemplate')
    const originalImageUrl = wx.getStorageSync('originalImageUrl')

    if (templateStr && originalImageUrl) {
      // 有完整信息，直接跳转到生成页重试
      wx.redirectTo({
        url: '/pages/generating/generating'
      })
    } else {
      // 没有完整信息，跳转到拍照页
      wx.redirectTo({
        url: '/pages/camera/camera'
      })
    }
  },

  // 更换模板
  changeTemplate() {
    // 检查用户是新用户还是老用户
    const userStatus = wx.getStorageSync('userStatus')

    if (userStatus && userStatus.hasUsedFreeCredits) {
      // 老用户，跳转到付费模板页
      wx.redirectTo({
        url: '/pages/paid-templates/paid-templates'
      })
    } else {
      // 新用户，跳转到免费模板页
      wx.redirectTo({
        url: '/pages/index/index'
      })
    }
  },

  // 返回首页
  goHome() {
    // 检查用户是新用户还是老用户
    const userStatus = wx.getStorageSync('userStatus')

    if (userStatus && userStatus.hasUsedFreeCredits) {
      wx.redirectTo({
        url: '/pages/paid-templates/paid-templates'
      })
    } else {
      wx.redirectTo({
        url: '/pages/index/index'
      })
    }
  }
})

// P6 照片生成结果页
Page({
  data: {
    resultUrls: [],
    currentIndex: 0,
    photoId: '',
    loading: true,
    statusBarHeight: 44,
    navBarHeight: 44, // 导航栏高度（与胶囊按钮对齐）
    totalNavHeightRpx: 180, // 总导航栏高度（rpx），默认值

    // 箭头显示状态（3秒后自动隐藏）
    showArrows: true,

    // 图标fallback状态
    showAvatarFallback: false,
    showSaveIconFallback: false,
    showAgainIconFallback: false,
    showShareIconFallback: false,
  },

  // 箭头隐藏定时器
  arrowTimer: null,

  onLoad(options) {
    // 获取状态栏高度和胶囊按钮信息
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()

    // 计算导航栏高度（与胶囊按钮对齐）
    const navBarHeight = menuButton.height + (menuButton.top - systemInfo.statusBarHeight) * 2

    // 计算总导航栏高度（状态栏 + 导航栏）
    const totalNavHeight = systemInfo.statusBarHeight + navBarHeight

    // 转换为rpx（微信小程序的响应式单位，750rpx = 屏幕宽度）
    const screenWidth = systemInfo.screenWidth  // 屏幕宽度（px）
    const totalNavHeightRpx = totalNavHeight * 750 / screenWidth

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 44,
      navBarHeight: navBarHeight || 44,
      totalNavHeightRpx: totalNavHeightRpx
    })

    // 从 Storage 获取结果
    const resultUrl = wx.getStorageSync('resultImageUrl')
    const resultUrlsRaw = wx.getStorageSync('resultImageUrls')
    const photoId = wx.getStorageSync('photoId')

    const resultUrls = Array.isArray(resultUrlsRaw) ? resultUrlsRaw : []

    console.log('[Result] 结果页加载:', {
      resultUrl: resultUrl || '(空)',
      resultUrls: resultUrls.length > 0 ? resultUrls : '(空数组)',
      photoId: photoId || '(空)'
    })

    // 兼容单图和多图
    let urls = []
    if (resultUrls.length > 0) {
      urls = resultUrls
    } else if (resultUrl && typeof resultUrl === 'string' && resultUrl.trim() !== '') {
      urls = [resultUrl]
    }

    console.log('[Result] 最终图片URL列表:', urls.length > 0 ? urls : '(空)')

    if (urls.length > 0) {
      this.setData({
        resultUrls: urls,
        photoId,
        loading: false
      })
      // 如果有多张图片，启动箭头自动隐藏
      if (urls.length > 1) {
        this.startArrowTimer()
      }
    } else {
      console.error('[Result] 错误：未找到任何有效的结果图片URL')
      this.setData({ loading: false })
    }
  },

  onUnload() {
    this.clearArrowTimer()
  },

  // ========== 图标加载失败处理 ==========
  onAvatarError() {
    this.setData({ showAvatarFallback: true })
  },

  onSaveIconError() {
    this.setData({ showSaveIconFallback: true })
  },

  onAgainIconError() {
    this.setData({ showAgainIconFallback: true })
  },

  onShareIconError() {
    this.setData({ showShareIconFallback: true })
  },

  // ========== 箭头显示控制（3秒后自动隐藏） ==========
  startArrowTimer() {
    this.clearArrowTimer()
    this.setData({ showArrows: true })
    this.arrowTimer = setTimeout(() => {
      this.setData({ showArrows: false })
    }, 3000)
  },

  clearArrowTimer() {
    if (this.arrowTimer) {
      clearTimeout(this.arrowTimer)
      this.arrowTimer = null
    }
  },

  // ========== 图片切换 ==========
  prevImage() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 })
      this.startArrowTimer()
    }
  },

  nextImage() {
    if (this.data.currentIndex < this.data.resultUrls.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 })
      this.startArrowTimer()
    }
  },

  onSwiperChange(e) {
    this.setData({ currentIndex: e.detail.current })
    this.startArrowTimer()
  },

  // ========== 分享功能 ==========
  onShareAppMessage() {
    const currentUrl = this.data.resultUrls[this.data.currentIndex]
    return {
      title: '我生成了超美的AI旅拍照片!',
      path: `/pages/share/share?photoId=${this.data.photoId}&shareType=photo`,
      imageUrl: currentUrl
    }
  },

  onShareTimeline() {
    const currentUrl = this.data.resultUrls[this.data.currentIndex]
    return {
      title: '快来生成你的AI旅拍照片',
      query: `photoId=${this.data.photoId}&shareType=photo`,
      imageUrl: currentUrl
    }
  },

  // ========== 图片加载回调 ==========
  onImageLoad(e) {
    console.log('[Result] 图片加载成功:', e.detail)
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index
    console.error('[Result] 图片加载失败:', e.detail, '图片URL:', this.data.resultUrls[index])
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index || this.data.currentIndex
    wx.previewImage({
      urls: this.data.resultUrls,
      current: this.data.resultUrls[index]
    })
  },

  // ========== 保存图片 ==========
  async saveImage() {
    const imageUrl = this.data.resultUrls[this.data.currentIndex]
    if (!imageUrl) return

    wx.showLoading({ title: '保存中...' })

    try {
      const res = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: imageUrl,
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200 && res.tempFilePath) {
        await new Promise((resolve, reject) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: resolve,
            fail: reject
          })
        })

        wx.hideLoading()
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        })
      } else {
        throw new Error('下载失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存图片失败:', error)

      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.navigateTo({
          url: '/pages/camera-permission/camera-permission?type=album&from=result'
        })
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    }
  },

  // ========== 返回/再来一张 ==========
  goBack() {
    wx.redirectTo({
      url: '/pages/paid-templates/paid-templates'
    })
  },

  // 点击IP头像（预留功能）
  goToIPInfo() {
    // 预留：跳转到IP信息页或显示IP介绍
    console.log('[Result] 点击IP头像')
  },

  // 再来一张 - 直接跳转到P8付费模板选择页
  generateAgain() {
    // 清除上次的结果
    wx.removeStorageSync('resultImageUrl')
    wx.removeStorageSync('resultImageUrls')
    wx.removeStorageSync('photoId')
    wx.removeStorageSync('selectedTemplate')
    wx.removeStorageSync('selectedTemplates')
    wx.removeStorageSync('originalImageUrl')

    // 直接跳转到P8付费模板选择页
    wx.redirectTo({
      url: '/pages/paid-templates/paid-templates'
    })
  }
})

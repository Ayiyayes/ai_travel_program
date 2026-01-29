// P10 我的照片页
const { photoApi, userApi } = require('../../utils/api.js')

Page({
  data: {
    user: {},
    photos: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    total: 0,
    statusBarHeight: 20
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    this.loadUser()
    this.loadPhotos()
  },

  onShow() {
    // 每次显示时刷新数据
    if (this.data.photos.length > 0) {
      this.onRefresh()
    }
  },

  // 加载用户信息
  async loadUser() {
    try {
      const data = await userApi.getMe()
      this.setData({ user: data || {} })
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 加载照片列表
  async loadPhotos(refresh = false) {
    const userOpenId = wx.getStorageSync('userOpenId')
    if (!userOpenId) {
      this.setData({ loading: false, photos: [], hasMore: false })
      return
    }

    if (this.data.loading) return

    if (refresh) {
      this.setData({
        page: 1,
        photos: [],
        hasMore: true
      })
    }

    this.setData({ loading: true })

    try {
      const data = await photoApi.getMyPhotos(
        userOpenId,
        this.data.page,
        this.data.pageSize
      )

      const photos = (data.list || []).map(item => ({
        ...item,
        statusText: this.getStatusText(item.status),
        createdAt: this.formatDate(item.createdAt)
      }))

      this.setData({
        photos: refresh ? photos : [...this.data.photos, ...photos],
        total: data.total || 0,
        hasMore: photos.length >= this.data.pageSize
      })
    } catch (error) {
      console.error('加载照片列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadUser()
    await this.loadPhotos(true)
    this.setData({ refreshing: false })
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return

    this.setData({
      page: this.data.page + 1
    })
    this.loadPhotos()
  },

  // 查看照片详情
  viewPhoto(e) {
    const photo = e.currentTarget.dataset.photo

    if (photo.status === 'completed' && photo.resultImageUrl) {
      // 已完成的照片，跳转结果页或预览
      wx.navigateTo({
        url: `/pages/result/result?photoId=${photo.id}`
      })
    } else if (photo.status === 'processing') {
      // 处理中，跳转生成页
      wx.navigateTo({
        url: `/pages/generating/generating?photoId=${photo.id}`
      })
    } else if (photo.status === 'failed') {
      // 失败的照片，提示可以重新生成
      wx.showModal({
        title: '生成失败',
        content: '该照片生成失败，是否重新生成？',
        confirmText: '重新生成',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.regeneratePhoto(photo)
          }
        }
      })
    }
  },

  // 重新生成照片
  regeneratePhoto(photo) {
    if (!photo.templateId || !photo.originalImageUrl) {
      wx.showToast({
        title: '无法重新生成',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/template-detail/template-detail?id=${photo.templateId}&selfieUrl=${encodeURIComponent(photo.originalImageUrl)}`
    })
  },

  // 预览照片
  previewPhoto(e) {
    const photo = e.currentTarget.dataset.photo
    const url = photo.resultImageUrl || photo.originalImageUrl
    if (!url) return

    const urls = this.data.photos
      .filter(p => p.resultImageUrl || p.originalImageUrl)
      .map(p => p.resultImageUrl || p.originalImageUrl)

    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // 保存照片到相册
  async savePhoto(e) {
    const photo = e.currentTarget.dataset.photo
    const url = photo.resultImageUrl

    if (!url) {
      wx.showToast({
        title: '照片未完成',
        icon: 'none'
      })
      return
    }

    // 阻止事件冒泡
    e.stopPropagation && e.stopPropagation()

    wx.showLoading({ title: '保存中...' })

    try {
      // 先下载图片
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: url,
          success: resolve,
          fail: reject
        })
      })

      if (downloadRes.statusCode !== 200) {
        throw new Error('下载失败')
      }

      // 保存到相册
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath,
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()
      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      console.error('保存失败:', error)

      // 可能是没有权限
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请允许保存图片到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    }
  },

  // 删除照片
  deletePhoto(e) {
    const photo = e.currentTarget.dataset.photo

    // 阻止事件冒泡
    e.stopPropagation && e.stopPropagation()

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这张照片吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })

          try {
            const userOpenId = wx.getStorageSync('userOpenId')

            // 调用删除 API
            await photoApi.deletePhoto(photo.id, userOpenId)

            // 删除成功，更新前端列表
            const photos = this.data.photos.filter(p => p.id !== photo.id)
            this.setData({
              photos,
              total: this.data.total - 1
            })

            wx.hideLoading()
            wx.showToast({
              title: '已删除',
              icon: 'success'
            })
          } catch (error) {
            wx.hideLoading()
            console.error('删除照片失败:', error)
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 去首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
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
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`

    return `${date.getMonth() + 1}月${date.getDate()}日`
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      pending: '待处理',
      processing: '生成中',
      completed: '已完成',
      failed: '生成失败'
    }
    return statusMap[status] || status
  }
})

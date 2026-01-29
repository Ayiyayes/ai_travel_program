// P3 拍照页 - 集成脸型分析
const { photoApi } = require('../../utils/api.js')

Page({
  data: {
    statusBarHeight: 20,
    photoTaken: false,
    tempPhotoPath: '',
    analyzing: false, // 是否正在分析脸型
    analyzeStatus: '' // 分析状态提示
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    // 创建相机上下文
    this.cameraContext = wx.createCameraContext()
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 拍照
  takePhoto() {
    if (!this.cameraContext) {
      this.cameraContext = wx.createCameraContext()
    }

    this.cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        this.setData({
          photoTaken: true,
          tempPhotoPath: res.tempImagePath
        })
      },
      fail: (err) => {
        console.error('拍照失败:', err)
        wx.showToast({
          title: '拍照失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 重拍
  retakePhoto() {
    this.setData({
      photoTaken: false,
      tempPhotoPath: '',
      analyzing: false,
      analyzeStatus: ''
    })
  },

  // 确认照片
  async confirmPhoto() {
    if (!this.data.tempPhotoPath) {
      wx.showToast({
        title: '请先拍照',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '上传中...', mask: true })

    try {
      // 将图片转换为 base64
      const fs = wx.getFileSystemManager()
      const base64 = fs.readFileSync(this.data.tempPhotoPath, 'base64')

      // 上传照片到服务器
      const result = await photoApi.uploadSelfie(base64, 'image/jpeg')

      // 获取返回的图片 URL
      const apiBaseUrl = getApp().globalData.apiBaseUrl
      let imageUrl = result.url || result
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = apiBaseUrl + imageUrl
      }

      // 保存照片URL到Storage，供generating页面使用
      wx.setStorageSync('originalImageUrl', imageUrl)

      // 清除之前的pendingOrder（如果有），让generating页面知道需要进行分析和创建任务
      wx.removeStorageSync('pendingOrder')

      wx.hideLoading()

      // 立即跳转到generating页面，在那里进行脸型分析和创建任务
      wx.redirectTo({
        url: '/pages/generating/generating'
      })

    } catch (error) {
      wx.hideLoading()
      console.error('上传失败:', error)
      wx.showToast({
        title: error.message || '上传失败，请重试',
        icon: 'none'
      })
    }
  },

  // 跳过分析，直接生成
  skipAnalysis() {
    wx.redirectTo({
      url: '/pages/generating/generating'
    })
  },

  // 相机错误处理
  onCameraError(e) {
    console.error('相机错误:', e.detail)
    wx.showModal({
      title: '相机不可用',
      content: '请检查摄像头权限或设备是否正常',
      showCancel: false,
      success: () => {
        wx.navigateBack()
      }
    })
  }
})

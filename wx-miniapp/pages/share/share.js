// pages/share/share.js - P9 分享好友详情页
const { orderApi, templateApi, photoApi } = require('../../utils/api.js')

Page({
  data: {
    // 分享类型: 'photo' | 'template' | 'order'
    shareType: '',

    // 加载状态
    loading: true,
    error: false,
    errorMessage: '',

    // 照片分享相关数据
    photoId: '',
    photoData: null,

    // 模板分享相关数据
    templateId: '',
    templateData: null,

    // 订单分享相关数据
    orderId: '',
    orderResults: [],

    // 用户状态
    userOpenId: '',
    isNewUser: false,
    hasUsedFreeCredits: false,

    // 显示的图片URL（用于全屏显示）
    displayImageUrl: '',

    // 场景文案
    sceneName: '',
    shareTitle: ''
  },

  onLoad(options) {
    console.log('[Share Page] onLoad options:', options)

    // 获取用户OpenId
    const userOpenId = wx.getStorageSync('userOpenId') || ''
    const userStatus = wx.getStorageSync('userStatus') || {}

    this.setData({
      userOpenId,
      hasUsedFreeCredits: userStatus.hasUsedFreeCredits || false
    })

    // 判断分享类型并加载数据
    if (options.photoId && options.shareType === 'photo') {
      // 照片分享
      this.setData({
        shareType: 'photo',
        photoId: options.photoId
      })
      this.loadPhotoData()

    } else if (options.templateId && options.shareType === 'template') {
      // 模板分享
      this.setData({
        shareType: 'template',
        templateId: parseInt(options.templateId)
      })
      this.loadTemplateData()

    } else if (options.orderId) {
      // 订单分享（兼容旧版本，默认为订单分享）
      this.setData({
        shareType: 'order',
        orderId: parseInt(options.orderId)
      })
      this.loadOrderData()

    } else {
      // 参数错误
      this.setData({
        loading: false,
        error: true,
        errorMessage: '分享链接参数错误'
      })
    }
  },

  // 加载照片数据
  async loadPhotoData() {
    this.setData({ loading: true, error: false })

    try {
      const photoData = await photoApi.getById(this.data.photoId)

      if (!photoData) {
        throw new Error('照片不存在或已删除')
      }

      // 获取照片关联的模板信息
      let templateData = null
      if (photoData.templateId) {
        try {
          templateData = await templateApi.getDetail(photoData.templateId)
        } catch (err) {
          console.error('获取模板信息失败:', err)
        }
      }

      // 设置场景名称
      const sceneName = templateData?.scenicSpot || templateData?.city || '旅拍'

      this.setData({
        photoData,
        templateData,
        displayImageUrl: photoData.resultUrls?.[0] || photoData.imageUrl,
        sceneName,
        shareTitle: `给你看看我在${sceneName}拍的美照`,
        loading: false
      })

      console.log('[Share Page] Photo data loaded:', photoData)

    } catch (error) {
      console.error('[Share Page] Load photo failed:', error)
      this.setData({
        loading: false,
        error: true,
        errorMessage: error.message || '照片加载失败'
      })
    }
  },

  // 加载模板数据
  async loadTemplateData() {
    this.setData({ loading: true, error: false })

    try {
      const templateData = await templateApi.getDetail(this.data.templateId)

      if (!templateData) {
        throw new Error('模板不存在或已下架')
      }

      // 设置场景名称
      const sceneName = templateData.scenicSpot || templateData.city || '旅拍'

      this.setData({
        templateData,
        displayImageUrl: templateData.imageUrl,
        sceneName,
        shareTitle: `${sceneName} - ${templateData.name}`,
        loading: false
      })

      console.log('[Share Page] Template data loaded:', templateData)

    } catch (error) {
      console.error('[Share Page] Load template failed:', error)
      this.setData({
        loading: false,
        error: true,
        errorMessage: error.message || '模板加载失败'
      })
    }
  },

  // 加载订单数据
  async loadOrderData() {
    this.setData({ loading: true, error: false })

    try {
      const orderResults = await orderApi.getResults(this.data.orderId)

      if (!orderResults || orderResults.length === 0) {
        throw new Error('订单结果不存在')
      }

      this.setData({
        orderResults,
        displayImageUrl: orderResults[0]?.imageUrl,
        shareTitle: 'AI旅拍照片分享',
        loading: false
      })

      console.log('[Share Page] Order results loaded:', orderResults)

    } catch (error) {
      console.error('[Share Page] Load order failed:', error)
      this.setData({
        loading: false,
        error: true,
        errorMessage: error.message || '订单加载失败'
      })
    }
  },

  // 预览图片
  previewImage() {
    const { displayImageUrl, photoData, orderResults } = this.data

    let urls = [displayImageUrl]

    // 如果是照片分享且有多张结果图
    if (photoData && photoData.resultUrls && photoData.resultUrls.length > 1) {
      urls = photoData.resultUrls
    }

    // 如果是订单分享且有多张图片
    if (orderResults && orderResults.length > 0) {
      urls = orderResults.map(r => r.imageUrl)
    }

    wx.previewImage({
      urls,
      current: displayImageUrl
    })
  },

  // 拍同款 - 核心导购逻辑
  handleTakeSameStyle() {
    const { shareType, photoData, templateData, hasUsedFreeCredits } = this.data

    console.log('[Share Page] Take same style clicked, shareType:', shareType)

    // 根据分享类型确定目标模板
    let targetTemplateId = null

    if (shareType === 'photo' && photoData) {
      // 照片分享：跳转到照片对应的模板
      targetTemplateId = photoData.templateId
    } else if (shareType === 'template' && templateData) {
      // 模板分享：直接使用该模板
      targetTemplateId = templateData.id
    }

    if (targetTemplateId) {
      // 有明确的模板ID，直接跳转到模板详情页（P2）
      wx.setStorageSync('selectedTemplate', shareType === 'template' ? templateData : null)

      wx.navigateTo({
        url: `/pages/template-detail/template-detail?id=${targetTemplateId}`,
        fail: (err) => {
          console.error('跳转失败:', err)
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          })
        }
      })

    } else {
      // 没有明确模板，根据用户状态跳转到首页
      this.navigateToHome()
    }
  },

  // 拍更多 - 跳转到首页
  handleTakeMore() {
    this.navigateToHome()
  },

  // 根据用户状态跳转到首页
  navigateToHome() {
    const { hasUsedFreeCredits } = this.data

    // 新用户跳转 P1（通用模板选择页）
    // 老用户跳转 P8（付费模板选择页）
    const targetPage = hasUsedFreeCredits
      ? '/pages/paid-templates/paid-templates'
      : '/pages/index/index'

    wx.switchTab({
      url: targetPage,
      fail: (err) => {
        // 如果switchTab失败（可能不是tab页），尝试navigateTo
        wx.redirectTo({
          url: targetPage
        })
      }
    })
  },

  // 返回首页
  goHome() {
    this.navigateToHome()
  },

  // 分享给好友
  onShareAppMessage() {
    const { shareType, shareTitle, displayImageUrl, photoId, templateId, orderId } = this.data

    let path = '/pages/share/share?'

    if (shareType === 'photo') {
      path += `photoId=${photoId}&shareType=photo`
    } else if (shareType === 'template') {
      path += `templateId=${templateId}&shareType=template`
    } else if (shareType === 'order') {
      path += `orderId=${orderId}`
    }

    return {
      title: shareTitle || 'AI旅拍照片',
      path,
      imageUrl: displayImageUrl
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { shareTitle, displayImageUrl } = this.data

    return {
      title: shareTitle || 'AI旅拍照片',
      imageUrl: displayImageUrl
    }
  }
})

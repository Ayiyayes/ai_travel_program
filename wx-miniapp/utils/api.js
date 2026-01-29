// API接口封装
const { request } = require('./request.js')

/**
 * 模板相关API
 */
const templateApi = {
  // 获取人群类型列表
  getGroupTypes(photoType = 'single') {
    return request({
      url: '/api/trpc/template.groupTypes',
      data: { photoType }
    })
  },

  // 获取模板列表
  getList(params) {
    return request({
      url: '/api/trpc/template.list',
      data: params
    })
  },

  // 获取模板详情
  getDetail(id) {
    return request({
      url: '/api/trpc/template.getById',
      data: { id }
    })
  },

  // ???????
  getVersion() {
    return request({
      url: '/api/trpc/template.version'
    })
  },

  // 获取城市列表（P8付费模板页使用）
  getCities() {
    return request({
      url: '/api/trpc/template.getCities'
    })
  },

  // 获取景点列表（根据城市）
  getScenicSpots(city) {
    return request({
      url: '/api/trpc/template.scenicSpots',
      data: { city }
    })
  }
}


/**
 * 订单相关API
 */
const orderApi = {
  // 创建订单
  create(params) {
    return request({
      url: '/api/order/create',
      method: 'POST',
      data: params
    })
  },

  // 获取订单详情
  getDetail(orderId) {
    return request({
      url: `/api/order/${orderId}`
    })
  },

  // 获取订单列表
  getList(params) {
    return request({
      url: '/api/order/list',
      data: params
    })
  },

  // 获取订单结果
  getResults(orderId) {
    return request({
      url: `/api/order/${orderId}/results`
    })
  }
}

/**
 * 用户相关API
 */
const userApi = {
  // 获取用户信息
  getMe() {
    return request({
      url: '/api/auth/me'
    })
  }
}

/**
 * 推广相关API
 */
const promotionApi = {
  // 绑定用户到推广员
  bindUser(params) {
    return request({
      url: '/api/promotion/bind-user',
      method: 'POST',
      data: params
    })
  }
}

/**
 * 照片相关API
 */
const photoApi = {
  // 上传自拍照（base64格式，公开接口，不需要登录）
  uploadSelfie(imageBase64, mimeType = 'image/jpeg') {
    return request({
      url: '/api/trpc/photo.uploadSelfiePublic',
      method: 'POST',
      data: { imageBase64, mimeType }
    })
  },

  // AI 脸型分析（公开接口）
  // 返回: { success, faceType, gender, userType, description }
  analyzeFace(selfieUrl, userOpenId) {
    const data = { selfieUrl }
    if (userOpenId) data.userOpenId = userOpenId
    return request({
      url: '/api/trpc/mp.analyzeFace',
      method: 'POST',
      data
    })
  },

  // 创建换脸任务（公开接口，不需要登录）
  // detectedFaceType: 用户脸型，如 "宽脸"、"窄脸"
  createSingle(selfieUrl, templateId, detectedFaceType, userOpenId) {
    const data = { selfieUrl, templateId }
    if (detectedFaceType) data.detectedFaceType = detectedFaceType
    if (userOpenId) data.userOpenId = userOpenId
    return request({
      url: '/api/trpc/photo.createSinglePublic',
      method: 'POST',
      data
    })
  },

  // 查询照片状态（公开接口）
  getStatus(photoId) {
    return request({
      url: '/api/trpc/photo.getStatusPublic',
      data: { photoId }
    })
  },

  // 获取用户照片列表（P10 我的照片页）
  getMyPhotos(userOpenId, page = 1, pageSize = 20) {
    return request({
      url: '/api/trpc/mp.getMyPhotos',
      data: { userOpenId, page, pageSize }
    })
  },

  // 获取照片详情（P9 分享页）
  getById(photoId) {
    return request({
      url: '/api/trpc/photo.getByIdPublic',
      data: { photoId }
    })
  },

  // 删除照片（P10 我的照片页）
  deletePhoto(photoId, userOpenId) {
    return request({
      url: '/api/trpc/mp.deletePhoto',
      method: 'POST',
      data: { photoId, userOpenId }
    })
  }
}

module.exports = {
  templateApi,
  orderApi,
  userApi,
  promotionApi,
  photoApi
}

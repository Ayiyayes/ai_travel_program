// 网络请求封装
const app = getApp()

/**
 * 发起网络请求
 */
function request(options) {
  const { url, method = 'GET', data = {}, hideLoading = false } = options

  // 显示加载提示
  // if (!hideLoading) {
  //   wx.showLoading({ title: '加载中...', mask: true })
  // }

  // 如果是 tRPC 请求，需要特殊处理
  let requestUrl = url
  let requestMethod = method
  let requestData = data

  if (url.startsWith('/api/trpc/')) {
    if (method === 'POST') {
      // tRPC mutation 请求格式：POST /api/trpc/photo.uploadSelfie
      // body: {"json": {...data}}
      requestMethod = 'POST'
      requestData = { json: data }
    } else {
      // tRPC query 请求格式：GET /api/trpc/template.list?input={"json":{"groupType":"shaonv"}}
      requestMethod = 'GET'
      const input = JSON.stringify({ json: data })
      requestUrl = url + '?input=' + encodeURIComponent(input)
      requestData = undefined
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBaseUrl + requestUrl,
      method: requestMethod,
      data: requestData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : ''
      },
      success: (res) => {
        wx.hideLoading()

        if (res.statusCode === 200) {
          // tRPC 返回格式：{ result: { data: [...] } }
          if (url.startsWith('/api/trpc/')) {
            console.log('=== tRPC 完整响应 ===', res.data)
            // tRPC query 返回格式是 { result: { data: { json: [...], meta: {...} } } }
            const result = res.data?.result?.data?.json ?? res.data?.result?.data
            console.log('=== 解析后的结果 ===', result)
            resolve(result || res.data)
          } else {
            // 普通 REST API
            if (res.data.success !== false) {
              resolve(res.data.data || res.data)
            } else {
              wx.showToast({
                title: res.data.message || '请求失败',
                icon: 'none',
                duration: 2000
              })
              reject(new Error(res.data.message || '请求失败'))
            }
          }
        } else if (res.statusCode === 401) {
          // token过期
          wx.removeStorageSync('token')
          wx.showToast({
            title: '登录已过期',
            icon: 'none'
          })
          // 重新登录
          if (app.wxLogin) {
            app.wxLogin()
          }
          reject(new Error('未授权'))
        } else {
          wx.showToast({
            title: res.data?.message || `请求失败(${res.statusCode})`,
            icon: 'none'
          })
          reject(new Error(res.data?.message || '请求失败'))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('请求失败:', err)
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 上传文件
 */
function uploadFile(filePath, url = '/api/upload') {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '上传中...', mask: true })

    wx.uploadFile({
      url: app.globalData.apiBaseUrl + url,
      filePath,
      name: 'file',
      header: {
        'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : ''
      },
      success: (res) => {
        wx.hideLoading()

        if (res.statusCode === 200) {
          const data = JSON.parse(res.data)
          if (data.success !== false) {
            resolve(data.url || data.data?.url)
          } else {
            wx.showToast({
              title: data.message || '上传失败',
              icon: 'none'
            })
            reject(new Error(data.message || '上传失败'))
          }
        } else {
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          })
          reject(new Error('上传失败'))
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('上传失败:', err)
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 获取基础URL
 */
function getBaseUrl() {
  return app.globalData.apiBaseUrl || ''
}

module.exports = {
  request,
  uploadFile,
  getBaseUrl
}

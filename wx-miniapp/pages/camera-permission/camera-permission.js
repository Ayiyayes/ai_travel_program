// P4 权限提醒页 - 支持摄像头/位置/相册三种权限
const { request } = require('../../utils/request.js')

// 权限配置表
const PERMISSION_CONFIG = {
  camera: {
    title: '开启相机权限',
    scope: 'scope.camera',
    buttonText: '继续授权开启相机',
    configKey: 'CAMERA_PERMISSION_IMAGE',
    defaultMessage: '拍摄精美照片需要使用相机',
    modalTitle: '需要相机权限',
    modalContent: '请在设置中允许使用相机，以便拍摄照片',
    successRoute: '/pages/camera/camera',
  },
  location: {
    title: '开启位置权限',
    scope: 'scope.userLocation',
    buttonText: '继续授权开启位置',
    configKey: 'LOCATION_PERMISSION_IMAGE',
    defaultMessage: '为您推荐附近景点模板需要获取位置',
    modalTitle: '需要位置权限',
    modalContent: '获取位置可为您推荐附近景点的精美模板',
    successRoute: '/pages/index/index', // 授权后返回首页
  },
  album: {
    title: '开启相册权限',
    scope: 'scope.writePhotosAlbum',
    buttonText: '继续授权保存相册',
    configKey: 'ALBUM_PERMISSION_IMAGE',
    defaultMessage: '保存精美照片到相册需要相册权限',
    modalTitle: '需要相册权限',
    modalContent: '请在设置中允许保存照片到相册',
    successRoute: '', // 授权后返回上一页
  },
}

Page({
  data: {
    statusBarHeight: 20,
    permissionType: 'camera', // 权限类型: camera / location / album
    config: null, // 当前权限配置
    permissionImageUrl: '', // 权限提醒图片URL
    hasCheckedPermission: false,
    fromPage: '', // 来源页面
  },

  onLoad(options) {
    console.log('[Permission Page] onLoad options:', options)

    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    // 获取权限类型（默认为camera）
    const permissionType = options.type || 'camera'
    const fromPage = options.from || ''

    // 验证权限类型
    if (!PERMISSION_CONFIG[permissionType]) {
      console.error('[Permission Page] 无效的权限类型:', permissionType)
      wx.navigateBack()
      return
    }

    const config = PERMISSION_CONFIG[permissionType]

    this.setData({
      permissionType,
      config,
      fromPage,
    })

    this.loadPermissionImage()
  },

  onShow() {
    // 每次显示页面时检查权限状态
    if (this.data.config) {
      this.checkPermission()
    }
  },

  // 加载权限提醒图片
  async loadPermissionImage() {
    const { config } = this.data

    try {
      const data = await request({
        url: '/api/trpc/public.getConfig',
        data: { key: config.configKey }
      })

      if (data && data.value) {
        this.setData({
          permissionImageUrl: data.value
        })
      } else {
        console.log('[Permission Page] 未配置权限图片，使用默认提示')
      }
    } catch (error) {
      console.error('[Permission Page] 加载权限提醒图片失败:', error)
    }
  },

  // 检查权限状态
  checkPermission() {
    const { config } = this.data

    wx.getSetting({
      success: (res) => {
        this.setData({ hasCheckedPermission: true })

        console.log('[Permission Page] 权限状态:', res.authSetting[config.scope])

        if (res.authSetting[config.scope]) {
          // 已授权，自动跳转
          this.navigateOnSuccess()
        }
      },
      fail: (err) => {
        console.error('[Permission Page] 检查权限失败:', err)
        this.setData({ hasCheckedPermission: true })
      }
    })
  },

  // 请求权限
  requestPermission() {
    const { config } = this.data

    console.log('[Permission Page] 请求权限:', config.scope)

    wx.authorize({
      scope: config.scope,
      success: () => {
        console.log('[Permission Page] 授权成功')
        wx.showToast({
          title: '授权成功',
          icon: 'success',
          duration: 1500
        })

        // 授权成功后跳转
        setTimeout(() => {
          this.navigateOnSuccess()
        }, 1500)
      },
      fail: (err) => {
        console.log('[Permission Page] 授权失败:', err)
        // 用户拒绝，引导去设置页
        this.openSetting()
      }
    })
  },

  // 授权成功后的跳转逻辑
  navigateOnSuccess() {
    const { config, fromPage } = this.data

    if (config.successRoute) {
      // 有指定跳转路径，使用redirectTo
      wx.redirectTo({
        url: config.successRoute,
        fail: () => {
          // 如果跳转失败，尝试返回上一页
          wx.navigateBack({
            fail: () => {
              // 返回失败，跳转首页
              wx.switchTab({ url: '/pages/index/index' })
            }
          })
        }
      })
    } else {
      // 没有指定路径，返回上一页
      wx.navigateBack({
        fail: () => {
          // 返回失败，跳转首页
          wx.switchTab({ url: '/pages/index/index' })
        }
      })
    }
  },

  // 打开设置页
  openSetting() {
    const { config } = this.data

    wx.showModal({
      title: config.modalTitle,
      content: config.modalContent,
      confirmText: '去设置',
      cancelText: '暂不使用',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              console.log('[Permission Page] 设置页返回:', settingRes.authSetting)

              if (settingRes.authSetting[config.scope]) {
                // 用户在设置中授权了
                wx.showToast({
                  title: '授权成功',
                  icon: 'success',
                  duration: 1500
                })

                setTimeout(() => {
                  this.navigateOnSuccess()
                }, 1500)
              } else {
                // 用户在设置中仍未授权
                wx.showToast({
                  title: '未授权',
                  icon: 'none',
                  duration: 2000
                })
              }
            },
            fail: (err) => {
              console.error('[Permission Page] 打开设置页失败:', err)
            }
          })
        } else {
          // 用户取消，返回上一页
          this.goBack()
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        // 返回失败，跳转首页
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  }
})

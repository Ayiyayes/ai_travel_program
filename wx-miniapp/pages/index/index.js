// pages/index/index.js
const { templateApi, promotionApi } = require('../../utils/api.js')

const TEMPLATE_VERSION_KEY = 'templateVersion'
const TEMPLATE_CACHE_PREFIX = 'templateCache:p1:'


Page({
  data: {
    statusBarHeight: 20,
    activeGroupCode: '',
    currentIndex: 0,
    groupTypes: [],
    templates: [],
    loading: false,
    loadingMore: false,
    refreshing: false,
    page: 0,
    pageSize: 10,
    hasMore: true,
    leftColumn: [],
    rightColumn: [],
    preloadComplete: false,
    placeholderImage: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  },

  // 内存标志：防止位置授权重复请求（比Storage更快）
  isRequestingLocation: false,
  // 缓存位置授权状态：true/false/undefined
  locationAuthStatus: undefined,
  // 是否已点击进入详情页（避免继续占用资源预加载）
  isNavigatingToDetail: false,
  // 图片懒加载观察器
  imageObserver: null,
  observedTemplateIds: new Set(),
  visibleTemplateIds: new Set(),
  supportsObserveAll: false,
  hasObservedAll: false,
  disableIntersectionObserver: false,

  onLoad(options) {
    // 获取状态栏高度（用于自定义导航栏）
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })

    // 处理推广链接
    this.handlePromotion(options)

    // 加载人群类型（完成后会自动加载模板）
    this.loadGroupTypes()

    // 预先读取位置授权状态，减少点击后的等待
    this.syncLocationAuthStatus()
  },

  onShow() {
    // 页面显示时刷新授权状态（用户可能从设置返回）
    this.syncLocationAuthStatus()
  },

  onUnload() {
    this.resetImageObserver()
  },

  onPullDownRefresh() {
    this.onRefresh()
  },

  getStoredTemplateVersion() {
    const value = Number(wx.getStorageSync(TEMPLATE_VERSION_KEY) || 0)
    return Number.isFinite(value) ? value : 0
  },

  async checkTemplateVersion() {
    try {
      const result = await templateApi.getVersion()
      const remoteVersion = result && result.version ? Number(result.version) : NaN
      if (!Number.isFinite(remoteVersion) || remoteVersion < 1) return false
      const localVersion = this.getStoredTemplateVersion()
      if (remoteVersion !== localVersion) {
        wx.setStorageSync(TEMPLATE_VERSION_KEY, remoteVersion)
        this.clearTemplateCache()
        return true
      }
    } catch (error) {
      console.log('[Version] load failed:', error)
    }
    return false
  },

  clearTemplateCache() {
    try {
      const info = wx.getStorageInfoSync()
      info.keys
        .filter((key) => key.indexOf(TEMPLATE_CACHE_PREFIX) === 0)
        .forEach((key) => wx.removeStorageSync(key))
    } catch (error) {
      console.log('[Cache] clear failed:', error)
    }
  },

  getTemplateCacheKey(groupCode) {
    return `${TEMPLATE_CACHE_PREFIX}${groupCode || 'all'}`
  },

  getCachedTemplates(groupCode) {
    try {
      const key = this.getTemplateCacheKey(groupCode)
      const cached = wx.getStorageSync(key)
      if (!cached) return null
      const parsed = JSON.parse(cached)
      if (!parsed || !Array.isArray(parsed.templates)) return null
      return parsed
    } catch (error) {
      console.log('[Cache] read failed:', error)
      return null
    }
  },

  saveTemplateCache(groupCode, payload) {
    try {
      const key = this.getTemplateCacheKey(groupCode)
      const data = {
        version: this.getStoredTemplateVersion(),
        templates: payload.templates || [],
        page: payload.page || 1,
        hasMore: payload.hasMore !== false,
        savedAt: Date.now()
      }
      wx.setStorageSync(key, JSON.stringify(data))
    } catch (error) {
      console.log('[Cache] save failed:', error)
    }
  },

  filterActiveTemplates(list) {
    return list.filter((item) => item && item.status !== 'inactive' && item.is_active !== false && item.isActive !== false)
  },


  // 同步缓存位置授权状态
  syncLocationAuthStatus() {
    wx.getSetting({
      success: (res) => {
        this.locationAuthStatus = res.authSetting['scope.userLocation']
        console.log('[Location] 缓存授权状态:', this.locationAuthStatus)
      },
      fail: (err) => {
        console.log('[Location] 获取授权状态失败:', err)
        this.locationAuthStatus = undefined
      }
    })
  },

  // 处理推广链接
  async handlePromotion(options) {
    const { channel, sales, city, spot } = options

    if (channel && sales) {
      try {
        const userOpenId = wx.getStorageSync('userOpenId') || `mp_${Date.now()}`
        wx.setStorageSync('userOpenId', userOpenId)

        await promotionApi.bindUser({
          userOpenId,
          channelCode: channel,
          salesCode: sales,
          city,
          scenicSpot: spot
        })

        console.log('推广绑定成功')
      } catch (error) {
        console.error('推广绑定失败:', error)
      }
    }
  },

  // 加载人群类型
  async loadGroupTypes() {
    try {
      const data = await templateApi.getGroupTypes('single')

      // 确保 data 是有效数组
      const groupTypes = Array.isArray(data) ? data : []

      this.setData({
        groupTypes: groupTypes
      })

      // 设置默认选中第一个人群类型，并加载对应模板
      if (groupTypes.length > 0 && !this.data.activeGroupCode) {
        this.setData({
          activeGroupCode: groupTypes[0].code,
          currentIndex: 0
        })
        const versionChanged = await this.checkTemplateVersion()
        this.loadTemplates({ reset: true, forceRefresh: versionChanged })
      } else if (groupTypes.length === 0) {
        console.warn('[Index] 人群类型列表为空，请检查后端服务是否运行')
      }
    } catch (error) {
      console.error('[Index] 加载人群类型失败:', error)
      // 设置空数组避免渲染错误
      this.setData({
        groupTypes: []
      })
    }
  },

  resetListState() {
    this.resetImageObserver()
    this.setData({
      templates: [],
      leftColumn: [],
      rightColumn: [],
      page: 0,
      hasMore: true
    })
  },

  normalizeTemplates(list) {
    const apiBaseUrl = getApp().globalData.apiBaseUrl
    return list.map((tpl) => {
      const item = { ...tpl }
      if (item.imageUrl && item.imageUrl.startsWith('/')) {
        item.imageUrl = apiBaseUrl + item.imageUrl
      }
      if (item.thumbnailUrl && item.thumbnailUrl.startsWith('/')) {
        item.thumbnailUrl = apiBaseUrl + item.thumbnailUrl
      }
      if (item.imageWebpUrl && item.imageWebpUrl.startsWith('/')) {
        item.imageWebpUrl = apiBaseUrl + item.imageWebpUrl
      }
      if (item.thumbnailWebpUrl && item.thumbnailWebpUrl.startsWith('/')) {
        item.thumbnailWebpUrl = apiBaseUrl + item.thumbnailWebpUrl
      }
      if (!item.thumbnailUrl && item.imageUrl) {
        item.thumbnailUrl = item.imageUrl
      }
      if (!item.thumbnailWebpUrl && item.imageWebpUrl) {
        item.thumbnailWebpUrl = item.imageWebpUrl
      }
      return item
    })
  },

  buildColumns(templates) {
    const leftColumn = []
    const rightColumn = []

    templates.forEach((tpl, index) => {
      const idKey = String(tpl.id)
      tpl.__visible = this.visibleTemplateIds.has(idKey)
      if (index % 2 === 0) {
        leftColumn.push(tpl)
      } else {
        rightColumn.push(tpl)
      }
    })

    return { leftColumn, rightColumn }
  },

  initImageObserver() {
    if (this.imageObserver) return

    this.imageObserver = wx.createIntersectionObserver(this)
    this.supportsObserveAll = typeof this.imageObserver.observeAll === 'function'
    this.hasObservedAll = false
    const scrollSelector = `#templates-scroll-${this.data.activeGroupCode}`

    try {
      this.imageObserver.relativeTo(scrollSelector, { bottom: 120 })
    } catch (error) {
      this.imageObserver.relativeToViewport({ bottom: 120 })
    }
  },

  observeTemplateItems() {
    if (!this.imageObserver) return

    if (this.disableIntersectionObserver) {
      this.markAllVisible()
      return
    }

    if (this.supportsObserveAll) {
      if (this.hasObservedAll) return
      this.hasObservedAll = true
      try {
        this.imageObserver.observeAll('.observe-item', (res) => {
          this.handleIntersectionEntries(res)
        })
      } catch (error) {
        console.log('[Observer] observeAll failed:', error)
        this.disableIntersectionObserver = true
        this.markAllVisible()
      }
      return
    }

    this.disableIntersectionObserver = true
    this.markAllVisible()
  },

  handleIntersectionEntries(res) {
    if (Array.isArray(res)) {
      res.forEach((entry) => this.handleTemplateIntersection(entry))
      return
    }
    this.handleTemplateIntersection(res)
  },

  markAllVisible() {
    const markVisible = (list) => list.map((tpl) => {
      if (!tpl || tpl.id === undefined || tpl.id === null) return tpl
      const idKey = String(tpl.id)
      this.visibleTemplateIds.add(idKey)
      return { ...tpl, __visible: true }
    })

    const leftColumn = markVisible(this.data.leftColumn)
    const rightColumn = markVisible(this.data.rightColumn)
    this.setData({ leftColumn, rightColumn })
  },

  handleTemplateIntersection(res) {
    if (!res || res.intersectionRatio <= 0) return
    const dataset = res.dataset || {}
    const column = dataset.column
    const index = Number(dataset.index)
    const idKey = dataset.id !== undefined ? String(dataset.id) : ''

    if (!column || Number.isNaN(index) || !idKey) return
    if (this.visibleTemplateIds.has(idKey)) return

    this.visibleTemplateIds.add(idKey)

    const listName = column === 'left' ? 'leftColumn' : 'rightColumn'
    const path = `${listName}[${index}].__visible`
    this.setData({ [path]: true })
  },

  resetImageObserver() {
    if (this.imageObserver) {
      this.imageObserver.disconnect()
      this.imageObserver = null
    }
    this.observedTemplateIds = new Set()
    this.visibleTemplateIds = new Set()
    this.supportsObserveAll = false
    this.hasObservedAll = false
    this.disableIntersectionObserver = false
  },

  // 加载模板列表
  async loadTemplates(options = {}) {
    if (!this.data.activeGroupCode) return

    const reset = options.reset === true
    const forceRefresh = options.forceRefresh === true
    if (reset) {
      this.resetListState()
    } else if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return
    }

    const targetPage = reset ? 1 : this.data.page + 1

    if (reset) {
      this.setData({ loading: true, loadingMore: false })
    } else {
      this.setData({ loadingMore: true })
    }

    if (reset && !forceRefresh) {
      const cached = this.getCachedTemplates(this.data.activeGroupCode)
      if (cached && Array.isArray(cached.templates) && cached.templates.length > 0) {
        const cleaned = this.filterActiveTemplates(cached.templates)
        const normalizedCache = this.normalizeTemplates(cleaned)
        const cachedPage = Number(cached.page) || 1
        const cachedHasMore = cached.hasMore !== false
        const { leftColumn, rightColumn } = this.buildColumns(normalizedCache)

        this.setData({
          templates: normalizedCache,
          leftColumn,
          rightColumn,
          page: cachedPage,
          hasMore: cachedHasMore
        }, () => {
          this.initImageObserver()
          this.observeTemplateItems()
        })

        const cachedVersion = Number(cached.version) || 0
        const localVersion = this.getStoredTemplateVersion()
        if (cachedVersion && cachedVersion === localVersion) {
          this.setData({ loading: false, loadingMore: false })
          return
        }
      }
    }


    try {
      const data = await templateApi.getList({
        groupType: this.data.activeGroupCode,
        page: targetPage,
        pageSize: this.data.pageSize
      })

      // 确保 data 是有效数组
      const list = Array.isArray(data) ? data : []
      const cleaned = this.filterActiveTemplates(list)
      const normalized = this.normalizeTemplates(cleaned)
      const templates = reset ? normalized : this.data.templates.concat(normalized)
      const { leftColumn, rightColumn } = this.buildColumns(templates)
      const hasMore = normalized.length >= this.data.pageSize

      this.setData({
        templates,
        leftColumn,
        rightColumn,
        page: targetPage,
        hasMore: hasMore
      }, () => {
        this.saveTemplateCache(this.data.activeGroupCode, {
          templates,
          page: targetPage,
          hasMore
        })
        this.initImageObserver()
        this.observeTemplateItems()
      })
    } catch (error) {
      console.error('[Index] 加载模板列表失败:', error)
      if (reset) {
        this.setData({
          templates: [],
          leftColumn: [],
          rightColumn: [],
          hasMore: false
        })
      }
      wx.showToast({
        title: '加载失败，请检查网络',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false, loadingMore: false })
    }
  },

  loadMore() {
    this.loadTemplates({ reset: false })
  },

  // 点击切换人群类型
  switchGroupType(e) {
    const code = e.currentTarget.dataset.code
    const index = parseInt(e.currentTarget.dataset.index)
    if (this.data.activeGroupCode === code) return

    this.setData({
      activeGroupCode: code,
      currentIndex: index
    })
    this.loadTemplates({ reset: true })
  },

  // swiper 滑动切换
  onSwiperChange(e) {
    const index = e.detail.current
    const groupTypes = this.data.groupTypes

    if (index >= 0 && index < groupTypes.length) {
      const code = groupTypes[index].code
      if (this.data.activeGroupCode !== code) {
        this.setData({
          activeGroupCode: code,
          currentIndex: index
        })
        this.loadTemplates({ reset: true })
      }
    }
  },

  // 从当前列表中找到模板
  findTemplateById(templateId) {
    const templates = Array.isArray(this.data.templates) ? this.data.templates : []
    return templates.find(t => Number(t.id) === Number(templateId)) || null
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id || Number.isNaN(id)) {
      wx.showToast({
        title: '模板参数缺失',
        icon: 'none'
      })
      return
    }

    this.isNavigatingToDetail = true

    const selectedTemplate = this.findTemplateById(id)
    if (selectedTemplate) {
      wx.setStorageSync('lastSelectedTemplate', JSON.stringify(selectedTemplate))
    }

    const navigate = () => {
      wx.navigateTo({
        url: `/pages/template-detail/template-detail?id=${id}`,
        success: (res) => {
          if (selectedTemplate && res && res.eventChannel) {
            res.eventChannel.emit('template', selectedTemplate)
          }
        }
      })
    }

    // 如果是首次授权，先弹出授权，再进入详情
    if (this.locationAuthStatus === undefined) {
      if (this.isRequestingLocation) {
        navigate()
        return
      }

      this.isRequestingLocation = true
      console.log('[Location] 立即请求位置授权...')

      wx.authorize({
        scope: 'scope.userLocation',
        success: () => {
          console.log('[Location] 用户同意授权，开始获取位置')
          this.locationAuthStatus = true
          this.saveUserLocation()
        },
        fail: (err) => {
          console.log('[Location] 用户拒绝位置授权', err)
          this.locationAuthStatus = false
        },
        complete: () => {
          this.isRequestingLocation = false
          navigate()
        }
      })
      return
    }

    if (this.locationAuthStatus === true) {
      this.saveUserLocation()
    } else if (this.locationAuthStatus === false) {
      // 不阻塞跳转，给提示即可
      this.promptOpenLocationSetting()
    }

    navigate()
  },

  // 引导用户去设置开启定位权限
  promptOpenLocationSetting() {
    wx.showModal({
      title: '需要位置信息',
      content: '用于推荐附近景点，请在设置中开启定位权限。',
      confirmText: '去设置',
      success: (res) => {
        if (!res.confirm) return

        wx.openSetting({
          success: (settingRes) => {
            const status = settingRes.authSetting['scope.userLocation']
            this.locationAuthStatus = status
            if (status) {
              console.log('[Location] 设置页已开启授权，开始获取位置')
              this.saveUserLocation()
            }
          }
        })
      }
    })
  },

  // 保存用户位置
  async saveUserLocation() {
    try {
      const location = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'wgs84',
          success: resolve,
          fail: reject
        })
      })

      // 保存位置信息
      wx.setStorageSync('userLocation', {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now()
      })

      console.log('位置保存成功:', location)
    } catch (error) {
      console.error('获取位置失败:', error)
    }
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadTemplates({ reset: true, forceRefresh: true })
    this.setData({ refreshing: false })
    wx.stopPullDownRefresh()
  },

  // 跳转到我的照片页面
  goToMyPhotos() {
    wx.navigateTo({
      url: '/pages/my-photos/my-photos'
    })
  }
})

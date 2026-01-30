// P8 付费模板选择页 - 老用户入口

const { templateApi } = require('../../utils/api.js')

const { request } = require('../../utils/request.js')



const TEMPLATE_VERSION_KEY = 'templateVersion'

const TEMPLATE_CACHE_PREFIX = 'templateCache:p8:'



// 滚动控制常量

const TEMPLATE_HEIGHT = 250 // 模板高度阈值（px）

const SCROLL_THRESHOLD = 30 // 滚动方向判断阈值



Page({

  data: {

    statusBarHeight: 20,
    navTop: 0,
    navHeight: 44,
    navBarHeight: 88,

    points: 0, // 用户积分

    currentCity: '', // 当前选择的城市

    cities: [], // 城市列表

    currentSpot: '', // 当前选择的景点

    currentSpotName: '全部景点', // 当前选择的景点名称（用于显示）

    scenicSpots: [], // 景点列表

    activeGroupCode: '',

    activeGroupName: '选择类型', // 当前选择的人群类型名称

    currentIndex: 0,

    groupTypes: [],

    singleGroupTypes: [], // 单照人群类型

    multiGroupTypes: [], // 合照人群类型

    photoTypeTab: 'single', // 当前选中的照片类型tab

    templates: [],

    loading: false,

    loadingMore: false,

    refreshing: false,

    page: 0,

    pageSize: 10,

    hasMore: true,

    leftColumn: [],

    rightColumn: [],

    placeholderImage: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',

    showCityPickerModal: false,

    showSpotPickerModal: false, // 景点选择弹窗

    showGroupTypePickerModal: false, // 人群类型选择弹窗



    // 多选相关

    selectedTemplates: [], // 已选模板ID数组

    totalPoints: 0, // 总积分消耗

    deductPoints: 0, // 抵扣积分

    payAmount: 0, // 实际支付金额

    showCartBar: false, // 是否显示底部购物车



    // 智能滚动控制

    showFilters: true, // 是否显示筛选栏

    lastScrollTop: 0, // 上次滚动位置

    accumulatedScroll: 0 // 累积滚动距离

  },



  // 滚动防抖定时器

  scrollDebounceTimer: null,



  // Image lazy load observer

  imageObserver: null,

  observedTemplateIds: new Set(),

  visibleTemplateIds: new Set(),

  supportsObserveAll: false,

  hasObservedAll: false,

  disableIntersectionObserver: false,



  onLoad(options) {

    // 获取状态栏高度

    this.initNavBar()



    // 加载用户积分

    this.loadUserPoints()



    // 加载城市列表

    this.loadCities()



    // 加载人群类型

    this.loadGroupTypes()

  },



  onShow() {

    // 每次显示页面时刷新积分

    this.loadUserPoints()

  },



  onUnload() {

    this.resetImageObserver()

  },



  onPullDownRefresh() {

    this.onRefresh()

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
        statusBarHeight,
        navTop,
        navHeight,
        navBarHeight
      })
    } catch (error) {
      this.setData({
        statusBarHeight: 20,
        navTop: 20,
        navHeight: 44,
        navBarHeight: 88
      })
    }
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



  getTemplateCacheKey() {

    const photoType = this.data.photoTypeTab || 'single'

    const city = this.data.currentCity || 'all'

    const spot = this.data.currentSpot || 'all'

    const group = this.data.activeGroupCode || 'all'

    const parts = [photoType, city, spot, group].map((value) => encodeURIComponent(String(value)))

    return `${TEMPLATE_CACHE_PREFIX}${parts.join(':')}`

  },



  getCachedTemplates() {

    try {

      const key = this.getTemplateCacheKey()

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



  saveTemplateCache(payload) {

    try {

      const key = this.getTemplateCacheKey()

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





  // 加载用户积分

  async loadUserPoints() {

    try {

      const userOpenId = wx.getStorageSync('userOpenId')

      if (!userOpenId) return



      const result = await request({

        url: '/api/trpc/mp.getUserStatus',

        data: { userOpenId }

      })



      if (result && result.points !== undefined) {

        this.setData({ points: result.points })

      }

    } catch (error) {

      console.error('加载积分失败:', error)

    }

  },



  // 加载城市列表

  async loadCities() {

    try {

      const citiesData = await templateApi.getCities()

      console.log('[P8] 原始城市数据:', JSON.stringify(citiesData))



      // API返回的可能是对象数组或字符串数组，统一处理为字符串数组

      const cities = (citiesData || []).map(c => {

        if (typeof c === 'string') return c

        if (c && typeof c === 'object' && c.name) return String(c.name)

        return '' // 无法识别的格式返回空字符串

      }).filter(c => c) // 过滤掉空字符串



      console.log('[P8] 处理后的城市列表:', cities)

      this.setData({ cities })



      // 默认选择第一个城市

      if (cities && cities.length > 0 && !this.data.currentCity) {

        const firstCity = cities[0]

        console.log('[P8] 设置默认城市:', firstCity, typeof firstCity)

        this.setData({ currentCity: firstCity })

        // 加载该城市的景点

        this.loadScenicSpots(firstCity)

      }

    } catch (error) {

      console.error('加载城市列表失败:', error)

    }

  },



  // 加载景点列表（根据城市）

  async loadScenicSpots(city) {

    if (!city) return



    try {

      const spotsData = await templateApi.getScenicSpots(city)

      console.log('[P8] 原始景点数据:', JSON.stringify(spotsData))



      // API返回的可能是字符串数组或对象数组，统一处理

      const spots = (spotsData || []).map(s => {

        if (typeof s === 'string') return s

        if (s && typeof s === 'object' && s.name) return String(s.name)

        if (s && typeof s === 'object' && s.scenicSpot) return String(s.scenicSpot)

        return ''

      }).filter(s => s)



      console.log('[P8] 处理后的景点列表:', spots)



      // 添加"全部"选项

      const scenicSpots = [

        { name: '全部景点', value: '' },

        ...spots.map(s => ({ name: s, value: s }))

      ]



      console.log('[P8] 最终景点选项:', JSON.stringify(scenicSpots))



      this.setData({

        scenicSpots,

        currentSpot: '', // 默认选择"全部景点"

        currentSpotName: '全部景点'

      })

    } catch (error) {

      console.error('加载景点列表失败:', error)

      this.setData({

        scenicSpots: [{ name: '全部景点', value: '' }],

        currentSpot: '',

        currentSpotName: '全部景点'

      })

    }

  },



  // 加载人群类型（单照和合照）

  async loadGroupTypes() {

    try {

      // 加载单照类型

      console.log('[P8] 开始加载单照类型...')

      const singleData = await templateApi.getGroupTypes('single') || []

      console.log('[P8] 单照类型结果:', singleData.length, '条', singleData)



      // 加载合照类型（数据库中使用 'group' 而非 'multi'）

      console.log('[P8] 开始加载合照类型 (photoType=group)...')

      let multiData = []

      try {

        multiData = await templateApi.getGroupTypes('group') || []

        console.log('[P8] 合照类型结果:', multiData.length, '条', multiData)

      } catch (e) {

        console.error('[P8] 合照类型加载失败:', e)

      }



      const allTypes = [...singleData, ...multiData]

      console.log('[P8] 总计人群类型:', allTypes.length, '条')



      this.setData({

        groupTypes: allTypes,

        singleGroupTypes: singleData,

        multiGroupTypes: multiData

      })



      // 设置默认选中第一个人群类型

      if (allTypes.length > 0 && !this.data.activeGroupCode) {

        const firstType = allTypes[0]

        this.setData({

          activeGroupCode: firstType.code || '',

          activeGroupName: firstType.displayName || firstType.name || '选择类型',

          currentIndex: 0

        })

        const versionChanged = await this.checkTemplateVersion()

        this.loadTemplates({ reset: true, forceRefresh: versionChanged })

      } else if (allTypes.length === 0) {

        console.warn('[P8] 未加载到任何人群类型')

        wx.showToast({

          title: '暂无可用模板类型',

          icon: 'none'

        })

      }

    } catch (error) {

      console.error('[P8] 加载人群类型失败:', error)

      wx.showToast({

        title: '数据加载失败',

        icon: 'none'

      })

    }

  },



  // 加载模板列表

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

    try {

      this.imageObserver.relativeTo('.templates-scroll', { bottom: 120 })

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



  // Load templates

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

      const cached = this.getCachedTemplates()

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

      const params = {

        groupType: this.data.activeGroupCode,

        page: targetPage,

        pageSize: this.data.pageSize

      }



      if (this.data.currentCity) {

        params.city = this.data.currentCity

      }



      if (this.data.currentSpot) {

        params.scenicSpot = this.data.currentSpot

      }



      const data = await templateApi.getList(params)



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

        this.saveTemplateCache({

          templates,

          page: targetPage,

          hasMore

        })

        this.initImageObserver()

        this.observeTemplateItems()

      })

    } catch (error) {

      console.error('[P8] Load templates failed:', error)

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



  switchGroupType(e) {

    const code = e.currentTarget.dataset.code

    const index = parseInt(e.currentTarget.dataset.index)

    if (this.data.activeGroupCode === code) return



    // 切换人群类型时清空已选模板

    if (this.data.selectedTemplates.length > 0) {

      const hasWarned = wx.getStorageSync('hasWarnedGroupTypeSwitch')

      if (!hasWarned) {

        wx.showModal({

          title: '提示',

          content: '切换人群类型后，已选模板将被清空',

          confirmText: '继续',

          cancelText: '取消',

          success: (res) => {

            if (res.confirm) {

              wx.setStorageSync('hasWarnedGroupTypeSwitch', true)

              this.clearSelection()

              this.setData({

                activeGroupCode: code,

                currentIndex: index

              })

              this.loadTemplates({ reset: true })

            }

          }

        })

        return

      }

      this.clearSelection()

    }



    this.setData({

      activeGroupCode: code,

      currentIndex: index

    })

    this.loadTemplates({ reset: true })

  },



  // swiper滑动切换

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



  // 跳转到详情页

  goToDetail(e) {

    const id = e.currentTarget.dataset.id

    wx.navigateTo({

      url: `/pages/template-detail/template-detail?id=${id}`

    })

  },



  // 预览模板大图（全屏）

  previewTemplate(e) {

    const url = e.currentTarget.dataset.url

    if (!url) return



    // 收集所有模板图片URL用于预览

    const urls = this.data.templates

      .map(t => t.imageWebpUrl || t.imageUrl || t.thumbnailWebpUrl || t.thumbnailUrl)

      .filter(u => u)

    const current = url



    wx.previewImage({

      current,

      urls,

      fail: (err) => {

        console.error('[P8] 预览图片失败:', err)

      }

    })

  },



  // ========== 智能滚动控制 ==========

  handleScroll(e) {

    const scrollTop = e.detail.scrollTop

    const scrollDelta = scrollTop - this.data.lastScrollTop

    const { selectedTemplates, showFilters, accumulatedScroll } = this.data



    // 只有选中模板时才启用智能滚动

    if (selectedTemplates.length === 0) {

      if (!showFilters) {

        this.setData({ showFilters: true })

      }

      this.setData({ lastScrollTop: scrollTop })

      return

    }



    // 防抖处理

    if (this.scrollDebounceTimer) {

      clearTimeout(this.scrollDebounceTimer)

    }



    this.scrollDebounceTimer = setTimeout(() => {

      if (Math.abs(scrollDelta) > SCROLL_THRESHOLD) {

        if (scrollDelta > 0) {

          // 向下滚动 - 隐藏筛选器，显示支付栏

          this.setData({

            showFilters: false,

            showCartBar: true,

            accumulatedScroll: 0

          })

        } else {

          // 向上滚动 - 累积距离

          const newAccumulated = accumulatedScroll + Math.abs(scrollDelta)

          if (newAccumulated >= TEMPLATE_HEIGHT) {

            // 累积超过一个模板高度，显示筛选器，隐藏支付栏

            this.setData({

              showFilters: true,

              showCartBar: false,

              accumulatedScroll: 0

            })

          } else {

            this.setData({ accumulatedScroll: newAccumulated })

          }

        }

      }

      this.setData({ lastScrollTop: scrollTop })

    }, 16) // 约60fps

  },



  // 下拉刷新

  async onRefresh() {

    this.setData({ refreshing: true })

    await this.loadTemplates({ reset: true, forceRefresh: true })

    await this.loadUserPoints()

    this.setData({ refreshing: false })

    wx.stopPullDownRefresh()

  },



  // 显示城市选择器

  showCityPicker() {

    this.setData({ showCityPickerModal: true })

  },



  // 隐藏城市选择器

  hideCityPicker() {

    this.setData({ showCityPickerModal: false })

  },



  // 选择城市（在全屏选择器中，只更新景点列表，不关闭弹窗）

  selectCity(e) {

    const city = e.currentTarget.dataset.city

    console.log('[P8] 选择城市:', city, typeof city)

    this.setData({

      currentCity: city

    })

    // 加载该城市的景点（不关闭弹窗）

    this.loadScenicSpots(city)

  },



  // 显示景点选择器

  showSpotPicker() {

    // 如果城市列表为空，先加载

    if (this.data.cities.length === 0) {

      this.loadCities()

    }

    this.setData({ showSpotPickerModal: true })

  },



  // 隐藏景点选择器

  hideSpotPicker() {

    this.setData({ showSpotPickerModal: false })

  },



  // 选择景点

  selectSpot(e) {

    const spot = e.currentTarget.dataset.spot

    const spotName = e.currentTarget.dataset.name



    this.setData({

      currentSpot: spot,

      currentSpotName: spotName,

      showSpotPickerModal: false

    })



    // 重新加载模板

    this.loadTemplates({ reset: true })

  },



  // 显示人群类型选择器

  showGroupTypePicker() {

    if (this.data.groupTypes.length === 0) {

      wx.showToast({

        title: '加载人群类型中...',

        icon: 'none'

      })

      return

    }

    this.setData({ showGroupTypePickerModal: true })

  },



  // 隐藏人群类型选择器

  hideGroupTypePicker() {

    this.setData({ showGroupTypePickerModal: false })

  },



  // 选择人群类型

  selectGroupType(e) {

    const code = e.currentTarget.dataset.code

    const name = e.currentTarget.dataset.name



    if (this.data.activeGroupCode === code) {

      this.setData({ showGroupTypePickerModal: false })

      return

    }



    // 切换人群类型时清空已选模板

    if (this.data.selectedTemplates.length > 0) {

      this.clearSelection()

    }



    this.setData({

      activeGroupCode: code,

      activeGroupName: name,

      showGroupTypePickerModal: false

    })

    this.loadTemplates({ reset: true })

  },



  // 选择景点并关闭弹窗（全屏选择器用）

  selectSpotAndClose(e) {

    const spot = e.currentTarget.dataset.spot

    const spotName = e.currentTarget.dataset.name



    console.log('[P8] 选择景点:', spotName, spot)



    this.setData({

      currentSpot: spot,

      currentSpotName: spotName,

      showSpotPickerModal: false

    })



    // 重新加载模板

    this.loadTemplates({ reset: true })

  },



  // 选择人群类型并关闭弹窗（全屏选择器用）

  selectGroupTypeAndClose(e) {

    const code = e.currentTarget.dataset.code

    const name = e.currentTarget.dataset.name



    if (this.data.activeGroupCode === code) {

      this.setData({ showGroupTypePickerModal: false })

      return

    }



    // 切换人群类型时清空已选模板

    if (this.data.selectedTemplates.length > 0) {

      this.clearSelection()

    }



    this.setData({

      activeGroupCode: code,

      activeGroupName: name,

      showGroupTypePickerModal: false

    })

    this.loadTemplates({ reset: true })

  },



  // 切换照片类型tab（单照/合照）

  switchPhotoTypeTab(e) {

    const type = e.currentTarget.dataset.type

    this.setData({ photoTypeTab: type })

  },



  // ========== 模板多选功能 ==========



  // 切换模板选中状态

  toggleTemplateSelect(e) {

    const id = e.currentTarget.dataset.id

    let selectedTemplates = [...this.data.selectedTemplates]



    const index = selectedTemplates.indexOf(id)

    if (index > -1) {

      // 取消选中

      selectedTemplates.splice(index, 1)

    } else {

      // 选中

      selectedTemplates.push(id)

    }



    this.setData({ selectedTemplates })

    this.calculateTotal()

  },



  // 计算总价和积分抵扣

  calculateTotal() {

    const { selectedTemplates, templates, points } = this.data



    if (selectedTemplates.length === 0) {

      this.setData({

        totalPoints: 0,

        deductPoints: 0,

        payAmount: 0,

        showCartBar: false

      })

      return

    }



    // 找出所有选中的模板对象

    const selectedObjs = templates.filter(t => selectedTemplates.includes(t.id))



    // 计算总积分消耗

    const totalPoints = selectedObjs.reduce((sum, t) => sum + (t.pointsCost || 1), 0)



    // 计算积分抵扣（最多抵扣总积分）

    const deductPoints = Math.min(points, totalPoints)



    // 计算实际支付金额（1积分=1元）

    const payAmount = totalPoints - deductPoints



    this.setData({

      totalPoints,

      deductPoints,

      payAmount,

      showCartBar: true

    })

  },



  // 清空选择

  clearSelection() {

    this.setData({

      selectedTemplates: [],

      totalPoints: 0,

      deductPoints: 0,

      payAmount: 0,

      showCartBar: false

    })

  },



  // 检查模板是否被选中

  isTemplateSelected(templateId) {

    return this.data.selectedTemplates.includes(templateId)

  },



  // ========== 支付流程 ==========



  // 处理支付

  async handlePay() {

    const { selectedTemplates, payAmount, totalPoints, deductPoints } = this.data



    if (selectedTemplates.length === 0) {

      wx.showToast({

        title: '请先选择模板',

        icon: 'none'

      })

      return

    }



    // 显示支付确认

    const confirmText = payAmount > 0

      ? `共消耗${totalPoints}积分，已抵扣${deductPoints}分，还需支付${payAmount}元`

      : `共消耗${totalPoints}积分，已完全抵扣，无需支付现金`



    wx.showModal({

      title: '确认支付',

      content: confirmText,

      confirmText: '确认',

      cancelText: '取消',

      success: async (res) => {

        if (res.confirm) {

          if (payAmount === 0) {

            // 积分完全抵扣，直接创建订单

            await this.createPhotos()

          } else {

            // 需要微信支付

            await this.wxPay()

          }

        }

      }

    })

  },



  // 微信支付

  async wxPay() {

    wx.showToast({

      title: '微信支付开发中',

      icon: 'none',

      duration: 2000

    })

    // TODO: 实现微信支付流程

    // 1. 调用后端创建支付订单

    // 2. 获取支付参数

    // 3. 调用wx.requestPayment

    // 4. 支付成功后调用createPhotos

  },



  // 创建照片生成任务

  async createPhotos() {

    const { selectedTemplates } = this.data

    const userOpenId = wx.getStorageSync('userOpenId')



    if (!userOpenId) {

      wx.showToast({

        title: '请先登录',

        icon: 'none'

      })

      return

    }



    wx.showLoading({ title: '正在创建任务...' })



    try {

      // 获取用户最后一次上传的自拍照

      const userStatus = wx.getStorageSync('userStatus')

      const lastSelfieUrl = userStatus?.lastSelfieUrl



      if (!lastSelfieUrl) {

        wx.hideLoading()

        wx.showModal({

          title: '提示',

          content: '未找到自拍照，请先上传自拍',

          confirmText: '去上传',

          success: (res) => {

            if (res.confirm) {

              wx.redirectTo({

                url: '/pages/index/index'

              })

            }

          }

        })

        return

      }



      // 调用后端API创建批量照片任务

      const result = await request({

        url: '/api/trpc/photo.createBatchPublic',

        method: 'POST',

        data: {

          userOpenId,

          templateIds: selectedTemplates,

          selfieUrl: lastSelfieUrl

        }

      })



      wx.hideLoading()



      if (result && result.photoIds && result.photoIds.length > 0) {

        // 保存待处理订单信息到Storage

        wx.setStorageSync('pendingOrder', {

          photoId: result.photoIds[0], // 主photoId

          photoIds: result.photoIds,

          photoCount: selectedTemplates.length

        })



        // 跳转到生成等待页

        wx.redirectTo({

          url: '/pages/generating/generating'

        })

      } else {

        throw new Error('创建任务失败')

      }

    } catch (error) {

      wx.hideLoading()

      console.error('创建照片失败:', error)

      wx.showModal({

        title: '创建失败',

        content: error.message || '创建照片任务失败，请重试',

        showCancel: false

      })

    }

  },



  // 跳转到积分详情页（预留）

  goToPointsDetail() {

    wx.showToast({

      title: '积分详情开发中',

      icon: 'none'

    })

  },



  // 返回我的照片页面

  goBack() {

    wx.redirectTo({

      url: '/pages/my-photos/my-photos'

    })

  }

})













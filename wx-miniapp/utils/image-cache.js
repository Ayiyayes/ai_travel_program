// 图片缓存管理工具 - 混合策略版本
// 策略：模板图片永久缓存（高复用），用户照片临时缓存（低复用）

const MAX_PERMANENT_CACHE_SIZE = 8 * 1024 * 1024 // 8MB 永久缓存上限（微信限制10MB，保留2MB余量）
const CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000 // 7天过期

/**
 * 判断图片类型
 * @param {string} url - 图片URL
 * @returns {string} 'template' | 'user'
 */
function getImageType(url) {
  if (!url) return 'user'

  // 模板图片特征：包含 /uploads/templates/ 或 /static/templates/
  if (url.includes('/uploads/templates/') ||
      url.includes('/static/templates/') ||
      url.includes('template') ||
      url.includes('thumbnail')) {
    return 'template'
  }

  // 用户照片特征：包含 /uploads/photos/、/uploads/selfies/、/result/
  if (url.includes('/uploads/photos/') ||
      url.includes('/uploads/selfies/') ||
      url.includes('/result/') ||
      url.includes('selfie') ||
      url.includes('photo')) {
    return 'user'
  }

  // 默认当作用户照片（临时缓存）
  return 'user'
}

/**
 * 图片缓存管理类（混合策略）
 */
class ImageCache {
  constructor() {
    // 永久缓存索引：url -> { path, size, type: 'permanent' }
    this.permanentCache = new Map()
    // 临时缓存索引：url -> { path, type: 'temp' }
    this.tempCache = new Map()

    this.loadCacheFromStorage()
  }

  /**
   * 从本地存储加载缓存索引
   */
  loadCacheFromStorage() {
    try {
      const cacheIndex = wx.getStorageSync('imageCache_index')
      if (cacheIndex && cacheIndex.permanent) {
        this.permanentCache = new Map(Object.entries(cacheIndex.permanent))
      }
      if (cacheIndex && cacheIndex.temp) {
        this.tempCache = new Map(Object.entries(cacheIndex.temp))
      }
      console.log(`[ImageCache] Loaded cache: ${this.permanentCache.size} permanent, ${this.tempCache.size} temp`)
    } catch (error) {
      console.error('[ImageCache] Load cache index failed:', error)
    }
  }

  /**
   * 保存缓存索引到本地存储
   */
  saveCacheToStorage() {
    try {
      const cacheIndex = {
        permanent: Object.fromEntries(this.permanentCache),
        temp: Object.fromEntries(this.tempCache)
      }
      wx.setStorageSync('imageCache_index', cacheIndex)
    } catch (error) {
      console.error('[ImageCache] Save cache index failed:', error)
    }
  }

  /**
   * 获取缓存的图片路径
   * @param {string} url - 图片URL
   * @returns {Promise<string|null>} 本地缓存路径或null
   */
  async get(url) {
    if (!url) return null

    // 先检查永久缓存
    const permanentInfo = this.permanentCache.get(url)
    if (permanentInfo) {
      const exists = await this.fileExists(permanentInfo.path)
      if (exists) {
        return permanentInfo.path
      } else {
        // 文件不存在，移除索引
        this.permanentCache.delete(url)
        this.saveCacheToStorage()
      }
    }

    // 再检查临时缓存
    const tempInfo = this.tempCache.get(url)
    if (tempInfo) {
      const exists = await this.fileExists(tempInfo.path)
      if (exists) {
        return tempInfo.path
      } else {
        // 文件不存在，移除索引
        this.tempCache.delete(url)
        this.saveCacheToStorage()
      }
    }

    return null
  }

  /**
   * 检查文件是否存在
   * @param {string} path - 文件路径
   * @returns {Promise<boolean>}
   */
  async fileExists(path) {
    try {
      const fileManager = wx.getFileSystemManager()
      await new Promise((resolve, reject) => {
        fileManager.access({
          path,
          success: resolve,
          fail: reject
        })
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 下载并缓存图片（混合策略）
   * @param {string} url - 图片URL
   * @param {string} type - 图片类型（可选，自动检测）
   * @returns {Promise<string>} 本地缓存路径
   */
  async download(url, type) {
    if (!url) throw new Error('URL is required')

    // 检查是否已缓存
    const cachedPath = await this.get(url)
    if (cachedPath) {
      console.log(`[ImageCache] Cache hit: ${url.substring(url.lastIndexOf('/') + 1)}`)
      return cachedPath
    }

    // 判断图片类型
    const imageType = type || getImageType(url)
    console.log(`[ImageCache] Downloading ${imageType}: ${url.substring(url.lastIndexOf('/') + 1)}`)

    try {
      // 下载图片到临时目录
      const downloadResult = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url,
          success: resolve,
          fail: reject
        })
      })

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with status ${downloadResult.statusCode}`)
      }

      const tempFilePath = downloadResult.tempFilePath

      // 根据类型决定缓存策略
      if (imageType === 'template') {
        // 模板图片：保存到永久缓存
        return await this.saveToPermanentCache(url, tempFilePath)
      } else {
        // 用户照片：保留在临时目录
        return await this.saveToTempCache(url, tempFilePath)
      }
    } catch (error) {
      console.error('[ImageCache] Download failed:', error)
      throw error
    }
  }

  /**
   * 保存到永久缓存（USER_DATA_PATH）
   * @param {string} url - 图片URL
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise<string>} 永久缓存路径
   */
  async saveToPermanentCache(url, tempFilePath) {
    const fileManager = wx.getFileSystemManager()
    const fileName = this.generateFileName(url)
    const savePath = `${wx.env.USER_DATA_PATH}/img_${fileName}`

    try {
      // 先检查缓存大小，必要时清理
      await this.checkPermanentCacheSize()

      // 保存文件
      await new Promise((resolve, reject) => {
        fileManager.saveFile({
          tempFilePath,
          filePath: savePath,
          success: resolve,
          fail: reject
        })
      })

      // 获取文件大小
      const stats = await new Promise((resolve, reject) => {
        fileManager.stat({
          path: savePath,
          success: resolve,
          fail: reject
        })
      })

      // 更新永久缓存索引
      this.permanentCache.set(url, {
        path: savePath,
        size: stats.size,
        time: Date.now(),
        type: 'permanent'
      })
      this.saveCacheToStorage()

      console.log(`[ImageCache] Saved to permanent cache: ${fileName} (${(stats.size / 1024).toFixed(1)}KB)`)
      return savePath
    } catch (error) {
      console.error('[ImageCache] Save to permanent cache failed:', error)

      // 如果永久缓存失败，降级到临时缓存
      console.warn('[ImageCache] Fallback to temp cache')
      return await this.saveToTempCache(url, tempFilePath)
    }
  }

  /**
   * 保存到临时缓存（使用下载的临时文件）
   * @param {string} url - 图片URL
   * @param {string} tempFilePath - 临时文件路径
   * @returns {Promise<string>} 临时文件路径
   */
  async saveToTempCache(url, tempFilePath) {
    // 临时文件直接使用，不需要额外保存
    // 临时文件会被微信自动管理和清理

    this.tempCache.set(url, {
      path: tempFilePath,
      time: Date.now(),
      type: 'temp'
    })
    this.saveCacheToStorage()

    console.log(`[ImageCache] Saved to temp cache: ${url.substring(url.lastIndexOf('/') + 1)}`)
    return tempFilePath
  }

  /**
   * 检查永久缓存大小并清理
   */
  async checkPermanentCacheSize() {
    try {
      const fileManager = wx.getFileSystemManager()
      let totalSize = 0
      const fileInfos = []

      // 统计所有永久缓存文件的大小和时间
      for (const [url, info] of this.permanentCache.entries()) {
        try {
          const stats = await new Promise((resolve, reject) => {
            fileManager.stat({
              path: info.path,
              success: resolve,
              fail: reject
            })
          })
          totalSize += stats.size
          fileInfos.push({
            url,
            path: info.path,
            size: stats.size,
            time: info.time || stats.lastModifiedTime
          })
        } catch (error) {
          // 文件不存在，从缓存中移除
          this.permanentCache.delete(url)
        }
      }

      console.log(`[ImageCache] Permanent cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${(MAX_PERMANENT_CACHE_SIZE / 1024 / 1024).toFixed(0)}MB`)

      // 如果超过上限，删除最旧的文件
      if (totalSize > MAX_PERMANENT_CACHE_SIZE) {
        console.log(`[ImageCache] Cache size exceeded, cleaning...`)

        // 按时间排序（最旧的在前）
        fileInfos.sort((a, b) => a.time - b.time)

        // 删除最旧的文件直到低于80%阈值
        const targetSize = MAX_PERMANENT_CACHE_SIZE * 0.8
        for (const info of fileInfos) {
          if (totalSize <= targetSize) break

          await this.removePermanent(info.url)
          totalSize -= info.size
          console.log(`[ImageCache] Removed old file: ${info.url.substring(info.url.lastIndexOf('/') + 1)} (${(info.size / 1024).toFixed(1)}KB)`)
        }

        console.log(`[ImageCache] Cleaned to ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
      }

      this.saveCacheToStorage()
    } catch (error) {
      console.error('[ImageCache] Check cache size failed:', error)
    }
  }

  /**
   * 预加载图片列表（支持并发控制）
   * @param {Array<string>} urls - 图片URL列表
   * @param {number} limit - 并发下载数量限制
   * @param {string} type - 图片类型（可选）
   */
  async preload(urls, limit = 3, type) {
    if (!Array.isArray(urls) || urls.length === 0) return

    console.log(`[ImageCache] Preloading ${urls.length} images (limit: ${limit})...`)

    const results = []
    for (let i = 0; i < urls.length; i += limit) {
      const batch = urls.slice(i, i + limit)
      const batchResults = await Promise.allSettled(
        batch.map(url => this.download(url, type))
      )
      results.push(...batchResults)
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`[ImageCache] Preload complete: ${succeeded} succeeded, ${failed} failed`)
    return results
  }

  /**
   * 移除永久缓存中的图片
   * @param {string} url - 图片URL
   */
  async removePermanent(url) {
    const info = this.permanentCache.get(url)
    if (!info) return

    try {
      const fileManager = wx.getFileSystemManager()
      await new Promise((resolve, reject) => {
        fileManager.unlink({
          filePath: info.path,
          success: resolve,
          fail: reject
        })
      })
    } catch (error) {
      console.error('[ImageCache] Remove file failed:', error)
    }

    this.permanentCache.delete(url)
    this.saveCacheToStorage()
  }

  /**
   * 移除临时缓存中的图片
   * @param {string} url - 图片URL
   */
  removeTemp(url) {
    // 临时文件由微信管理，不需要手动删除
    this.tempCache.delete(url)
    this.saveCacheToStorage()
  }

  /**
   * 清空所有永久缓存
   */
  async clearPermanent() {
    const fileManager = wx.getFileSystemManager()
    const promises = []

    for (const [url, info] of this.permanentCache.entries()) {
      promises.push(
        new Promise((resolve) => {
          fileManager.unlink({
            filePath: info.path,
            success: resolve,
            fail: resolve
          })
        })
      )
    }

    await Promise.all(promises)
    this.permanentCache.clear()
    this.saveCacheToStorage()

    console.log('[ImageCache] Permanent cache cleared')
  }

  /**
   * 清空所有临时缓存索引
   */
  clearTemp() {
    // 临时文件由微信管理，只清空索引
    this.tempCache.clear()
    this.saveCacheToStorage()

    console.log('[ImageCache] Temp cache index cleared')
  }

  /**
   * 清空所有缓存
   */
  async clearAll() {
    await this.clearPermanent()
    this.clearTemp()
    console.log('[ImageCache] All cache cleared')
  }

  /**
   * 生成缓存文件名（URL哈希）
   * @param {string} url - 图片URL
   * @returns {string} 文件名
   */
  generateFileName(url) {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    const ext = url.split('.').pop().split('?')[0] || 'jpg'
    return `${Math.abs(hash)}.${ext}`
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    const fileManager = wx.getFileSystemManager()
    let permanentSize = 0
    let permanentCount = 0

    for (const [url, info] of this.permanentCache.entries()) {
      try {
        const stats = await new Promise((resolve, reject) => {
          fileManager.stat({
            path: info.path,
            success: resolve,
            fail: reject
          })
        })
        permanentSize += stats.size
        permanentCount++
      } catch (error) {
        // 文件不存在，忽略
      }
    }

    return {
      permanent: {
        count: permanentCount,
        size: permanentSize,
        sizeText: `${(permanentSize / 1024 / 1024).toFixed(2)}MB`
      },
      temp: {
        count: this.tempCache.size,
        sizeText: 'N/A (managed by WeChat)'
      },
      maxSize: MAX_PERMANENT_CACHE_SIZE,
      maxSizeText: `${(MAX_PERMANENT_CACHE_SIZE / 1024 / 1024).toFixed(0)}MB`
    }
  }
}

// 创建单例
const imageCache = new ImageCache()

module.exports = imageCache

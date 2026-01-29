// 微信支付工具
const { request } = require('./request.js')

/**
 * 创建支付订单
 * @param {Object} params
 * @param {string} params.productType - 'credits' 积分充值 | 'template' 模板购买
 * @param {number} params.amount - 金额（分）
 * @param {number} [params.productId] - 模板ID（模板购买时需要）
 * @param {number} [params.quantity] - 数量（积分充值时表示积分数）
 */
async function createPayment(params) {
  const userOpenId = wx.getStorageSync('userOpenId')
  if (!userOpenId) {
    throw new Error('用户未登录')
  }

  const result = await request({
    url: '/api/trpc/mp.createPayment',
    method: 'POST',
    data: {
      userOpenId,
      productType: params.productType,
      amount: params.amount,
      productId: params.productId,
      quantity: params.quantity || 1,
    }
  })

  return result
}

/**
 * 调起微信支付
 * @param {Object} payParams - 从 createPayment 返回的 payParams
 */
function requestPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
      success: (res) => {
        resolve({ success: true, result: res })
      },
      fail: (err) => {
        if (err.errMsg === 'requestPayment:fail cancel') {
          // 用户取消支付
          resolve({ success: false, cancelled: true })
        } else {
          reject(err)
        }
      }
    })
  })
}

/**
 * 查询支付结果
 * @param {string} orderNo - 订单号
 */
async function queryPayment(orderNo) {
  const result = await request({
    url: '/api/trpc/mp.queryPayment',
    data: { orderNo }
  })

  return result
}

/**
 * 完整支付流程
 * @param {Object} params - 同 createPayment 参数
 * @returns {Promise<{success: boolean, orderNo?: string, cancelled?: boolean, error?: string}>}
 */
async function pay(params) {
  try {
    // 1. 创建支付订单
    const createResult = await createPayment(params)
    if (!createResult.success || !createResult.payParams) {
      return { success: false, error: '创建订单失败' }
    }

    const { orderNo, payParams } = createResult

    // 2. 调起微信支付
    const payResult = await requestPayment(payParams)
    if (payResult.cancelled) {
      return { success: false, cancelled: true, orderNo }
    }

    if (!payResult.success) {
      return { success: false, error: '支付失败', orderNo }
    }

    // 3. 查询支付结果（可选，用于确认）
    // 正常情况下支付成功后微信会通过回调通知服务器
    // 这里主动查询一次确保状态正确
    const queryResult = await queryPayment(orderNo)
    if (queryResult.tradeState === 'SUCCESS') {
      return { success: true, orderNo, transactionId: queryResult.transactionId }
    }

    // 如果查询结果不是成功，可能是回调还没处理完
    // 返回支付成功，让业务层处理
    return { success: true, orderNo }
  } catch (error) {
    console.error('[Payment] Error:', error)
    return { success: false, error: error.message || '支付失败' }
  }
}

/**
 * 积分充值
 * @param {number} credits - 要充值的积分数
 * @param {number} price - 价格（元）
 */
async function rechargeCredits(credits, price) {
  const amount = Math.round(price * 100) // 转为分

  return pay({
    productType: 'credits',
    amount,
    quantity: credits,
  })
}

/**
 * 购买模板
 * @param {number} templateId - 模板ID
 * @param {number} price - 价格（元）
 */
async function buyTemplate(templateId, price) {
  const amount = Math.round(price * 100) // 转为分

  return pay({
    productType: 'template',
    amount,
    productId: templateId,
  })
}

module.exports = {
  createPayment,
  requestPayment,
  queryPayment,
  pay,
  rechargeCredits,
  buyTemplate,
}

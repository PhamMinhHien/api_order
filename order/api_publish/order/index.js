"use strict"

const {
  listCartItems
} = require('./cart')
const {
  submitOrder,
  listOrders,
  deleteOrder
} = require('./order')
const {
  pushOrderStatus,
  pushTransactionStatus,
  checkTransactionStatus,
  pushSupplierOrderStatus
} = require('./status')
const {
  applyVoucher,
  // redeemUsage,
  listVoucher,
  getBestVoucher
} = require('./voucher')
const {
  applyVoucherV2
} = require('./voucher_1.1')

module.exports = [
  ['post', '/list/cartItems', listCartItems],
  ['post', '/submitOrder', submitOrder],
  ['post', '/pushOrderStatus', pushOrderStatus],
  ['post', '/checkTransactionStatus', checkTransactionStatus],
  ['post', '/pushTransactionStatus/:gateway', pushTransactionStatus],
  ['post', '/list/orders', listOrders],
  ['delete', '/order/:uid', deleteOrder],
  ['post', '/:supplier_id/push/orderStatus', pushSupplierOrderStatus],
  // ['post', '/voucher/redeem_usage', redeemUsage], //cai nay de danh test thoi, khi nao can thi mo ra ah =))
  ['post', '/list/voucher', listVoucher],
  ['get', '/product/best-voucher/:product_uid/:customer_id', getBestVoucher],
  ['post', '/voucher/apply/1.1', applyVoucherV2],
  ['post', '/voucher/apply', applyVoucher],
]
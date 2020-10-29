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
  ['post', '/list/cartItems', listCartItems, false],
  ['post', '/submitOrder', submitOrder, false],
  ['post', '/pushOrderStatus', pushOrderStatus, false],
  ['post', '/checkTransactionStatus', checkTransactionStatus, false],
  ['post', '/pushTransactionStatus/:gateway', pushTransactionStatus, false],
  ['post', '/list/orders', listOrders, false],
  ['delete', '/order/:uid', deleteOrder],
  ['post', '/:supplier_id/push/orderStatus', pushSupplierOrderStatus, false],
  // ['post', '/voucher/redeem_usage', redeemUsage], //cai nay de danh test thoi, khi nao can thi mo ra ah =))
  ['post', '/list/voucher', listVoucher, false],
  ['get', '/product/best-voucher/:product_uid/:customer_id', getBestVoucher, false],
  ['post', '/voucher/apply/1.1', applyVoucherV2, false],
  ['post', '/voucher/apply', applyVoucher, false]
]
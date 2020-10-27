"use strict"

// const crypto = require('crypto')
const db = mrequire('./services/tvcdb')
const { isOrderId, isSubOrderId } = mrequire('./utils')
const { checkSignature } = mrequire('./services/payment/fptplay')
const syncTrigger = require('./sync')

const mapPayStatus = ["unknown", "success", "failed", "pending"]

async function checkTransactionStatus ({body}) {
  // Chỗ này dùng uid thì chuẩn hơn
  const { order_id } = body

  if(!isOrderId(order_id)) {
    throw { statusCode: 400, message: `Invalid order_id: "${order_id}"` }
  }

  const { orders: [order] } = await db.query(`{
    orders(func: eq(order_id, "${order_id}")) @filter(type(PrimaryOrder)) {
      uid
      pay_status
    }
  }`)

  if(!order) {
    throw {
      statusCode: 404,
      status: `order ${order_id} not found`
    }
  }

  return {
    statusCode: 200,
    status: mapPayStatus[order.pay_status] || "unknown"
  }
}

async function pushTransactionStatus ({params, body}) {
  if(!checkSignature(params.gateway, body)) {
    throw {
      statusCode: 400,
      message: "Invalid Signature",
      payload: body
    }
  }

  const { order_id, error_code } = body

  const {result} = await db.upsert({
    query: `{
      ods as result(func: eq(order_id, "${order_id}")) @filter(type(PrimaryOrder)) {
        uid
      }
    }`,
    cond: "@if(gt(len(ods), 0))",
    set: {
      uid: "uid(ods)",
      pay_status: error_code == 0 ? 1 : 2,
      order_status: 1 //chuyển đơn đã tạo trạng thái init thành pending.
    }
  })

  const uid = result[0]?.uid

  if(uid) {
    syncTrigger('order', uid, order_id, 'push_transaction_status')
  }

  return body
}

async function pushOrderStatus ({body}) {
  let { order_id, order_status, reason, notes } = body

  if(!isOrderId(order_id) || typeof order_status !== 'number') {
    throw { statusCode: 400, message: "not meeting the requirements" }
  }

  if (order_status === 6 && !reason) {
    if (!notes) {
      throw { statusCode: 400, message: "Vui lòng cho biết lý do huỷ đơn" }
    } else {
      reason = notes
    }
  }

  const {result} = await db.upsert({
    query: `{
      ods as result(func: eq(order_id, "${order_id}")) @filter(type(PrimaryOrder)) {
        uid
        sub_orders {
          s_ods as uid
        }
      }
    }`,
    cond: "@if(gt(len(ods), 0))",
    set: [
      {
        uid: "uid(ods)",
        order_status,
        reason
      },
      {
        uid: "uid(s_ods)",
        order_status,
        reason
      }
    ]
  })

  const uid = result[0]?.uid

  if(uid) {
    syncTrigger('order', uid, order_id, 'push_order_status')
  }

  return body
}

async function pushSupplierOrderStatus ({params, body}) {
  const { supplier_id } = params
  const { order_id, order_status } = body

  if(!isSubOrderId(order_id) || (order_status ?? true) || !supplier_id) {
    throw { statusCode: 400, message: "not meeting the requirements" }
  }

  const {result} = await db.upsert({
    query: `{
      od as result(func: eq(order_id, "${order_id}")) @filter(type(Order) AND eq(partner_id, ${supplier_id})) {
        uid
      }
    }`,
    cond: "@if(gt(len(od), 0))",
    set: {
      uid: "uid(od)",
      order_status
    }
  })

  await db.upsert({
    query: `{
      var(func:eq(order_id,${order_id})) {
        ~sub_orders {
          pod as uid
          sub_orders {
            em as order_status
          }
        }
      }
      me() {
        min_status as min(val(em))
      }
    }`,
    set: {
      uid: "uid(pod)",
      order_status: "val(min_status)"
    }
  })

  const uid = result[0]?.uid

  if (uid) {
    syncTrigger('order', uid, order_id, 'push_order_status')
  }

  return {
    statusCode: 200,
    data: {
      order_id,
      order_status
    }
  }
}

module.exports = {
  pushOrderStatus,
  pushTransactionStatus,
  checkTransactionStatus,
  pushSupplierOrderStatus
}
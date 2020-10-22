"use strict"

const db = mrequire('./services/tvcdb')
const { isUid, uid, createUidMap } = mrequire('./utils')

const parseProduct = mrequire('./services/product-parser')

// const { prodSummary } = require('./prod-utils')
const { makePayment, gateways } = mrequire('./services/payment/fptplay')
async function listOrders({body}) {
  const { customer_id, order_by, order_asc = 'asc', length = 20, page = 0 } = body

  const filterBy = ['all', 'payment_pending', 'processing', 'shipping', 'delivered', 'cancel', 'returning', 'refunded']
  if (order_by && filterBy.indexOf(order_by) === -1) {
    throw { statusCode: 400, message: "Invalid order_by" }
  }
  if(!isUid(customer_id)) throw { statusCode: 400, message: "Invalid customer uid" }
  // const payStatus = {
  //     '1': 'Success',
  //     '2': 'Failed',
  //     '3': 'Pending'
  // }
  const all_filter = ` has(order_id)`
  const payment_pending = `(
    (not eq(pay_gateway, "cod") AND not eq(pay_gateway, "quickpay"))
    AND 
    (eq(order_status, 0) OR eq(order_status, 1) OR eq(order_status, 2)) 
    AND 
    (eq(pay_status, 2) OR eq(pay_status, 3))
  )`
  const processing = `(
    ( (eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay")) AND (eq(order_status, 1) OR eq(order_status, 2)) )
    OR
    ( (not eq(pay_gateway, "cod") AND not eq(pay_gateway, "quickpay")) AND eq(pay_status, 1) AND (eq(order_status, 1) OR eq(order_status, 2)) )
    OR
    ( eq(order_status, 5) )
  )`
  const shipping = `eq(order_status, 3)`
  const delivered = `eq(order_status, 4)`
  const cancel = `(eq(order_status, 6) AND (NOT eq(reason, "cms_new_cancel") AND NOT eq(reason, "cli_new_cancel") ))`
  const returning = `(eq(order_status, 7) OR eq(order_status, 8))`
  const refunded = `eq(order_status, 9)`

  let orderFilterSortOrder = all_filter
  if (order_by && order_by !== "") {
    if (order_by === 'all') {
      // do nothing
    } 
    else if (order_by === 'payment_pending') {
      orderFilterSortOrder = payment_pending
    }
    else if (order_by === 'processing') {
      orderFilterSortOrder = processing
    }
    else if (order_by === 'shipping') {
      orderFilterSortOrder = shipping
    }
    else if (order_by === 'delivered') {
      orderFilterSortOrder = delivered
    }
    else if (order_by === 'cancel') {
      orderFilterSortOrder = cancel
    }
    else if (order_by === 'returning') {
      orderFilterSortOrder = returning
    }
    else if (order_by === 'refunded') {
      orderFilterSortOrder = refunded
    }
  }
  
  let { result, reasons } = await db.query(`{
    var(func: uid(${customer_id})) {
      success_o as ~order.customer  @filter(type(PrimaryOrder) AND NOT (eq(is_deleted, true)) AND ${orderFilterSortOrder} )
    }
    result(func: uid(success_o), orderdesc: created_at, first: ${String(length)}, offset: ${String(page*length)}) {
      ${order_fields}
    }

    reasons(func: type(Reason), orderasc: display_order) {
      uid
      reason_name
      reason_value
    }
  }`)

  result = parseOrder(result, reasons)
  
  return {
    statusCode: 200,
    data: result
  }
}


const order_fields = 
`uid
order_id
pay_status: pay_status
order_status: order_status
customer_name: customer_name
phone_number: phone_number
address_des: address_des
address_type: address_type
pay_gateway
created_at
voucher_code
voucher_value
province {
  uid
  name
}
district {
  uid
  name
}
reason
total_pay: total_pay
order.items: sub_orders @normalize {
  reason: reason
  order_items {
    product_name: product_name
    quantity: quantity
    sell_price: sell_price
    discount: discount
    order.product {
      display_name_detail: display_name_detail
      product_uid: uid
      previews: previews (first: 1) @filter(eq(media_type, "image")) {
        media_type: media_type
        thumb: thumb
        source: source
        square: square
      }
    }
  }
}`

const parseOrder = (os, reasons) => {
  os.map(o => {
    const date = new Date(o.created_at)
    const year = String(date.getFullYear())
    const month =  String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    o.created_at = `${day}/${month}/${year}`
    o.pay_gateway == "cod" ? o.pay_gateway = "Thanh toán khi nhận hàng" : o.pay_gateway == "quickpay" ? o.pay_gateway = "Đặt hàng nhanh" : o.pay_gateway
    if (o?.reason?.length && reasons.length) {
      const rs = reasons.find(rs => rs.reason_value === o.reason)
      o.reason = rs.reason_name
    }
  })
  return os
}


module.exports = [
  ['post', '/list/orders_v2', listOrders],
]
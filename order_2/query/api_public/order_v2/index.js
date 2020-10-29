"use strict"

const db = mrequire('./services/tvcdb')
const { isUid } = mrequire('./utils')

/* const payStatus = {
  '1': 'Success',
  '2': 'Failed',
  '3': 'Pending'
} */

const pay_methods = {
  cod: 'Thanh toán khi nhận hàng',
  quickpay: 'Đặt hàng nhanh'
}

const filters = {
  all: `has(order_id)`,
  payment_pending: `(
    NOT (eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay"))
    AND (ge(order_status, 0) AND le(order_status, 2))
    AND (eq(pay_status, 2) OR eq(pay_status, 3))
  )`,
  processing: `(
    (
      eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay")
      AND (eq(order_status, 1) OR eq(order_status, 2))
    )
    OR (
      NOT (eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay"))
      AND eq(pay_status, 1)
      AND (eq(order_status, 1) OR eq(order_status, 2))
    )
    OR eq(order_status, 5)
  )`,
  shipping: `eq(order_status, 3)`,
  delivered: `eq(order_status, 4)`,
  cancel: `eq(order_status, 6) AND NOT (eq(reason, "cms_new_cancel") OR eq(reason, "cli_new_cancel"))`,
  returning: `(eq(order_status, 7) OR eq(order_status, 8))`,
  refunded: `eq(order_status, 9)`
}

async function listOrders ({body}) {
  const { customer_id, order_by, length = 20, page = 0 } = body

  if (!(order_by in filters)) {
    throw { statusCode: 400, message: "Invalid order_by" }
  }

  if(!isUid(customer_id)) {
    throw { statusCode: 400, message: "Invalid customer uid" }
  }

  let { result, reasons } = await db.query(`{
    var(func: uid(${customer_id})) {
      success_o as ~order.customer  @filter(type(PrimaryOrder) AND (NOT eq(is_deleted, true)) AND ${filters[order_by]})
    }
    result(func: uid(success_o), orderdesc: created_at, first: ${length}, offset: ${page * length}) {
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
  for(let o of os) {
    const date = new Date(o.created_at)
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    o.created_at = `${day}/${month}/${year}`
    o.pay_gateway = pay_methods[o.pay_gateway]
    if (o.reason && reasons?.length) {
      o.reason = reasons.find(r => r.reason_value === o.reason).reason_name
    }
  }
  return os
}


module.exports = [
  ['post', '/list/orders_v2', listOrders, false]
]
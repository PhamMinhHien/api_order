"use strict"

const db = mrequire('./services/tvcdb')
const { isUid, uid, createUidMap } = mrequire('./utils')
// const { prodSummary } = require('./prod-utils')
const { makePayment, gateways } = mrequire('./services/payment/fptplay')

const generateOrderId = require('./order-id-generator')
const syncTrigger = require('./sync')
const { applyVoucher, redeemUsage, reChargedVoucher } = require('./voucher')
const { applyVoucherV2 } = require('./voucher_1.1')

async function createOrderItems(items) {
  const uids = items.map(i => i.uid)
  const quantities = createUidMap(items, "quantity")
  const { products } = await db.query(`{
    products(func: uid(${uids.join(',')})) @normalize {
      uid
      product_name: product_name
      product.partner {
        partner_uid: uid
        partner_id: id
      }
      product.pricing (first: -1) {
        cost_price: cost_price_with_vat
        sell_price: price_with_vat
        discount: discount
      }
      promotion_desc: promotion_desc
    }
  }`)
  return products.map(({uid, partner_uid, partner_id, product_name, color, cost_price = 0, sell_price = 0, discount = 0, promotion_desc}) => {
    return {
      "dgraph.type": "OrderItem",
      "order.product": { uid },
      partner_uid,
      partner_id,
      quantity: quantities[uid],
      product_name,
      cost_price,
      sell_price,
      discount,
      promotion_desc
    }
  })
}

function splitOrdersByPartnerId(orderItems, mainOrderId) {
  const result = {}
  for(let i of orderItems) {
    if('partner_uid' in i) {
      if(result[i.partner_uid]) {
        result[i.partner_uid].items.push(i)
      } else {
        result[i.partner_uid] = {partner_id: i.partner_id, items: [i]}
      }
      delete i.partner_uid
      delete i.partner_id
    } else {
      throw new Error(`missing partner_uid in product ${i['order.product'].uid}`)
    }
  }
  let charCode = 65
  return Object.entries(result).map(([partner_uid, data]) => {
    return {
      "dgraph.type": "Order",
      'order.partner': {uid: partner_uid === 'undefined' ? null : partner_uid},
      order_id: mainOrderId + String.fromCharCode(charCode++),
      partner_id: data.partner_id,
      "order_items": data.items,
      order_status: 1
    }
  })
}

async function submitOrder({ body }) {
  // Submited order info
  const {
    pay_gateway,
    platform,
    customer_id,
    customer_name,
    phone_number,
    address_des,
    address_type,
    province,
    district,
    items,
    voucher_code,
    request_delivery_time,
    client_notes,
    created_address_type,
    created_address_des,
    created_customer_name,
    created_phone_number,
    created_province,
    created_district,
  } = body

  // Validate submited info
  const isInvalidSubmit = (
    !gateways.includes(pay_gateway) ||
    !isUid(customer_id) ||
    !Array.isArray(body.items) || items.length === 0 ||
    !customer_name || !phone_number || (pay_gateway !== 'quickpay' && !address_des)
  )
  if(isInvalidSubmit) {
    throw { statusCode: 400, message: 'What are you doing here?' }
  }

  const orderItems = await createOrderItems(items)
  let amount = orderItems.reduce((total, {sell_price, discount, quantity}) => {
    return ((discount ? sell_price - sell_price*discount/100 : sell_price) * quantity) + total
  }, 0)

  if(!amount) {
    throw { statusCode: 400, message: `Invalid amount: ${amount}` }
  }

  const primaryOrderId = await generateOrderId()

  /**
   * Start Apply Voucher
   */
  let voucher = {}
  if (voucher_code) {
    const bodyCheck = {
      voucher_code,
      items,
      customer_id
    }
    const check_voucher = await applyVoucher({body: bodyCheck})
    if (check_voucher.statusCode  === 200) {
      voucher = check_voucher.data
    }
  }
  
  // Save Order to database
  const set = {
    "dgraph.type": "PrimaryOrder",
    created_at: (new Date).getTime(),
    uid: "_:new_order",
    pay_gateway,
    order_id: primaryOrderId,
    "order.customer": uid(customer_id),
    platform_id: platform,
    customer_name,
    phone_number,
    address_des,
    address_type,
    province: uid(province),
    district: uid(district),
    sub_orders: splitOrdersByPartnerId(orderItems, primaryOrderId),
    total_pay: voucher?.applied_value > 0 ? amount - voucher.applied_value : amount,
    order_status: pay_gateway === 'quickpay' ? 1 : 0, // update ngoại trừ quickpay thì tất cả các đơn phải có trạng thái là 0 (init)
    pay_status: 3, // pending
    voucher_code: voucher_code || null,
    voucher_value: voucher?.applied_value || 0, // ghi nhận luôn giá trị 0
    request_delivery_time,
    client_notes,
    created_address_type,
    created_address_des,
    created_customer_name,
    created_phone_number,
    created_province: uid(created_province),
    created_district: uid(created_district)
  }
  const order_uid = await db.mutate({set}).then(res => res.getUidsMap().get('new_order'))

  /**
   * Redeem Voucher
   */
  if (voucher_code && voucher?.uid) {
    redeemUsage(voucher.uid, voucher_code, customer_id, order_uid, items)
  }
   
  await syncTrigger('order', order_uid, primaryOrderId, 'submit_order')

  if (pay_gateway != "cod" && pay_gateway != "quickpay") {
    const notify_url = `${config.serve.origin}${config.serve.apiPrefix}/pushTransactionStatus/${pay_gateway}`
    const paymentData = {
      pay_gateway,
      platform,
      customer_id,
      order_id: primaryOrderId,
      amount: set.total_pay
    }
    const paymentResponse = await makePayment(notify_url, paymentData)
    return {
      order_id: primaryOrderId,
      amount: set.total_pay,
      ...paymentResponse
    }
  }

  return {
    statusCode: 200,
    order_id: primaryOrderId,
    amount: set.total_pay,
  }
}

async function deleteOrder({params:{uid}}) {
  // Query dùng Condition upsert compare order_status > 4 không được
  // Dùng code giải quyết thay thế
  if(!isUid(uid)) throw { statusCode: 400, message: "Invalid order uid" }

  const { orders: [order] } = await db.query(`{ orders(func: uid(${uid})) { order_status } }`)

  if(!order) throw { statusCode: 400, message: `order ${uid} not found` }

  if(order.order_status > 4) throw { statusCode: 400, message: "can not delete unfinished orders" }

  const reCharged = await reChargedVoucher(uid)

  await db.mutate({ set: { uid, is_deleted: true } })

  return { statusCode: 200, reCharged }
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
total_pay: total_pay
order.items: sub_orders @normalize {
  order_items {
    product_name: product_name
    quantity: quantity
    sell_price: sell_price
    discount: discount
  }
}`

const parseOrder = (os) => {
  os.map(o => {
    const date = new Date(o.created_at)
    const year = String(date.getFullYear())
    const month =  String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    o.created_at = `${day}/${month}/${year}`
    o.pay_gateway == "cod" ? o.pay_gateway = "Thanh toán khi nhận hàng" : o.pay_gateway == "quickpay" ? o.pay_gateway = "Đặt hàng nhanh" : o.pay_gateway
  })
  return os
}


async function listOrders({body:{customer_id}}) {

  if(!isUid(customer_id)) throw { statusCode: 400, message: "Invalid customer uid" }

  const pay_od_success_filter = `( eq(pay_status, 1) AND (eq(order_status, 4) OR eq(order_status,9)) )`
  const pay_od_process_filter = `( eq(pay_status, 1) AND NOT eq(order_status, 4) AND NOT eq(order_status,9) )`
  const cod_od_success_filter = `( (eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay")) AND (eq(order_status, 4) OR eq(order_status,6)) )`
  const cod_od_process_filter = `( (eq(pay_gateway, "cod") OR eq(pay_gateway, "quickpay")) AND NOT eq(order_status, 4) AND NOT eq(order_status,6) )`

  let { success_orders, process_orders } = await db.query(`{
    var(func: uid(${customer_id})) {
      success_o as ~order.customer  @filter(type(PrimaryOrder) AND NOT (eq(is_deleted, true)) AND ( ${pay_od_success_filter} OR ${cod_od_success_filter} ) )
    }
    var(func: uid(${customer_id})) {
      process_o as ~order.customer @filter(type(PrimaryOrder) AND NOT (eq(is_deleted, true))  AND ( ${pay_od_process_filter} OR ${cod_od_process_filter} ) )
    }
    success_orders(func: uid(success_o), orderdesc: created_at) {
      ${order_fields}
    }
    process_orders(func: uid(process_o), orderdesc: created_at) {
      ${order_fields}
    }
  }`)

  success_orders = parseOrder(success_orders)
  process_orders = parseOrder(process_orders)
  
  return {
    statusCode: 200,
    filter_orders: {
      'success' : success_orders,
      'processing': process_orders
    }
  }
}

module.exports = { submitOrder, listOrders, deleteOrder }
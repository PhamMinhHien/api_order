"use strict"
const db = mrequire('./services/tvcdb')
const session = mrequire('./modules/userSession')
const json2xls = mrequire('./services/exports/json2xls')
const tracking = mrequire('./services/tracking')


const orderFragment =
`created_at
uid
order_id
order_status
pay_status
total_pay
customer_name
phone_number
address_des
pay_gateway
voucher_code
applied_value: voucher_value
notes
client_notes
request_delivery_time
date_delivery_success
reason
district {
uid
name
}
province {
uid
name
}
order.customer {
customer_name
phone_number
}
sub_orders {
uid
order_id
partner_id
order_status
notes
shipping_code
reason
order.partner {
  uid
  partner_name
  shipping_method
}
shipping_partner_value
date_delivery_success
order_items {
  uid
  product_name
  quantity
  sell_price
  discount
  promotion_desc
  product: order.product {
    sku_id
    promotion_detail
    payment_terms
    return_terms
    unit
    areas {
      uid
      name
    }
  }
}
}
voucher_usage: ~voucher_usage.order @normalize {
uid
voucher_uid: voucher_uid
voucher_usage.voucher {
  voucher_usage_code: voucher_code
  voucher_value: voucher_value
  voucher_type: voucher_type
}
}`

function loadMore(offset, number) {
    return db.query(`query result($number: string, offset: string) {
        result(func: type(PrimaryOrder), orderdesc: created_at, first: $number, offset: $offset) {
            ${orderFragment}
        }
    }`, { $number: number || 20, $offset: offset || 0 })
}


module.exports = {
    loadMore
}
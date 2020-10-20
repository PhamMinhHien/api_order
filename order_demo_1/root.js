
"use strict"
const db = mrequire('./modules/tvcdb')

function getAll() {
  return db.query(`{
    result(func: type(PrimaryOrder), orderdesc: created_at) @filter(not eq(is_deleted, true)) {
      ${orderFragment}
    }
  }`)
}


// async function mutate(request, reply) {
//   const { uid, order_status, notes, customer_name, phone_number, address_des, shipping_code, reason, shipping_partner_value, date_delivery_success } = request.body
//   const {result: [current_o]} = await db.query(`{
//     result(func: uid(${uid})) @filter(type(PrimaryOrder)) {
//       uid
//       order_status
//       order_id
//       sub_orders{
//         uid
//     	  date_delivery_success
//       }
//     }
//   }`)

//   // TODO: Check nếu data là thuộc PrimaryOrder |=> order_status === 4 ( đã giao ) |=> Update date_delivery_success
//   let date_primary //, date_max
//   if(current_o && current_o?.sub_orders && current_o?.sub_orders.length > 0){
//     if(order_status && parseInt(order_status) === 4 && current_o.order_status !== 4 ){ // Đã giao === 4
//       let date_max = 0
//       current_o.sub_orders.forEach(i => {
//         if (i?.date_delivery_success > date_max) {
//           date_max = i?.date_delivery_success
//         }
//       })
//       date_primary = date_max !== 0 ? date_max : null
//     }
//   }
  
//   // Khí order_status (PrimaryOrder) === "Đã hủy" (6) => Update order_status cho order con  
//   if(current_o && order_status && parseInt(order_status) === 6){
//     await db.upsert({
//       query: `{
//         ods as result(func: uid(${uid})) @filter(type(PrimaryOrder)) {
//           uid
//           sub_orders {
//             s_ods as uid
//           }
//         }
//       }`,
//       cond: "@if(gt(len(ods), 0))",
//       set: [
//         {
//           uid: "uid(ods)",
//           order_status,
//           reason
//         },
//         {
//           uid: "uid(s_ods)",
//           order_status,
//           reason
//         }
//       ]
//     })
//   }
  
//   return db.mutate({
//     set: {
//       uid,
//       order_status,
//       notes,
//       customer_name,
//       phone_number,
//       address_des,
//       shipping_code,
//       reason,
//       shipping_partner_value,
//       date_delivery_success : current_o && date_primary ? date_primary : date_delivery_success
//     }
//   }).then(result => {
//     const trackBody = {
//       type: 'order',
//       new_status: parseInt(order_status),
//       old_status: current_o.order_status,
//       order_id: current_o.order_id,
//       uid: userLogged.uid,
//       user_id: '',
//       user_phone: userLogged.phone_number || ""
//     }
//     // tracking(trackBody)
//     emitSync(uid, 'order')
//     return current_o && date_primary ? { statusCode: 200 , date_delivery_success : date_primary } : { statusCode: 200 }
//   })
// }

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



module.exports = {
  getAll
}
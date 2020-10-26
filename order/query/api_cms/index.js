"use strict"
const db = mrequire('./services/tvcdb')
const session = mrequire('./modules/userSession')
const json2xls = mrequire('./services/exports/json2xls')
const tracking = mrequire('./services/tracking')

async function mutate(request) {
  const { uid, order_status, notes, customer_name, phone_number, address_des, shipping_code, reason, shipping_partner_value, date_delivery_success } = request.body
  const userLogged = await session.getUser(request)
  const { result: [current_o] } = await db.query(`{
    result(func: uid(${uid})) @filter(type(PrimaryOrder)) {
      uid
      order_status
      order_id
      sub_orders{
        uid
    	  date_delivery_success
      }
    }
  }`)

  // TODO: Check nếu data là thuộc PrimaryOrder |=> order_status === 4 ( đã giao ) |=> Update date_delivery_success
  let date_primary //, date_max
  if (current_o && current_o?.sub_orders && current_o?.sub_orders.length > 0) {
    if (order_status && parseInt(order_status) === 4 && current_o.order_status !== 4) { // Đã giao === 4
      let date_max = 0
      current_o.sub_orders.forEach(i => {
        if (i?.date_delivery_success > date_max) {
          date_max = i?.date_delivery_success
        }
      })
      date_primary = date_max !== 0 ? date_max : null
    }
  }

  // Khí order_status (PrimaryOrder) === "Đã hủy" (6) => Update order_status cho order con  
  if (current_o && order_status && parseInt(order_status) === 6) {
    await db.upsert({
      query: `{
        ods as result(func: uid(${uid})) @filter(type(PrimaryOrder)) {
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
  }

  return db.mutate({
    set: {
      uid,
      order_status,
      notes,
      customer_name,
      phone_number,
      address_des,
      shipping_code,
      reason,
      shipping_partner_value,
      date_delivery_success: current_o && date_primary ? date_primary : date_delivery_success
    }
  }).then(() => {
    const trackBody = {
      type: 'order',
      new_status: parseInt(order_status),
      old_status: current_o.order_status,
      order_id: current_o.order_id,
      uid: userLogged.uid,
      user_id: '',
      user_phone: userLogged.phone_number || ""
    }
    tracking(trackBody)
    emitSync(uid, 'order')
    return current_o && date_primary ? { statusCode: 200, date_delivery_success: date_primary } : { statusCode: 200 }
  })
}

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

function getAll() {
  return db.query(`{
    result(func: type(PrimaryOrder), orderdesc: created_at) @filter(not eq(is_deleted, true)) {
      ${orderFragment}
    }
  }`)
}
function loadMore(request) {
  const { offset, number } = request.params
  return db.query(`query result($number: string, offset: string) {
    result(func: type(PrimaryOrder), orderdesc: created_at, first: $number, offset: $offset) {
      ${orderFragment}
    }
  }`, {
    $number: number || 20,
    $offset: offset || 0
  })
}
function getByUid($uid) {
  // const $uid = request.params.uid
  return db.query(`query result($uid: string) {
    result(func: uid($uid)) {
      ${orderFragment}
  }`, { $uid })
}

async function orderFilter({ body }) {
  const { number = 20, page = 0, filter = '' } = body
  const { summary, data } = await db.query(`query result($number: int, $offset: int) {
    orders as summary(func: type(PrimaryOrder)) @filter(not eq(is_deleted, true)${filter}) {
      totalCount: count(uid)
    }
    data(func: uid(orders), orderdesc: created_at, first: $number, offset: $offset) {
      ${orderFragment}
    }
  }`, {
    $number: String(number),
    $offset: String(page * number)
  })

  data.map(d => {
    d.total_initial_amount = d?.voucher_usage?.[0] ? d.total_pay + d.applied_value : d.total_pay
  })
  return {
    summary, data
  }

}

function orderExport(request, reply) {
  let { filter = '', selectedDateFrom = '', selectedDateTo = '' } = request.query
  if (selectedDateFrom) {
    filter += ` AND ge(created_at, ${selectedDateFrom})`
  }

  if (selectedDateTo) {
    filter += ` AND le(created_at, ${selectedDateTo})`
  }

  const query = `{
    orders as summary(func: type(PrimaryOrder)) @filter(not eq(is_deleted, true)${filter}) {
      totalCount: count(uid)
    }
    data(func: uid(orders), orderdesc: created_at) {
      ${orderFragment}
    }
    status(func:type(Status)) {
      status_value
      status_name
      status_code
    }
    shipping_partners(func: type(ShippingPartner)) {
      uid
      shipping_partner_name
      shipping_partner_value
    }
    reasons(func: type(Reason)) {
      uid
      reason_name
      reason_value
    }
    partner(func:type(Partner)) {
      partner_name
      id
    }
  }`
  // console.log(query)
  db.query(query)
    .then(({ data, status, shipping_partners, reasons, partner }) => {
      try {
        const { xlsFieldsName, xlsFieldsLabel, rows } = parseDetail(data, status, shipping_partners, reasons, partner)
        const xls = json2xls(rows, { fields: xlsFieldsName, labels: xlsFieldsLabel })
        reply.headers({
          "Content-Type": "application/octet-stream; ; charset=utf-8",
          "Content-Disposition": "attachment; filename=order_export.xlsx"
        })
        const res = reply.raw
        res.sent = true
        res.end(xls, 'binary')
      } catch (err) {
        reply.send(err)
      }
    })
    .catch(err => {
      reply.send(err)
    })

  function parseDetail(data, status, shipping_partners, reasons, partner) {
    const statusLookup = []
    status.map(s => {
      return statusLookup[s.status_value] = s.status_name
    })

    const shippingLookup = []
    shipping_partners.map(s => {
      return shippingLookup[s.shipping_partner_value] = s.shipping_partner_name
    })
    const reasonLookup = []
    reasons.map(s => {
      return reasonLookup[s.reason_value] = s.reason_name
    })
    const partnerLookup = []
    partner.map(p => {
      return partnerLookup[p.id] = p.partner_name
    })
    const payStatus = {
      '1': 'Success',
      '2': 'Failed',
      '3': 'Pending'
    }
    let rows = []
    let xlsFieldsLabel = [
      "Thời gian/ngày tháng export",
      "Thời gian KH đặt hàng",
      "Mã đơn hàng",
      "Mã đơn hàng con",
      "Tên KH",
      "SĐT KH",
      "Người nhận",
      "SĐT nhận",
      "Địa chỉ nhận",
      "TP/Tỉnh",
      "Quận/Huyện",
      "Tên sản phẩm",
      "Mã SKUs",
      "Số lượng",
      "Đơn vị tính",
      "Mô tả CTKM",
      "Chương trình khuyến mãi",
      "Đơn giá",
      "VoucherID",
      "Loại Voucher",
      "Giá trị Voucher",
      "Tổng tiền đã giảm",
      "Tổng tiền đơn hàng",
      "Hình thức thanh toán",
      "Trạng thái thanh toán",
      "Tình trạng đơn hàng tổng",
      "Tình trạng đơn hàng",
      "Khu vực",
      "Lý do",
      "Mã vận đơn",
      "PTGH",
      "ĐVVC",
      "Ghi chú của CS",
      "Ngày giao hàng thành công",
      "Nhà Cung cấp"
    ]
    let xlsFieldsName = [
      "export_date",
      "created_at",
      "order_id",
      "sub_order_id",
      "account_name",
      "account_phone_number",
      "customer_name",
      "phone_number",
      "address_des",
      "province",
      "district",
      "product_name",
      "sku_id",
      "quantity",
      "unit",
      "promotion_detail",
      "promotion_desc",
      "price_with_vat",
      "voucher_uid",
      "voucher_type",
      "voucher_value",
      "applied_value",
      "final_price",
      "pay_gateway",
      "pay_status",
      "primary_order_status",
      "order_status",
      "areas",
      "reason",
      "shipping_code",
      "shipping_method",
      "shipping_partner",
      "sub_notes",
      "date_delivery_success",
      "partner_name",
    ]
    const voucher_type = ["Giảm giá trực tiếp", "Giảm theo %", "Freeship"]
    const shippingMethod = ['FORWARDING', 'STOCKING', 'STOCK_AT_SUP']
    data && data.map(dataDetail => {
      if (dataDetail && dataDetail.sub_orders) {
        dataDetail.sub_orders.map(sub => {
          sub.order_items.map(item => {
            let row = {
              export_date: getDate(),
              created_at: getDate(dataDetail.created_at),
              order_id: dataDetail.order_id || "",
              sub_order_id: sub.order_id || "",
              account_name: dataDetail?.['order.customer']?.customer_name,
              account_phone_number: dataDetail?.['order.customer']?.phone_number,
              customer_name: dataDetail.customer_name || "",
              phone_number: dataDetail.phone_number || "",
              address_des: dataDetail.address_des || "",
              province: dataDetail.province ? dataDetail.province.name : "",
              district: dataDetail.district ? dataDetail.district.name : "",
              product_name: item.product_name || "",
              sku_id: item.product && item.product.sku_id || "",
              quantity: item.quantity || 1,
              unit: item.product && item.product.unit || "",
              promotion_detail: item.product && item.product.promotion_detail || "",
              promotion_desc: item.product && item.product.promotion_desc || "",
              price_with_vat: item.sell_price || 1,
              voucher_uid: dataDetail?.voucher_usage?.[0] ? `${dataDetail.voucher_usage[0].voucher_uid} - ${dataDetail.voucher_code}` : "",
              voucher_type: dataDetail?.voucher_usage?.[0] ? voucher_type[dataDetail.voucher_usage[0].voucher_type] : "",
              voucher_value: dataDetail?.voucher_usage?.[0]?.voucher_value || "",
              applied_value: dataDetail.applied_value || "",
              final_price: calcPay(item),
              pay_gateway: dataDetail.pay_gateway || "",
              pay_status: payStatus[dataDetail.pay_status] || "",
              primary_order_status: statusLookup[dataDetail.order_status] || "",
              order_status: statusLookup[sub.order_status] || "",
              areas: item?.product?.areas.map(a => a.name).join(',') || "",
              reason: reasonLookup[sub.reason] || "",
              shipping_code: sub.shipping_code || "",
              shipping_method: sub?.['order.partner'] ? shippingMethod[sub?.['order.partner']?.shipping_method] : "",
              shipping_partner: shippingLookup[sub?.shipping_partner_value],
              sub_notes: sub.notes || "",
              date_delivery_success: sub?.date_delivery_success ? new Date(sub.date_delivery_success).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }) : "",
              partner_name: sub?.['order.partner']?.partner_name || "",
            }
            rows.push(row)
          })
        })
      } else if (dataDetail['order.items']) { //đơn hàng kiểu cũ
        dataDetail['order.items'].map(item => {
          let row = {
            export_date: getDate(),
            created_at: getDate(dataDetail.created_at),
            order_id: dataDetail.order_id || "",
            sub_order_id: dataDetail.order_id || "",
            account_name: dataDetail['order.customer'].customer_name,
            account_phone_number: dataDetail['order.customer'].phone_number,
            customer_name: dataDetail.customer_name || "",
            phone_number: dataDetail.phone_number || "",
            address_des: dataDetail.address_des || "",
            province: dataDetail.province ? dataDetail.province.name : "",
            district: dataDetail.district ? dataDetail.district.name : "",
            product_name: item.product_name || "",
            sku_id: item.product && item.product.sku_id || "",
            quantity: item.quantity || 1,
            unit: item.product && item.product.unit || "",
            promotion_detail: item.product && item.product.promotion_detail || "",
            promotion_desc: item.product && item.product.promotion_desc || "",
            price_with_vat: item.sell_price || 1,
            final_price: calcPay(item),
            voucher_uid: dataDetail?.voucher_usage?.[0] ? `${dataDetail.voucher_usage[0].voucher_uid} - ${dataDetail.voucher_code}` : "",
            voucher_type: dataDetail?.voucher_usage?.[0] ? voucher_type[dataDetail.voucher_usage[0].voucher_type] : "",
            voucher_value: dataDetail?.voucher_usage?.[0]?.voucher_value || "",
            applied_value: dataDetail.applied_value || "",
            pay_gateway: dataDetail.pay_gateway || "",
            pay_status: payStatus[dataDetail.pay_status] || "",
            primary_order_status: statusLookup[dataDetail.order_status] || "",
            order_status: statusLookup[dataDetail.order_status] || "",
            areas: item?.product?.areas.map(a => a.name).join(',') || "",
            reason: reasonLookup[dataDetail.reason] || "",
            shipping_code: dataDetail.shipping_code || "",
            shipping_method: dataDetail?.['order.partner'] ? shippingMethod[dataDetail?.['order.partner']?.shipping_method] : "",
            shipping_partner: shippingLookup[dataDetail?.shipping_partner_value],
            sub_notes: dataDetail.notes || "",
            date_delivery_success: dataDetail?.date_delivery_success ? new Date(dataDetail.date_delivery_success).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }) : "",
            partner_name: dataDetail?.['order.partner']?.partner_name || "",
          }
          rows.push(row)
        })
      }
    })
    return {
      xlsFieldsName,
      xlsFieldsLabel,
      rows
    }
  }
  const calcPay = ({ sell_price = 0, discount = 0, quantity = 0 }) => {
    return (1 - discount / 100) * sell_price * quantity
  }
}

const getDate = (timestamp = null) => {
  const date = timestamp ? new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }) : new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const resDate = date//`${day}/${month}/${year} ${hour}:${min}`
  return resDate
}


module.exports = [
  ['post', '/list/order', orderFilter],
  ['get', '/list/order', getAll],
  ['get', '/list/order/:number/:offset', loadMore],
  ['get', '/order/:uid', getByUid],
  ['post', '/order', mutate],
  ['get', '/order/order_export.xlsx', orderExport]
]
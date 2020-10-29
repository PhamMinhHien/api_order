const db = mrequire('./services/tvcdb')
const { isUid } = mrequire('./utils')
const prodFilter = mrequire('./fragments/productFilter')

async function applyVoucherV2 ({body}) {
  const order = body
  const { voucher_code, items, customer_id } = order
  const isInvalidSubmit = (
    !isUid(customer_id) ||
    !Array.isArray(body.items) || items.length === 0
  )
  if(isInvalidSubmit) {
    throw { statusCode: 400, message: 'What are you doing here?' }
  }

  const productFragment = `
    uid
    product_name: product_name
    product.partner {
      partner_id: id
    }
    product.pricing {
      cost_price: cost_price_with_vat
      price_with_vat: price_with_vat
      discount: discount
    }
  `
  const voucherField = `
  uid
  voucher_code
  voucher_label
  voucher_type
  reference_type
  target_type
  condition_type
  voucher_value
  max_applied_value
  condition_value
  collection_image
  image_highlight
  redeem
  start_at
  stop_at
  is_internal
`

  const pu = items.map(i => i.uid).join(',')

  if (voucher_code && voucher_code !== "") {
    const {
      rsVoucher: [voucher],
      all_items
    } = await db.query(`{
      rsVoucher(func:type(Collection)) @filter(eq(voucher_code, ${voucher_code}) AND eq(display_status, 2) AND NOT eq(is_deleted, true)) {
        ${voucherField}
        voucher_usage: ~voucher_usage.voucher @filter(eq(customer_uid, ${customer_id}) ) {
          uid
          redeem
        }
        voucher.customers {
          uid
          expand(_all_)
        }
        highlight_products: highlight.products ${prodFilter} @normalize {
          ${productFragment}
        }
        collection_products: highlight.collections @normalize{
          ~product.collection ${prodFilter} {
            ${productFragment}
          }
        }
      }

      all_items(func: uid(${pu})) ${prodFilter} @normalize {
        ${productFragment}
      }
    }`)

    return processVoucher(voucher, items, customer_id, voucher.voucher_usage && voucher.voucher_usage[0], voucher.highlight_products, voucher.collection_products, all_items)

  } else {

    const time = new Date().getTime()

    const {
      rsVoucher,
      all_items
    } = await db.query(`{
      rsVoucher(func:type(Collection)) @filter(eq(collection_type, 300) AND eq(display_status, 2) AND NOT eq(is_deleted, true) AND le(start_at, ${time}) AND ge(stop_at, ${time}) AND NOT eq(is_internal, true)) {
        ${voucherField}
        voucher_usage: ~voucher_usage.voucher @filter(eq(customer_uid, ${customer_id}) ) {
          uid
          redeem
        }
        voucher.customers @filter(uid(${customer_id})) {
          uid
          expand(_all_)
        }
        highlight_products: highlight.products ${prodFilter} @normalize {
          ${productFragment}
        }
        collection_products: highlight.collections @normalize{
          ~product.collection ${prodFilter} {
            ${productFragment}
          }
        }
      }

      all_items(func: uid(${pu})) ${prodFilter} @normalize {
        ${productFragment}
      }
    }`)
    rsVoucher && rsVoucher.map(voucher => processVoucher(voucher, items, customer_id, voucher.voucher_usage && voucher.voucher_usage[0], voucher.highlight_products, voucher.collection_products, all_items))
    let max_value = 0
    let best_voucher = {}
    for(let i = 0; i < rsVoucher.length; i++) {
      if (rsVoucher[i].applied_value && rsVoucher[i].applied_value > max_value) {
        max_value = rsVoucher[i].applied_value
        best_voucher = rsVoucher[i]
      }
    }

    if (Object.keys(best_voucher).length > 0) {
      return {
        statusCode: 200,
        data: best_voucher,
        message: "Đã áp dụng Mã KM được giảm giá nhiều nhất."
      }
    } else {
      return {
        statusCode: 400,
        message: "Không có mã KM nào khả dụng"
      }
    }
  }
}

function processVoucher (voucher, items, customer_id, voucher_usage, highlight_products, collection_products, all_items) {

  let check_time = false

  if (voucher) {
    /**
     * đầu tiên là kiểm tra Target Type (đối tượng áp dụng)
     */
    let {check_target, is_redeemed} = checkTargetType(voucher, voucher_usage, customer_id)
    check_time = checkExpiriedTime(voucher)
    if (!check_time) {
      return {
        statusCode: 400,
        message: "Mã khuyến mãi đã quá hạn sử dụng"
      }
    } else if (!check_target) {
      return {
        statusCode: 400,
        message: !is_redeemed ? "Mã khuyến mãi không hợp lệ" : "Mã khuyến mãi đã hết lượt sử dụng"
      }
    } else {
      const {applied_value, applied_items, error_msg} = checkConditions(voucher, items, highlight_products, collection_products, all_items)
      voucher.applied_value = applied_value
      if (applied_items?.length <= 0) {
        return {
          statusCode: 400,
          message: "Sản phẩm không đủ điều kiện"
        }
      } else if (applied_value <= 0) {
        return {
          statusCode: 400,
          message: error_msg
        }
      } else {
        return {
          statusCode: 200,
          data: parseVoucher(voucher),
          message: "Mã khuyến mãi hợp lệ"
        }
      }
    }
  } else {
    return {
      statusCode: 400,
      message: "Không tìm thấy Mã khuyến mãi"
    }
  }
}


function checkTargetType (voucher, voucher_usage, customer_id) {
  let check_target = false
  let is_redeemed = false
  switch(voucher.target_type) {
    case 0: //all customer
      if (!voucher_usage) {
        check_target = true
      } else if (voucher_usage.redeem < voucher.redeem) {
        check_target = true
      }
      break
    case 1:
      if (voucher['voucher.customers'] && voucher['voucher.customers'].length > 0) {
        if (voucher['voucher.customers'].find(vc => vc.uid === customer_id)) {
          check_target = true
        }
      }
      break;
  }

  if (voucher_usage && voucher_usage.redeem >= voucher.redeem) {
    check_target = false // force false tất cả khi mà số lượng cho phép sử dụng đã hết
    is_redeemed = true
  }

  return {check_target, is_redeemed}
}

/**
   * Voucher có 3 loại
   * 0: giảm giá trực tiếp. Thì coi như giá trị Voucher được giữ nguyên, cứ trừ trực tiếp lên tổng tiền đơn hàng
   * 2: là freeship, thì freeship cũng có giá trị tối đa là bao nhiêu. cũng thực hiện trừ như loại 0
   *
   * 1: giảm theo %, cái này cần tính nhiều. Phải lọc xem có bao nhiêu sản phẩm phù hợp. Tính tổng các sản phẩm đó rồi mới chia %
   * vd: sp1 có giá là 10000 (nằm trong danh sách được áp dụng)
   * sp2 có giá là 15000 (nằm trong danh sách được áp dụng)
   * sp3 có giá là 50000
   * total_amount = ( (10000 + 15000) * [số %] ) + 50000
   *
   * ví dụ % là 5
   * ( (10000 + 15000) * 5% ) + 50000 = 23750 + 50000 = 73750 vnd (ĐÚNG)
   *
   * Trường hợp sai khi
   * ( 10000 + 15000 + 50000 ) * 5% = 75000 - 3750 = 71250 vnd là (SAI)
   */
function checkConditions (voucher, items, highlight_products, collection_products, all_items) {
  const {reference_type} = voucher

  /**
   * Kiểm tra loại tham chiếu của Voucher
   * 0 là tham chiếu đến product (1 hoặc nhiều)
   * 1 là tham chiếu đến collection (1 hoặc nhiều)
   * 2 là tham chiếu đến tất cả sản phẩm
   */

  if (reference_type === 2) { // all products
    const {itemApproved, itemRejected} = lookupItemsApproved(all_items, items)
    const {applied_value, error_msg} = applyValue(itemApproved, voucher)
    return {
      voucher_value: voucher.voucher_value,
      applied_value,
      error_msg,
      applied_items: itemApproved,
      rejected_items: itemRejected
    }
  } else if (reference_type === 1) { // collection
    const {itemApproved, itemRejected} = lookupItemsApproved(collection_products, items)
    const {applied_value, error_msg} = applyValue(itemApproved, voucher)
    return {
      voucher_value: voucher.voucher_value,
      applied_value,
      error_msg,
      applied_items: itemApproved,
      rejected_items: itemRejected
    }
  } else if (reference_type === 0) { // products
    const {itemApproved, itemRejected} = lookupItemsApproved(highlight_products, items)
    const {applied_value, error_msg} = applyValue(itemApproved, voucher)
    return {
      voucher_value: voucher.voucher_value,
      applied_value,
      error_msg,
      applied_items: itemApproved,
      rejected_items: itemRejected
    }
  }
}


function checkExpiriedTime (voucher) {
  const toDay = new Date().getTime()
  const {start_at, stop_at} = voucher
  if (toDay > start_at && toDay <= stop_at) {
    return true
  } else {
    return false
  }
}

function lookupItemsApproved (products, order_items) {
  let itemApproved = []
  let itemRejected = []
  for(let i = 0; i < order_items.length; i++) {
    let fp = products.find(p => p.uid === order_items[i].uid)
    if (fp) {
      itemApproved.push({...fp, quantity: order_items[i].quantity})
    } else {
      itemRejected.push({...order_items[i]})
    }
  }
  return {
    itemApproved,
    itemRejected
  }
}

function applyValue (itemApproved, voucher) {
  let applied_value = 0
  let amount = 0
  let error_msg = ""
  /**
   * điều kiện là trong giỏ hàng phải có sản phẩm của ngành hàng mà voucher liên kết đến
   * giảm giá dựa trên giá trị của voucher hoặc tổng giá trị các sản phẩm (lấy vế nhỏ hơn)
   */
  amount = itemApproved.reduce((total, {price_with_vat, discount, quantity = 1}) => ((discount ? price_with_vat - price_with_vat * discount / 100 : price_with_vat) * quantity) + total, 0)

  if (voucher.voucher_type === 0 || voucher.voucher_type === 2) { //Giảm giá trực tiếp/ /FreeShipping
    if (!voucher.condition_type) { // Không có điều kiện
      applied_value = amount < voucher.voucher_value ? amount : voucher.voucher_value
    } else if (voucher.condition_type === 1) { //giá trị tối thiểu của đơn hàng
      if (amount >= voucher?.condition_value) {
        applied_value = voucher.voucher_value
      } else {
        error_msg = "Hóa đơn chưa đạt giá trị tối thiểu"
        applied_value = 0
      }
      // applied_value = voucher.condition_value
      //   && amount >= voucher.condition_value
      //     ? voucher.voucher_value
      //     : 0
    }
  } else if (voucher.voucher_type === 1) { //Giảm giá %
    if (!voucher.condition_type) { // Không có điều kiện
      applied_value = amount * voucher.voucher_value / 100
    } else if (voucher.condition_type === 1) { //giá trị tối thiểu của đơn hàng
      if (amount >= voucher?.condition_value) {
        applied_value = amount * voucher.voucher_value / 100
      } else {
        error_msg = "Hóa đơn chưa đạt giá trị tối thiểu"
        applied_value = 0
      }
      // applied_value = voucher.condition_value
      //   && amount >= voucher.condition_value
      //     ? amount * voucher.voucher_value / 100
      //     : 0
    }
    /**
     * Trường hợp có trường giá trị tối đa
     */
    if (voucher?.max_applied_value && voucher.max_applied_value > 0 && voucher.max_applied_value < applied_value) {
      applied_value = voucher.max_applied_value
    }
  }
  return { applied_value, error_msg }
}


/* function parseDate(timestamp) {
  const date = new Date(timestamp)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${year} ${hour}:${min}`
}

function parseVouchers(vouchers) {
  vouchers.map(v => {
    v = parseVoucher(v)
  })
  return vouchers
} */

function parseVoucher (v) {
  if (Object.keys(v).length > 0) {
    const VoucherType = ["Giảm giá trực tiếp", "Giảm theo %", "Mã Miễn phí vận chuyển"]
    const ReferenceType = ["Sản phẩm", "Ngành hàng", "Tất cả sản phẩm"]
    const ConditionType = ["Không có điều kiện gì khác", "Tổng tiền đơn hàng tối thiểu"]
    v.voucher_type_label = VoucherType[v.voucher_type]
    v.reference_type_label = ReferenceType[v.reference_type]
    v.condition_type_label = ConditionType[v.condition_type]
    // v.start_at = parseDate(v.start_at)
    // v.stop_at = parseDate(v.stop_at)
  }

  return v
}

module.exports = {applyVoucherV2, applyValue}
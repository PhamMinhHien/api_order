const db = mrequire('./services/tvcdb')
const { isUid } = mrequire('./utils')
const prodFilter = mrequire('./fragments/productFilter')

const voucherFilterClause = `eq(display_status, 2) AND NOT eq(is_deleted, true)`
const productFragment = `
  uid
  product_name: product_name
  product.partner {
    partner_id: id
  }
  product.pricing (first: -1) {
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
  redeem
  start_at
  stop_at
  is_internal
  collection_image
  image_highlight
`
async function applyVoucher ({body}) {
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
      product.pricing (first: -1) {
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
    limit_redeem
    start_at
    stop_at
    is_internal
    operator
  `

  const pu = items.map(i => i.uid).join(',')

  if (voucher_code && voucher_code !== "") {
    const time = new Date().getTime()
    const {
      rsVoucher: [voucher],
      all_items,
      cus_result: [customer]
    } = await db.query(`{
        rsVoucher(func:type(Collection)) @filter(eq(voucher_code, ${voucher_code}) AND eq(display_status, 2) AND NOT eq(is_deleted, true) AND ge(stop_at, ${time})) {
          ${voucherField}
          voucher_usage: ~voucher_usage.voucher {
            uid
            redeem
            customer_uid
          }
          voucher.customers {
            uid
            expand(_all_)
          }
          highlight_products: highlight.products ${prodFilter} @normalize{
            ${productFragment}
          }
          highlight_negative_products: highlight.negative_products ${prodFilter} {
            uid
            product_name
          }
          collection_products: highlight.collections {
            ~product.collection ${prodFilter} {
              ${productFragment}
            }
          }
          voucher_conditions: voucher.conditions @facets(orderasc: display_order) {
            uid
            section_value
            section_ref
            section_name
          }
        }

        all_items(func: uid(${pu})) ${prodFilter} @normalize{
          ${productFragment}
        }
        cus_result(func: uid(${customer_id})) {
          total_order: count(~order.customer)
        }
      }`)

    const require_section = voucher?.voucher_conditions?.length ?
      voucher.voucher_conditions.find(vvc => vvc.section_value === "previous_voucher" && vvc.section_ref) : null

    const {result: [previous_voucher], rsvoucher: [voucher_required]} = require_section?.section_ref ? await db.query(`{
        var(func: type(VoucherUsage)) @filter(eq(voucher_uid, ${require_section.section_ref}) AND eq(customer_uid, ${customer_id})) {
          voucher_usage.order @filter(eq(order_status, 4)) {
            o as uid
          }
        }
        rsvoucher(func: uid(${require_section.section_ref})) {
          uid
          voucher_code
        }
        result(func: uid(o)) {
          uid
          order_id
        }
      }`) : {result: [], rsvoucher: []}


    return processVoucher(voucher, items, customer_id, voucher?.voucher_usage, voucher?.highlight_products, voucher?.collection_products, all_items, customer, voucher_required, previous_voucher)

  } else {

    const time = new Date().getTime()

    const {
      rsVoucher,
      all_items,
      cus_result: [customer]
    } = await db.query(`{
        rsVoucher(func:type(Collection)) @filter(eq(collection_type, 300) AND eq(display_status, 2) AND NOT eq(is_deleted, true) AND le(start_at, ${time}) AND ge(stop_at, ${time}) AND NOT eq(is_internal, true) AND eq(auto_apply, true)) {
          ${voucherField}
          voucher_usage: ~voucher_usage.voucher {
            uid
            redeem
            customer_uid
          }
          voucher.customers @filter(uid(${customer_id})) {
            uid
            expand(_all_)
          }
          highlight_products: highlight.products ${prodFilter} @normalize {
            ${productFragment}
          }
          highlight_negative_products: highlight.negative_products ${prodFilter} {
            uid
            product_name
          }
          collection_products: highlight.collections @normalize{
            ~product.collection ${prodFilter} {
              ${productFragment}
            }
          }
          voucher_conditions: voucher.conditions @facets(orderasc: display_order) {
            uid
            section_value
            section_ref
            section_name
          }
        }

        all_items(func: uid(${pu})) ${prodFilter} @normalize {
          ${productFragment}
        }
        cus_result(func: uid(${customer_id})) {
          total_order: count(~order.customer)
        }
      }`)

    for (let i = 0; i < rsVoucher?.length; i++) {
      const voucher = rsVoucher[i]
      const require_section = voucher?.voucher_conditions?.length ?
        voucher.voucher_conditions.find(vvc => vvc.section_value === "previous_voucher" && vvc.section_ref) : null

      const {result: [previous_voucher], rsvoucher: [voucher_required]} = require_section?.section_ref ? await db.query(`{
          var(func: type(VoucherUsage))
          @filter(eq(voucher_uid, ${require_section.section_ref || ""}) AND eq(customer_uid, ${customer_id})) {
            voucher_usage.order @filter(eq(order_status, 4)) {
              o as uid
            }
          }
          rsvoucher(func: uid(${require_section.section_ref})) {
            uid
            voucher_code
          }
          result(func: uid(o)) {
            uid
            order_id
          }
        }`) : {result: [], rsvoucher: []}

      rsVoucher[i]['previous_voucher'] = previous_voucher
      rsVoucher[i]['voucher_required'] = voucher_required
    }

    rsVoucher && rsVoucher.map(voucher => processVoucher(voucher, items, customer_id, voucher?.voucher_usage, voucher?.highlight_products, voucher?.collection_products, all_items, customer, voucher.voucher_required, voucher.previous_voucher))
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

function processVoucher (voucher, items, customer_id, voucher_usage, highlight_products, collection_products, all_items, customer = null, voucher_required = null, previous_voucher = null) {

  let check_time = false

  if (voucher) {
    /**
       * đầu tiên là kiểm tra Target Type (đối tượng áp dụng)
       */
    let checked = checkConditions(voucher, all_items, customer, voucher_required, previous_voucher)
    if (checked && checked?.allow_voucher?.status === false) {
      return {
        statusCode: 400,
        message: checked.allow_voucher.message
      }
    }
    if (checked && checked?.group_conditions === false) {
      if (checked?.detail_conditions?.cond_min_amount?.status === false) {
        return {
          statusCode: 400,
          message: checked.detail_conditions.cond_min_amount.message
        }
      }
      if (checked?.detail_conditions?.cond_first_order?.status === false) {
        return {
          statusCode: 400,
          message: checked.detail_conditions.cond_first_order.message
        }
      }
      if (checked?.detail_conditions?.cond_previous_voucher?.status === false) {
        return {
          statusCode: 400,
          message: checked.detail_conditions.cond_previous_voucher.message
        }
      }
    }

    /**
      * Bắt đầu kiểm tra Target và các điều kiện ngoài block conditions
     */
    let {check_target, is_redeemed, is_limit_redeemed} = checkTargetType(voucher, voucher_usage, customer_id)
    check_time = checkExpiriedTime(voucher)
    if (!check_time) {
      return {
        statusCode: 400,
        message: "Mã khuyến mãi đã quá hạn sử dụng"
      }
    } else if (!check_target) {
      return {
        statusCode: 400,
        message: (!is_redeemed && !is_limit_redeemed) ? "Mã khuyến mãi không hợp lệ" : is_redeemed ? "Mã khuyến mãi đã hết lượt sử dụng" : "Voucher đã được sử dụng hết."
      }
    } else {
      const {applied_value, applied_items, error_msg} = getValues(voucher, items, highlight_products, collection_products, all_items)
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


/**
   * Check Target & Redeem & Limit Redeem
   * @param {*} voucher
   * @param {*} voucher_usage
   * @param {*} customer_id
   */
function checkTargetType (voucher, voucher_usage, customer_id) {
  let check_target = false
  let is_redeemed = false
  let is_limit_redeemed = false

  /**
     * update: 21-10-2020
     * ở trên đã lấy tất cả voucher usages của Voucher này ra, nên ở đây cần
     * find lại usages của riêng customer này và thế vào chỗ voucher_usage trước đó
     */
  const cus_voucher_usage = voucher_usage?.find(vu => vu.customer_uid === customer_id)
  const total_usage_redeem = voucher_usage?.reduce((total, {redeem}) => total + redeem, 0)
  switch(voucher.target_type) {
    case 0: //all customer
      if (!cus_voucher_usage) {
        check_target = true
      } else if (cus_voucher_usage.redeem < voucher.redeem) {
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

  /**
     * limit_redeem là số lượng phát hành của Voucher. Thế nên là
     * khi tổng số voucher_usage.redeem > limit_redeem là hết được sử dụng.
     */


  /**
     * redeem là Số lần sử dụng trên mỗi đối tượng được áp dụng. Thế nên
     * mỗi số trong redeem tương ứng với số trong voucher_usage.redeem
     */
  if (cus_voucher_usage && cus_voucher_usage.redeem >= voucher.redeem) {
    check_target = false // force false tất cả khi mà số lượng cho phép sử dụng đã hết
    is_redeemed = true
  }
  if (voucher.limit_redeem && total_usage_redeem >= voucher.limit_redeem) {
    check_target = false // force false tất cả khi mà số lượng voucher phát hành đã hết.
    is_limit_redeemed = true
  }

  return {check_target, is_redeemed, is_limit_redeemed}
}


/**
     *
     * @param {*} voucher
     * @param {*} items
     * @param {*} customer
     *
     * Nếu như có vùng điều kiện voucher.conditions và operator
     * thì đưa vào một hàm riêng để xét true false xong thì tiếp các bước như cũ
     * danh sách tất cả sản phẩm của đơn hàng
     */
function checkConditions (voucher, all_items, customer, voucher_required, previous_voucher) {

  //cứ tìm thấy 1 sản phẩm trùng với ds không được
  //hỗ trợ là từ chối voucher đó luôn
  let allow_voucher = {
    status: true,
    message: "",
    items: []
  }
  if (voucher?.highlight_negative_products?.length) {
    all_items.forEach(al => {
      if (voucher.highlight_negative_products.find(hnp => hnp.uid === al.uid)) {
        allow_voucher.items.push(al)
      }
    })
    if (allow_voucher.items.length > 0) {
      allow_voucher.status = false
      allow_voucher.message = "Voucher này không áp dụng cho một số sản phẩm trong giỏ hàng."
    }
  }

  let catcheCond = 0
  let cond_min_amount = {
    status: true,
    message: ""
  }
  let cond_first_order = {
    status: true,
    message: ""
  }
  let cond_previous_voucher = {
    status: true,
    message: ""
  }
  if (voucher?.operator && voucher?.voucher_conditions?.length) {
    voucher.voucher_conditions.forEach(vvc => {
      if (vvc.section_value === "min_amount") {
        //
        let amount = all_items.reduce((total, {price_with_vat, discount, quantity = 1}) => ((discount ? price_with_vat - price_with_vat * discount / 100 : price_with_vat) * quantity) + total, 0)

        // tổng tiền đơn hàng nhỏ hơn số tiền được qui định tại section này
        if (amount < vvc.section_ref) {
          catcheCond++
          cond_min_amount = {
            status: false,
            message: "Tổng tiền đơn hàng chưa đạt điều kiện tối thiểu"
          }
        }
      }
      if (vvc.section_value === "first_order") {
        //đã có nhiều hơn 1 đơn => không phải đơn lần đầu
        if (customer?.total_order > 0) {
          catcheCond++
          cond_first_order = {
            status: false,
            message: "Voucher chỉ áp dụng cho đơn hàng đầu tiên"
          }
        }
      }
      if (vvc.section_value === "previous_voucher") {
        // Đơn hàng required đã được query tìm kiếm ở block query,
        // nếu đến đây mà không tìm thấy có nghĩa là khách chưa sử dụng voucher được yêu cầu này
        // hoặc sử dụng mà trạng thái đơn hàng đó chưa phải là đã giao.
        if (!previous_voucher || !previous_voucher?.uid) {
          catcheCond++
          cond_previous_voucher = {
            status: false,
            message: `Không đủ điều kiện áp dụng. Chưa có đơn hàng đã giao với voucher ${voucher_required?.voucher_code}`
          }
        }
      }
    })
  }

  let group_conditions = false
  if (voucher.operator === "AND" && catcheCond === 0) {
    // Tất cả điều kiện phải pass
  } else if(voucher.operator === "OR" && catcheCond < voucher.voucher_conditions.length) {
    // Chỉ cần 1 điều kiện thoả là pass
    group_conditions = true
  } else {
    // không thoả điều kiện
    group_conditions = false
  }

  return {
    allow_voucher,
    group_conditions,
    detail_conditions: {
      cond_min_amount,
      cond_first_order,
      cond_previous_voucher
    }
  }
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
function getValues (voucher, items, highlight_products, collection_products, all_items) {
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
    let fp = products?.find(p => p.uid === order_items[i].uid)
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
    // applied_value = amount < voucher.voucher_value ? amount : voucher.voucher_value
    if (!voucher.condition_type) { // Không có điều kiện
      applied_value = amount < voucher.voucher_value ? amount : voucher.voucher_value
    } else if (voucher.condition_type === 1) { //giá trị tối thiểu của đơn hàng
      if (amount >= voucher?.condition_value) {
        applied_value = voucher.voucher_value
      } else {
        error_msg = "Hóa đơn chưa đạt giá trị tối thiểu"
        applied_value = 0
      }
    }
  } else if (voucher.voucher_type === 1) { //Giảm giá %
    // applied_value = amount * voucher.voucher_value / 100
    if (!voucher.condition_type) { // Không có điều kiện
      applied_value = amount * voucher.voucher_value / 100
    } else if (voucher.condition_type === 1) { //giá trị tối thiểu của đơn hàng
      if (amount >= voucher?.condition_value) {
        applied_value = amount * voucher.voucher_value / 100
      } else {
        error_msg = "Hóa đơn chưa đạt giá trị tối thiểu"
        applied_value = 0
      }
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

async function redeemUsage (voucher_uid, voucher_code, customer_id, order_uid, items) {
  // const {voucher_uid, voucher_code, customer_id, order_uid, items} = body
  const pu = items.map(i => i.uid).join(',')

  const {rsVoucher: [voucher], rsCustomer: [customer], rsOrder: [order], all_items} = await db.query(`{
    rsVoucher(func:type(Collection)) @filter(uid(${voucher_uid}) AND eq(voucher_code, ${voucher_code}) AND ${voucherFilterClause}) {
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
    rsCustomer(func:type(Customer)) @filter(uid(${customer_id}) AND not eq(is_deleted, true)) {
      uid
      expand(_all_)
    }
    rsOrder(func:type(PrimaryOrder)) @filter(uid(${order_uid})) {
      uid
      expand(_all_)
    }
    all_items(func: uid(${pu})) ${prodFilter} @normalize {
      ${productFragment}
    }
  }`)

  if (voucher && customer && order) {
    const {
      applied_value,
      applied_items,
      rejected_items
    } = getValues(voucher, items, voucher.highlight_products, voucher.collection_products, all_items) //getValues(voucher, items)

    if (!(voucher?.voucher_usage) || (voucher?.voucher_usage?.[0]?.redeem < voucher.redeem)) {
      const mutateData = {
        'dgraph.type': "VoucherUsage",
        customer_id,
        voucher_uid: voucher.uid,
        applied_items,
        applied_value,
        rejected_items,
        'voucher_usage.order': {uid: order.uid},
        'voucher_usage.customer': {uid: customer_id},
        'voucher_usage.voucher': {uid: voucher.uid},
        'redeem': voucher?.voucher_usage?.[0]?.redeem ? voucher.voucher_usage[0].redeem + 1 : 1,
        'uid': voucher?.voucher_usage?.uid ? voucher.voucher_usage.uid : "_:new_voucher_usage",
      }
      await db.mutate({set: mutateData})
      return {
        statusCode: 200,
        message: "Redeem thành công"
      }
    } else {
      return {
        statusCode: 400,
        message: "Quá số lần Redeem rồi."
      }
    }

  } else {
    return {
      statusCode: 400,
      message: "Oop SORRY! Our got an error. Our will fix it"
    }
  }

}

async function reChargedVoucher (order_uid) {
  let {orders: [{voucher_usage_uid, voucher_usage_redeem, voucher_usage_re_charged}]} = await db.query(`{
    orders(func:uid(${order_uid})) @normalize {
      uid
      voucher_code: voucher_code
      order.customer {
        customer_uid: uid
      }
      ~voucher_usage.order {
        voucher_usage_uid: uid
        voucher_usage_redeem: redeem
        voucher_usage_re_charged: re_charged
      }
    }
  }`)

  if (voucher_usage_uid && voucher_usage_redeem) {
    if (voucher_usage_redeem > 0 && (!voucher_usage_re_charged || voucher_usage_re_charged < 3)) {
      const mutateData = {
        set: {
          uid: voucher_usage_uid,
          redeem: --voucher_usage_redeem,
          re_charged: !voucher_usage_re_charged ? voucher_usage_re_charged = 1 : ++voucher_usage_re_charged
        }
      }
      await db.mutate({...mutateData})

      return {
        statusCode: 200,
        message: `Hoàn trả mã khuyến mãi thành công lần ${voucher_usage_re_charged}`
      }
    } else {
      let errMsg = ''
      errMsg += voucher_usage_redeem <= 0 ? `Mã khuyến mãi chưa sử dụng` : ''
      errMsg += voucher_usage_re_charged >= 3 ? `Mã khuyến mãi đã hoàn trả 3 lần, không còn giá trị nữa` : ''

      return {
        statusCode: 400,
        message: 'Hoàn trả mã khuyến mãi thất bại.',
        redeem: voucher_usage_redeem,
        re_charged: voucher_usage_re_charged,
        errMsg
      }
    }
  } else {
    return {
      statusCode: 400,
      message: 'Không tìm thấy mã khuyến mãi'
    }
  }
}

async function listVoucher ({body}) {
  if (!body) {
    throw Error("Invalid customer uid")
  }
  const customer_id = body.customer_id || null
  const time = new Date().getTime()
  const query = customer_id !== null ?
    `{
      var(func: uid(${customer_id})) @filter(type(Customer) AND NOT eq(is_internal, true)) {
        ~voucher.customers @filter(le(start_at, ${time}) AND ge(stop_at, ${time})) {
          rvc as uid
        }
      }
      var(func: eq(collection_type, 300)) @filter(eq(target_type, 0) AND le(start_at, ${time}) AND ge(stop_at, ${time}) AND NOT eq(is_internal, true)) {
        vc as uid
      }
      result(func: uid(rvc,vc)) @filter(not eq(is_deleted, true) AND eq(display_status, 2)) {
        ${voucherField}
        voucher.customers {
          uid
        }
      }
      vcus(func: type(VoucherUsage)) @filter(eq(customer_uid, ${customer_id})) {
        uid
        voucher_type
        reference_type
        voucher_uid
        redeem
      }
    }`
    :
    `{
      var(func: eq(collection_type, 300)) @filter(not eq(is_deleted, true) AND eq(display_status, 2) AND eq(target_type, 0) AND le(start_at, ${time}) AND ge(stop_at, ${time}) AND NOT eq(is_internal, true)) {
        vc as uid
      }
      result(func: uid(vc), orderasc: stop_at) {
        ${voucherField}
      }
    }`

  const {result, vcus} = await db.query(query)

  result.map((r, i) => {
    const findVc = vcus && vcus.find(v => v.voucher_uid === r.uid && v.redeem >= r.redeem)
    if (findVc) {
      result.splice(i, 1)
    }
  })

  return {
    statusCode: 200,
    data: parseVouchers(result)
  }
}

async function getBestVoucher ({params}) {
  if (!params || !params.product_uid) {
    throw Error("Invalid params product_uid")
  }

  if (!params || !params.customer_id) {
    throw Error("Invalid params customer_uid")
  }

  const { product_uid, customer_id } = params
  const time = new Date().getTime()
  const {result, products} = await db.query(`{
    var(func: uid(${product_uid})) ${prodFilter} {
      ~highlight.products {
        vc as uid
      }
    }
    var(func: uid(${product_uid})) {
      product.collection {
        pc as uid
        parent {
          ppc as uid
        }
      }
    }
    var(func: uid(pc, ppc)) {
      ~highlight.collections {
        vcc as uid
      }
    }
    result(func: type(Collection)) @filter(eq(collection_type, 300) AND NOT eq(is_deleted, true) AND eq(display_status, 2) AND le(start_at, ${time}) AND ge(stop_at, ${time}) AND (uid(vc, vcc) OR eq(reference_type, 2)) AND NOT eq(is_internal, true)) {
      ${voucherField}
      voucher_usage: ~voucher_usage.voucher @filter(eq(customer_uid, ${customer_id}) ) {
        uid
        redeem
      }
    }
    products(func: uid(${product_uid})) ${prodFilter} @normalize {
      uid
      product.pricing {
        price_with_vat: price_with_vat
        discount: discount
        quantity: quantity
      }
    }
  }`)

  let max_value = 0
  let best_voucher = {}
  for(let i = 0; i < result.length; i++) {
    const {check_target} = checkTargetType(result[i], result[i].voucher_usage, customer_id)
    if (check_target) {
      let {applied_value} = applyValue(products, result[i])
      if (applied_value > max_value) {
        max_value = applied_value
        best_voucher = result[i]
      }
    }

  }

  if (Object.keys(best_voucher).length > 0) {
    return {
      statusCode: 200,
      data: parseVoucher({...best_voucher, applied_value: max_value})
    }
  } else {
    return {
      statusCode: 400,
      message: "Không tìm thấy voucher"
    }
  }
}


/* function parseDate (timestamp) {
  const date = new Date(timestamp)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${year} ${hour}:${min}`
} */

function parseVouchers (vouchers) {
  for(let v of vouchers) {
    parseVoucher(v)
  }

  return vouchers
}

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

module.exports = {applyVoucher, redeemUsage, reChargedVoucher, listVoucher, getBestVoucher}
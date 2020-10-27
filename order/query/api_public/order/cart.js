"use strict"

const db = mrequire('./services/tvcdb')
const { createUidMap } = mrequire('./utils')

async function listCartItems ({body}) {

  if(!body || !Array.isArray(body.items)) {
    throw { statusCode: 400, message: "What are you doing here?" }
  }

  const items_uids = body.items.map(i => i.uid).join(',')

  const { items } = await db.query(`{
    items(func: uid(${items_uids})) {
      uid
      sku_id
      parent_sku_id
      product_name
      color
      image_cover
      image_highlight
      product.pricing (first: -1) {
        price_with_vat
      }
    }
  }`)

  const uid_quantity = createUidMap(body.items, "quantity")
  items.forEach(i => {
    i.quantity = uid_quantity[i.uid]
    if (i?.['product.pricing']?.[0]) {
      i['product.pricing'] = i['product.pricing'][0]
    }
  })

  return {
    statusCode: 200,
    data: items
  }
}

module.exports = { listCartItems }
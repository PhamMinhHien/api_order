"use strict"

const db = mrequire('./services/tvcdb')
const cache = mrequire('./modules/cache')

let inited = false
let lastOrderDate = ''
let inDayCount = 0

function parseCurrentDate () {
  const date = new Date()
  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

async function init () {
  if(!lastOrderDate) {
    let [order] = await db.query(`{
      result(func: type(PrimaryOrder), first: -1) {
        order_id
      }
    }`).then(rsp => rsp.result)
    if(order && order.order_id) {
      const [dateStr, count] = order.order_id.match(/^S(\d{6})-(\d{6})/).slice(1)
      lastOrderDate = dateStr
      inDayCount = await cache.get('orderInDayCount')
      if(!inDayCount) {
        cache.set('orderInDayCount', inDayCount = count)
      }
    }
  }
}

async function generateOrderId () {
  if(!inited) {
    await init()
  }
  const curDateStr = parseCurrentDate()
  if(lastOrderDate === curDateStr) {
    inDayCount = await cache.incr('orderInDayCount')
  } else {
    lastOrderDate = curDateStr
    cache.set('orderInDayCount', inDayCount = 1)
  }
  return `S${curDateStr}-${String(++inDayCount).padStart(6, "0")}`
}

module.exports = generateOrderId
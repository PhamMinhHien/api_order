/*
    Nội dung : 
      - File này export các function query data từ api cms 
      - Gom được nội dung nào sẽ gom sau .
*/
const { orderFragment } = require('./var_order')







"use strict"
const db = mrequire('./services/tvcdb')
// const session = mrequire('./modules/userSession')
// const json2xls = mrequire('./services/exports/json2xls')
// const tracking = mrequire('./services/tracking')




function loadMore(number, offset) {
  let x =  db.query(`query result($number: string, $offset: string) {
      result(func: type(PrimaryOrder), orderdesc: created_at, first: $number, offset: $offset) {
          ${orderFragment}
      }
  }`, { $number: `${number}` || 20, $offset: `${offset}` || 0 })
  console.log(x);
  return x
}

function getByUid($uid){
  return db.query(`query result($uid: string) {
    result(func: uid($uid)) {
      ${orderFragment}
    }
  } `, { $uid })
}

// Lấy danh sách Order trên table api_cms 
async function orderFilter(body) {
  const { number = 20, page = 0, filter = '' } = body // Giá trị mặc định khi ko có dữ liệu 
  const { summary, data } = await db.query(`query result($number: int, $offset: int) {
      orders as summary(func: type(PrimaryOrder)) @filter(not eq(is_deleted, true)${filter}) {
        totalCount: count(uid)
      }
      data(func: uid(orders), orderdesc: created_at, first: $number, offset: $offset) {
        ${orderFragment}
      }
    }`, { $number: String(number), $offset: String(page * number) }
  )

  data.map(d => {
    d.total_initial_amount = d?.voucher_usage?.[0] ? d.total_pay + d.applied_value : d.total_pay
  })
  console.log(summary);
  console.log(data);
  return { summary, data }
}

module.exports = {
    loadMore,
    getByUid,
    orderFilter
}
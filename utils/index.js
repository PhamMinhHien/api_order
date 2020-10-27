const uid = /^0[xX][0-9A-F]+$/i
const orderId = /^S\d{6}-\d{6}$/
const subOrderId = /^S\d{6}-\d{6}[A-Z, AA-ZZ]$/
module.exports = {
  isUid: str => uid.test(str),
  isOrderId: str => orderId.test(str),
  isSubOrderId: str => subOrderId.test(str),
  uid: uid => ({ uid }),
  createUidMap (items, ...props) {
    if(props.length === 0) {
      return items.reduce((o, item) => {
        o[item.uid] = item
        return o
      }, {})
    }
    if(props.length === 1) {
      const prop = props[0]
      return items.reduce((o, item) => {
        o[item.uid] = item[prop]
        return o
      }, {})
    } else {
      return items.reduce((o, item) => {
        const i = {}
        for(let k of props) {
          i[k] = item[k]
        }
        o[item.uid] = i
        return o
      }, {})
    }
  }
}
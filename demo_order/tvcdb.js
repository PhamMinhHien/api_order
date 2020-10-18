
global.__proto__.mrequire = require.main.require
const { getService, closeAllServices } = mrequire('./modules/dgraph-client')
const { alpha_grpc } = config

const tvcdb = getService('tvcdb', alpha_grpc)

function addType (type, data) {
  if(data) {
    if(Array.isArray(data)) {
      data.forEach(o => {
        o['dgraph.type'] = type
      })
    } else if(typeof data === 'object') {
      data['dgraph.type'] = type
    }
  }
  return data
}
function addTypeSet(type, data) {
  if(data.set) {
    addType(type, data.set)
  }
  return data
}
tvcdb.addTypeSet = addTypeSet
tvcdb.addType = addType
tvcdb.getUids = function (result, initData = { statusCode: 200 }) {
  const uid_arr = result.getUidsMap().arr_
  if(uid_arr.length) {
    const uids = {}
    uid_arr.forEach(([k, v])=>{
      uids[k] = v
    })
    return {
      ...initData,
      ...(uid_arr.length && {uids})
    }
  }
  return initData
}

process.on('prepareExit', closeAllServices)

module.exports = tvcdb
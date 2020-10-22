"use strict"

const dgraph = require("dgraph-js")
const grpc = require("grpc")

const {
  DgraphClientStub,
  DgraphClient,
  Mutation,
  Request,
  Operation
} = dgraph

function createStub(host) {
  if(typeof host === 'string') {
    return new DgraphClientStub(host)
  } else {
    const { addr, ca, key, cert } = host
    return new DgraphClientStub(addr, grpc.credentials.createSsl(ca, key, cert))
  }
}

function createClient(hosts) {
  if(!hosts || hosts.length === 0) {
    throw new Error("no alpha hosts")
  }
  const stubs = hosts.map(createStub)
  // connect multi clusters
  const client = new DgraphClient(...stubs)

  /**
    * Make query Dgraph GraphQL+-
    * @param {String} query `all(func: ...)` | `query all($a: string) { all(func: eq(name, $my_var)) { name } }`
    * @param {Object} vars { "$my_var": "LPN Nha" }
    * @returns {Promise}
    */
  function query (...args) {
    const txn = client.newTxn()
    const qResult = txn.queryWithVars(...args)
    return qResult.then(function (result) {
      return result.getJson()
    })
  }

  /**
    * Update & delete, Update | delete
    * @param {Object} opts { del: {...}, set: {...} }
    * @returns {Mutation}
    */
  function createMutation(opts) {
    const m = new Mutation()
    if(opts.del) {
      typeof opts.del === 'string' ? m.setDelNquads(opts.del) : m.setDeleteJson(opts.del)
    }
    if(opts.set) {
      typeof opts.del === 'string' ? m.setSetNquads(opts.set) : m.setSetJson(opts.set)
    }
    return m
  }

  /**
    * Tạo request chứa nhiều mutate trong 1 lần query
    * @param {Array} mutations [{del: {...}, set: {...}}, { del: {...}, set: {...} }]
    * @returns {Request}
    */
  function createRequest (mutations) {
    const req = new Request()
    req.setMutationsList(mutations.map(createMutation))
    return req
  }

  /**
    * Update & delete, Update | delete
    * @param {Object} opts { del: {...}, set: {...} }
    * @param {Transaction} txn (Optional)
    * @returns {Promise}
    * @example
    * mutate( { del: {...}, set: {...} })
    */
  function mutate (opts, txn) {
    const m = createMutation(opts)
    if(!txn) {
      txn = client.newTxn()
      m.setCommitNow(true)
    }
    return txn.mutate(m)
  }

  /**
    * Thực thi nhiều mutation trong 1 lần gọi
    * @param {Array} mutations
    * @param {Transaction} txn (Optional)
    * @returns {Promise}
    */
  function mutates (mutations, txn) {
    const req = createRequest(mutations)
    if(!txn) {
      txn = client.newTxn()
      req.setCommitNow(true)
    }
    return txn.doRequest(req)
  }

  /**
    * Query lấy thông số và Update, Delete dựa vào thông số của query
    * @param {Object} opts
    * @param {Object} txn (Optional) Transaction object
    * @returns {Promise}
    * tham khảo upsert
    * link: https://docs.dgraph.io/mutations/#upsert-block
    * example: upsert({ query: `v as var(func: eq(email: "ngocnha@gmail.com"))`, set: { uid: uid(v), email: ngocnha2@gmail.com } })
    */
  function upsert (opts, txn) {
    const m = new Mutation()
    const req = new Request(
    )
    if(opts.query) {
      req.setQuery(opts.query)
    }
    if(opts.del) {
      m.setDeleteJson(opts.del)
    }
    if(opts.set) {
      m.setSetJson(opts.set)
    }
    req.addMutations(m)
    if(!txn) {
      txn = client.newTxn()
      req.setCommitNow(true)
    }
    return txn.doRequest(req)
  }
    
  // Các operation phải thực hiện tuần tự,
  // thực hiện chung vừa dropAll vừa alter trong 1 lần sẽ gây sai sót

  function dropAll() {        
    const o = new Operation()
    o.setDropAll(true)
    return client.alter(o)
  }
  function alter(schema) {
    const o = new Operation()
    o.setSchema(schema)
    return client.alter(o)
  }
  // FUNCTION USE TO CHANGE DATA EDGES
  function createEdgesData(productObj) {
    if (Object.keys(productObj).length != 0) {
      let str = JSON.stringify(productObj);
      str = str.replace(/"region_uid":/g, "\"areas\":");
      str = str.replace(/"manufacturer_uid":/g, "\"product.manufacturer\":");
      str = str.replace(/"brand_uid":/g, "\"product.brand\":");
      str = str.replace(/"partner_uid":/g, "\"product.partner\":");
      str = str.replace(/"collection_uid":/g, "\"product.collection\":");
      str = str.replace(/"UOM_uid":/g, "\"product.uom\":");
      productObj = JSON.parse(str);
      let regionArr = productObj.areas.split(',')
      if (regionArr.length > 0) {
        let tmp = []
        for (let i = 0; i < regionArr.length; i++){
          tmp.push({ uid: regionArr[i] })
        }
        productObj.areas = tmp;
      } 
        
      productObj['product.manufacturer'] = {uid: productObj['product.manufacturer']}
      productObj['product.brand'] = {uid: productObj['product.brand']}
      productObj['product.partner'] = { uid: productObj['product.partner'] }
      let collectionArr = productObj['product.collection'].split(',')
      if (collectionArr.length > 0) {
        let tmp = []
        for (let i = 0; i < collectionArr.length; i++){
          tmp.push({ uid: collectionArr[i] })
        }
        productObj['product.collection'] = tmp
      } 
        
      productObj['product.uom'] = { uid: productObj['product.uom'] }
      return productObj;
    }
  }
  // END FUNCTION USE TO CHANGE DATA EDGES
  function importData(basicFields, logUID) {
    const m = new Mutation()
    const txn = client.newTxn()
    let count = basicFields.length;
    let limit = 0
    let dataImport = [];
    let dataChange = {}
    let Uid = 0;
    if (count > 0) {
      while (count > 0) {
        limit = (basicFields.length > 200) ? 199 : basicFields.length; 
        let tmp = basicFields.splice(0, limit);
        console.log('check length tmp', tmp.length)
        for (let i = 0; i < tmp.length; i++){
          Uid++
          dataChange = createEdgesData(tmp[i])
          dataChange.uid = `_:new_product_${Uid}`
          dataChange['dgraph.type'] = "Product"
          dataChange.display_status = 3
          dataChange.input_status = true
          dataImport.push(dataChange)
          // console.log("dataChange.uid", dataChange.uid)
        }
        m.setSetJson(dataImport)
        // dataImport = []
        console.log('check length basicField after splice', basicFields.length)
        count = basicFields.length
      }
      console.log('Finalize !!!!!', basicFields.length)
      m.setCommitNow(true)
      txn.mutate(m)
      mutate({
        set: {
          uid: logUID,
          import_status: 'Done',
          "dgraph.type": "LogImport"
        }
      })
               
    }
  }

  function close() {
    stubs.forEach(stub => stub.close())
  }

  return {
    close,
    txn() {
      return client.newTxn()
    },
    dropAll,
    alter,
    query,
    createMutation,
    createRequest,
    mutate,
    mutates,
    upsert,
    importData
  }
}

let services = {}

function getService(name, hosts) {
  if(typeof services[name] === 'object') {
    return services[name]
  } else if(hosts.length > 0) {
    return services[name] = createClient(hosts)
  }
  throw new Error('Required hosts')
}
function closeService(name) {
  services[name].close()
  delete services[name]
}
function closeAllServices() {
  for(let s of Object.values(services)) {
    s.close()
  }
  services = {}
  console.log('closed all db connection')
}

module.exports = {
  services,
  getService,
  closeService,
  closeAllServices
}

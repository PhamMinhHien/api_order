// Thư viện này giúp đơn giản hóa lại việc xài thư viện có sẵn dgraphjs
// Link tài liệu thư viện dgraphjs
// https://github.com/dgraph-io/dgraph-js
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
    return new DgraphClientStub(host, grpc.credentials.createInsecure())
  } else {
    const { addr, ca, key, cert } = host
    return new DgraphClientStub(addr,grpc.credentials.createSsl(ca, key, cert))
    // return new DgraphClientStub(addr, grpc.credentials.createSsl(ca))
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
      m.setDeleteJson(opts.del)
    }
    if(opts.set) {
      m.setSetJson(opts.set)
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

  function close() {
    stubs.forEach(stub => stub.close())
  }

  return {
    close,
    txn() {
      // Example:
      // const txn = db.txn()
      // ... gọi các hàm mutate mutate ...
      // đến cuối cùng thì
      // txn.discard() // để hủy bỏ transaction
      // txn.commit() // để commit transaction, cập nhật dữ liệu vào db
      return client.newTxn()
    },
    dropAll,
    alter,
    query,
    createMutation,
    createRequest,
    mutate,
    mutates,
    upsert
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
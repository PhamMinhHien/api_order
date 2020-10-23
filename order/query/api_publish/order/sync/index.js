"use strict"

const { tvc_api } = config.services
const request = mrequire('./modules/http2-client')(tvc_api)

module.exports = function (type, uid, ...params) {
  request(`/api/sync/${type}/${uid}`)
    .then(() => {
      console.log("sync", type, "success", uid, ...params)
    })
    .catch((err) => {
      console.log(err.message + "\n", "sync", type, "failed", uid, ...params)
    })
}
var crypto = require("crypto")

function getMD5(buffer, encoding = "hex") {
  // hex | base64
  return crypto.createHash("md5").update(buffer).digest(encoding)
}

function randomStr(length) {
  var result = ""
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

function getFileExt(fileName) {
  return fileName.slice(-4)
}

module.exports = {
  getMD5,
  randomStr,
  getFileExt,
}

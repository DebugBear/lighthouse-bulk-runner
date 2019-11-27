const crypto = require("crypto")

module.exports = function hashString(str) {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 8)
}
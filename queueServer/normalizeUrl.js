const fetch = require("node-fetch")

const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36"

function tryUrl(url) {
  //console.log("Trying: ", url)

  return new Promise(async (resolve, reject) => {
    let timeout = setTimeout(() => {
      //console.log("timed out")
      resolve(null)
    }, 10000)
    try {
      const r = await fetch(url, { headers: { "User-Agent": userAgent, 'Content-Type': 'text/plain', } })
      if (r.status < 200 || r.status >= 400) {
        console.log(url, r.status)
        throw new Error(r.status)
      }
      clearTimeout(timeout)
      resolve(r.url)

    } catch (err) {
      //console.log("error", err.message)
      clearTimeout(timeout)
      resolve(null)
    }
  })
}


module.exports = async function findProtocolAndSubdomain(url) {
  if (url.search(/https?:\/\//) === 0) {
    return url
  }
  let urls = [
    "https://" + url,
    "http://" + url,
    "https://www." + url,
    "http://www." + url
  ]

  let tryNext, resolvedUrl = null
  while (tryNext = urls.shift()) {
    resolvedUrl = await tryUrl(tryNext)
    if (resolvedUrl) {
      return tryNext
    }
  }
  throw new Error(`Could not find full version of URL "${url}" that returns HTTP 2xx or 3xx`)
};

const request = require('request-promise');
const collectRunData = require("./collectRunData");
const Compute = require("@google-cloud/compute");

const ZONE_NAME = 'us-central1-a'

const LH_ATTEMPTS = 4

async function getQueueServerUrl() {
  return await request({
    uri: 'http://metadata.google.internal/computeMetadata/v1/instance/description',
    headers: {'Metadata-Flavor': 'Google'},
    json: true
  }).then((response) => (
    response.queueServerUrl
  )).catch((e) => {
    console.log(e)
  })
}

async function getNextUrl(url) {
  return await request(url).then((res) => {
    response = JSON.parse(res)
    return response
  })
}

async function deleteInstance() {
  const name =  process.env.HOSTNAME
  const compute = new Compute()
  const zone = compute.zone(ZONE_NAME)
  const vmObj = zone.vm(name)
  return await vmObj.delete()
}

(async function () {
  let queueServerUrl = await getQueueServerUrl().catch((e) => {
    console.log(e)
    deleteInstance()
  })

  let moreUrls = true
  while (moreUrls) {
    let urlData = await getNextUrl(queueServerUrl + "/getUrl").catch((e) => {
      moreUrls = false
      deleteInstance()
    })

    if (urlData) {
      console.log(urlData)
      let error = undefined

      let data = await collectRunData(urlData).catch( function(e) {
        error = e
	console.log("\n\nlighthouse error here:\n\n", error)
      })
      if (data && data.lhr && data.lhr.runtimeError) {
        error = data.lhr.runtimeError
	console.log("\n\nruntime error here:\n\n", error)
      }

      if (typeof error !== 'undefined') {
	request.post(queueServerUrl + "/postResult", {
          json: {error: error, response: urlData}
	}).catch((e) => {
          console.log(e)
	})
      }
      else {
	console.log(`returning success!`)
        await request.post(queueServerUrl + "/postResult", {
          json: {result: data, response: urlData}
        }).catch((e) => {
          console.log(e)
        })
      }
    }
  }
})()



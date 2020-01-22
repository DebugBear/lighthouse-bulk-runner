const request = require('request-promise');
const collectRunData = require("./collectRunData");
const Compute = require("@google-cloud/compute");

const ZONE_NAME = 'us-central1-a'

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
    return deleteInstance()
  })

  let moreUrls = true
  while (moreUrls) {
    let response = await getNextUrl(queueServerUrl + "/getUrl").catch((e) => {
      moreUrls = false
      return deleteInstance()
    })

    if (response) {
      let data = await collectRunData(response).catch((e) => (
	request.post(queueServerUrl + "/postResult", {
          json: {error: e, response: response}
	}).catch((e) => {
          console.log(e)
	})
      ))

      if (data) {
        await request.post(queueServerUrl + "/postResult", {
          json: {result: data, response: response}
        }).catch((e) => {
          console.log(e)
        })
      }
    }
  }
})()



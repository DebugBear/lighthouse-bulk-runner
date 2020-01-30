const request = require('request-promise');
const collectRunData = require("./collectRunData");
const Compute = require("@google-cloud/compute");

const ZONE_NAME = 'us-central1-a'

async function getQueueServerUrl() {
  return await request({
    uri: 'http://metadata.google.internal/computeMetadata/v1/instance/description',
    headers: { 'Metadata-Flavor': 'Google' },
    json: true
  }).then((response) => (
    response.queueServerUrl
  )).catch((e) => {
    console.log(e)
  })
}

async function deleteInstance() {
  const name = process.env.HOSTNAME
  const compute = new Compute()
  const zone = compute.zone(ZONE_NAME)
  const vmObj = zone.vm(name)
  return await vmObj.delete()
  process.exit()
}

(async function () {
  let queueServerUrl = await getQueueServerUrl().catch((e) => {
    console.log(e)
    return deleteInstance()
  })

  async function getNextUrl() {
    return await request(queueServerUrl + "/getUrl").then((res) => (
      response = JSON.parse(res)
    )).catch((e) => {
      console.log(e)
      return null
    })
  }

  const postResult = async (data) => {
    await request.post(queueServerUrl + "/postResult", {
      json: data
    }).catch(console.log)
  }

  let runSettings = null
  while (runSettings = await getNextUrl()) {
    let runResult = await collectRunData(runSettings)
    if (runResult.error)
      await postResult({ runResult, runSettings })
    else {
      await postResult({ runResult: { lhr: runResult.lhr }, runSettings })
    }
  }
  await deleteInstance()
})()
const request = require('request-promise');
const collectRunData = require("./collectRunData");

(async function () {
  let url = ""
  var options = {
    uri: 'http://metadata.google.internal/computeMetadata/v1/instance/description',
    headers: {
      'Metadata-Flavor': 'Google'
    },
    json: true // Automatically parses the JSON string in the response
  };

  await request(options).then((response) => (
    url = response.queueServerUrl
  )).catch((e) => {
    console.log("error retrieving client URL")
  })

  while (true) {
    let response = await request(url + "/getUrl").catch((e) => {
      process.exit()
    })

    response = JSON.parse(response)

    await collectRunData(response).then((result) => {
      request.post(url + "/postResult", {
        json: {
          response: response,
          result: result
        }
      })
    })
  }
})()
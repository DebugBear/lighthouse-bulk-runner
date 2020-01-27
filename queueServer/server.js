const express = require("express");
const fs = require("fs")
const program = require('commander');
const bodyParser = require('body-parser')
const createServer = require('./createLighthouseServer')
const { generateStats, getLhrPath } = require('./generateStats')
const normaliseUrl = require('./normalizeUrl')

const SERVER_COUNT = 10
const RETRY_COUNT = 3
let retry_current_count = 0;

program
  .option('--urls <urls>', 'Text file containing a list of URLs you wante to compare (separated by line breaks)')
  .option('--configs <configs>', 'JSON file containing a list of Lighthouse configs you want to compare')
  .option('--outDir <outDir>', 'Directory for Lighthouse result and statistics')
  .option('--publicUrl <publicUrl>', 'Public URL for this server - use nGrok or similar')

program.parse(process.argv)

const app = express();
app.use(bodyParser.json({ limit: '100mb', extended: true }));

let urls = fs.readFileSync(program.urls, "utf-8").split("\n").filter(url => !!url)
const configs = JSON.parse(fs.readFileSync(program.configs, "utf-8"))

let runList = []
const runCount = 5
let retriedUrls = {}
let normalizedUrls = [];
(async () => {
  for (let url of urls) {
    await normaliseUrl(url).then(newUrl =>
      normalizedUrls.push(newUrl)
    ).catch(err => { console.log(err.message) })
  }
  urls = normalizedUrls


  let skippedUrlCount = 0
  for (var runIndex = 0; runIndex < runCount; runIndex++) {
    for (const config of configs) {
      for (const url of urls) {
        let run = { url, config, runIndex }
        if (fs.existsSync(getLhrPath(run))) {
          ++skippedUrlCount
        } else {
          runList.push(run)
        }
      }
    }
  }

  console.log(`${runList.length} urls to run.\n${skippedUrlCount} urls skipped.`)

  let queueLength = runList.length

  app.get('/getUrl', (req, res) => {
    console.log('/getUrl')
    if (runList.length === 0) {
      console.log("/getUrl 404")
      res.status(404).send(JSON.stringify({ error: "No More" }))
    } else {
      current = runList.pop()
      res.send(JSON.stringify(current));
    }
  })


  let failedConfigs = {}


  app.post('/postResult', (req, res) => {
    console.log('/postResult')
    let runSettings = req.body.response

    if (req.body.result && req.body.result.lhr) {
      let lhrFilePath = getLhrPath(runSettings)
      fs.writeFileSync(lhrFilePath, JSON.stringify(req.body.result.lhr, null, 2))
    }
    else {
      if (req.body.error) {
        console.log(req.body.error)
      }

      key = runSettings.url + JSON.stringify(runSettings.config)

      if (!failedConfigs[key]) {
        failedConfigs[key] = [runSettings]
      } else {
        failedConfigs[key].unshift(runSettings)
      }
    }

    --queueLength


    console.log("remaining urls", queueLength)


    if (queueLength === 0 && retry_current_count < RETRY_COUNT) {
      for (var key of Object.keys(failedConfigs)) {
        if (failedConfigs[key].length < runCount) {
          runList = runList.concat(failedConfigs[key])
        } else {
        }
      }
      failedConfigs = {}
      queueLength = runList.length
      retry_current_count++
    }

    res.sendStatus(200)


    if (queueLength === 0) {
      console.log("generating stats...")
      generateStats(urls, configs, runCount)
      process.exit()
    }
  })


  if (runList.length === 0) {
    console.log("No urls to run - urls are only run through lighthouse if we don't already have results saved in the out dir.")
    console.log("generating stats...")
    generateStats(urls, configs, runCount)
  }
  else {
    app.listen(3000, () => console.log('Server listening on port 3000!'));
    let maxServerCount = SERVER_COUNT;
    if (maxServerCount > Math.ceil(runList.length / 3.0)) {
      maxServerCount = Math.ceil(runList.length / 3.0)
    }
    for (let i = 0; i < maxServerCount; ++i) {
      console.log("createServer")
      createServer(program.publicUrl, SERVER_COUNT)
    }
  }
})();

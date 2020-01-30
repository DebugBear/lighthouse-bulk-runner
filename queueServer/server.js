const express = require("express");
const fs = require("fs")
const program = require('commander');
const bodyParser = require('body-parser')
const createServer = require('./createLighthouseServer')
const { generateStats, getLhrPath } = require('./generateStats')
const normaliseUrl = require('./normalizeUrl')
const eachLimit = require('./eachLimit')

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
let failedConfigs = {};

(async () => {

  let normalizedUrls = [];
  await eachLimit(urls, (url) => (
    normaliseUrl(url).then(newUrl =>
      normalizedUrls.push(newUrl)
    ).catch(err => { console.log(err.message) })
  ), { limit: 25 })

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




  app.post('/postResult', (req, res) => {
    console.log('/postResult')
    let runSettings = req.body.runSettings
    let result = req.body.runResult

    let error = null
    if (result.error) {
      error = result.error
    }
    else if (result.lhr && result.lhr.runtimeError) {
      error = result.lhr.runtimeError
    }

    if (error) {
      let lhrFilePath = getLhrPath(runSettings)
      let retryCount = failedConfigs[lhrFilePath] || 0
      retryCount++
      failedConfigs[lhrFilePath] = retryCount
      console.log("error:\n", error)

      if (retryCount > RETRY_COUNT) {
        console.log("This Url Failed too many times!\n", runSettings)
        --queueLength
      } else {
        console.log(`retrying ${retryCount}\n${runSettings}`)
        runList.unshift(runSettings)
      }

    }
    else if (!result.lhr) {
      console.log("result.lhr does not exits. this is very strange. response.body:\n", result.body)
    }
    else {
      //no error
      console.log("writing Results")
      let lhrFilePath = getLhrPath(runSettings)
      fs.writeFileSync(lhrFilePath, JSON.stringify(result.lhr, null, 2))
      --queueLength
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
      await createServer(program.publicUrl, SERVER_COUNT)
    }
  }
})();

const express = require("express");
const fs = require("fs")
const program = require('commander');
const bodyParser = require('body-parser')
const createServer = require('./createLighthouseServer')
const { generateStats, getLhrPath } = require('./generateStats')
const normaliseUrl = require('./normalizeUrls')

const SERVER_COUNT = 10
const RETRY_COUNT = 3

program
  .option('--urls <urls>', 'Text file containing a list of URLs you wante to compare (separated by line breaks)')
  .option('--configs <configs>', 'JSON file containing a list of Lighthouse configs you want to compare')
  .option('--outDir <outDir>', 'Directory for Lighthouse result and statistics')
  .option('--publicUrl <publicUrl>', 'Public URL for this server - use nGrok or similar')

program.parse(process.argv)

const app = express();
app.use(bodyParser.json({ limit: '50mb', extended: true }));

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
  console.log("urls", urls)

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
    console.log("geturl")
    if (runList.length === 0) {
      console.log("getUrl 404")
      res.status(404).send(JSON.stringify({ error: "No More" }))
    } else {
      current = runList.pop()
      res.send(JSON.stringify(current));
    }
  })

  app.post('/postResult', (req, res) => {
    let runSettings = req.body.response
    let lhrFilePath = getLhrPath(runSettings)

    if (req.body.error) {
      console.log("retrying...", req.body)
      if (retriedUrls[lhrFilePath] === undefined) {
        retriedUrls[lhrFilePath] = 0
      }
      if (retriedUrls[lhrFilePath] < RETRY_COUNT) {
        retriedUrls[lhrFilePath] += 1
        runList.push(runSettings)
      } else {
        --queueLength
      }

    } else if (req.body.result && req.body.result.lhr) {
      fs.writeFileSync(lhrFilePath, JSON.stringify(req.body.result.lhr, null, 2))
      --queueLength
    }
    console.log("remaining urls", queueLength)

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
    for (let i = 0; i < SERVER_COUNT; ++i) {
      console.log("createServer")
      createServer(program.publicUrl)
    }
  }
})();

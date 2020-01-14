const express = require("express");
const hashString = require("./hashString")
const app = express();
const fs = require("fs")
const program = require('commander');
const bodyParser = require('body-parser')
const createServer = require('./createLighthouseServer')

app.use(bodyParser.json({ limit: '50mb' }));

program
  .option('--urls <urls>', 'Text file containing a list of URLs you wante to compare (separated by line breaks)')
  .option('--configs <configs>', 'JSON file containing a list of Lighthouse configs you want to compare')
  .option('--outDir <outDir>', 'Directory for Lighthouse result and statistics')
  .option('--publicUrl <publicUrl>', 'Public URL for this server - use nGrok or similar')

program.parse(process.argv)

const SERVER_COUNT = 2

function getLhrPath(run) {
  let runKey = getRunKey(run)
  return program.outDir + "/lhr/" + runKey + ".json"
}

function getRunKey(run) {
  let urlKey = run.url.replace(/https?\:\/\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9\-\.]/g, "")
  return urlKey + "_" + getConfigHash(run.config) + "_" + run.runIndex
}

function getConfigHash(config) {
  return hashString(JSON.stringify(config))
}

const urls = fs.readFileSync(program.urls, "utf-8").split("\n").filter(url => !!url)
const configs = JSON.parse(fs.readFileSync(program.configs, "utf-8"))

const runList = []
const runCount = 1

let skippedUrlCount = 0
for (var runIndex = 0; runIndex < runCount; runIndex++) {
  for (const config of configs) {
    for (const url of urls) {
      let run = { url, config, runIndex}
      if(fs.existsSync(getLhrPath(run))) {
        ++skippedUrlCount
      } else {
        runList.push(run)
      }
    }
  }
}

console.log(`${runList.length} urls to run.\n${skippedUrlCount} urls skipped.`)

app.get('/getUrl', (req, res) => {
  if (runList.length === 0) {
    console.log("getUrl 404")
    res.status(404).send(JSON.stringify({error: "No More"}))
  } else {
    current = runList.pop()
    console.log('/getUrl, remaining:', runList.length)
    res.send(JSON.stringify(current));
  }
})

app.post('/postResult', (req, res) => {
  console.log('/postResult')
  let lhrFilePath = getLhrPath(req.body.response)
  if (req.body.result && req.body.result.lhr) {
    fs.writeFileSync(lhrFilePath, JSON.stringify(req.body.result.lhr, null, 2))
  }
  res.sendStatus(200)
})

app.listen(3000, () => console.log('Server listening on port 3000!'));

if (runList.length === 0) {
  console.log("No urls to run - urls are only run through lighthouse if we don't already have results saved in the out dir.")
}
else {
  for (let i = 0; i < SERVER_COUNT; ++i) {
    createServer(program.publicUrl)
  }
}

const program = require('commander');
const fs = require("fs")
const collectRunData = require("./collectRunData")
const hashString = require("./hashString")

program
  .option('--urls <urls>', 'Text file containing a list of URLs you wante to compare (separated by line breaks)')
  .option('--configs <configs>', 'JSON file containing a list of Lighthouse configs you want to compare')
  .option('--outDir <outDir>', 'Directory for Lighthouse result and statistics')

program.parse(process.argv);

const urls = fs.readFileSync(program.urls, "utf-8").split("\n").filter(url => !!url)
const configs = JSON.parse(fs.readFileSync(program.configs, "utf-8"))

fs.mkdirSync(program.outDir, { recursive: true })
fs.mkdirSync(program.outDir + "/lhr", { recursive: true })

const runList = []
const runCount = 1

for (var runIndex = 0; runIndex < runCount; runIndex++) {
  for (const config of configs) {
    for (const url of urls) {
      runList.push({
        url,
        config,
        runIndex
      })
    }
  }
}

(async function () {
  for (const [i, run] of Object.entries(runList)) {
    console.log(`Running ${i}/${runList.length} (${run.url.slice(0, 50)})`)
    let runKey = getRunKey(run)
    let lhrFilePath = program.outDir + "/lhr/" + runKey + ".json"

    if (fs.existsSync(lhrFilePath)) {
      continue
    }

    const { lhr } = await collectRunData(run)
    fs.writeFileSync(lhrFilePath, JSON.stringify(lhr, null, 2))
  }
})()

function getRunKey(run) {
  let urlKey = run.url.replace(/https?\:\/\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9\-\.]/g, "")
  return urlKey + "_" + hashString(JSON.stringify(run.config)) + "_" + run.runIndex
}
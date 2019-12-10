const program = require('commander');
const fs = require("fs")
const collectRunData = require("./collectRunData")
const hashString = require("./hashString")
const stats = require("./stats")

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
const runCount = 3

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

    let lhrFilePath = getLhrPath(run)

    if (fs.existsSync(lhrFilePath)) {
      continue
    }
    console.log(`Running ${parseFloat(i) + 1}/${runList.length} (${run.url.slice(0, 50)})`)

    const result = await collectRunData(run)
    if (result && result.lhr) {
      fs.writeFileSync(lhrFilePath, JSON.stringify(result.lhr, null, 2))
    }
  }

  generateStats()
})()

function getLhrPath(run) {
  let runKey = getRunKey(run)
  return program.outDir + "/lhr/" + runKey + ".json"
}

function generateStats() {
  let metrics = [
    {
      name: "Performance Score",
      getValue: lhr => lhr.categories.performance.score * 100,
      stats: ["median"]
    },
    {
      name: "Page weight (kb)",
      getValue: lhr => Math.round(lhr.audits["total-byte-weight"].numericValue / 1024 * 10) / 10,
      stats: ["median"]
    }, {
      name: "TTI",
      getValue: lhr => lhr.audits["interactive"].numericValue,
      stats: ["median"]
    }
  ]


  let csv = ""
  let failedUrls = []
  for (const metric of metrics) {
    for (const stat of metric.stats) {
      csv += "\nurl,config," + metric.name + "\n"
      for (const url of urls) {
        if (failedUrls.indexOf(url) === -1) {
          for (const config of configs) {
            let csvLineItems = []
            let name = url + `,[Config ${getConfigIndexFromHash(configs, getConfigHash(config))}]`
            csvLineItems.push(name)

            let runResults = []
            let hasError = false
            for (let runIndex = 0; runIndex < runCount; runIndex++) {
              let lhrFilePath = getLhrPath({ url, config, runIndex })
              if (!fs.existsSync(lhrFilePath)) {
                hasError = true
                break
              }
              else {
                let results = JSON.parse(fs.readFileSync(lhrFilePath), "utf-8")
                if (results.runtimeError) {
                  hasError = true
                  break
                }
                else {
                  runResults.push(results)
                }
              }
            }
            if (hasError && failedUrls.indexOf(url) === -1) {
              console.error(`One or more trials for ${url} has failed. Results will not be generated for this url.`)
              failedUrls.push(url)
            }
            if (failedUrls.indexOf(url) === -1) {
              let metricValues = runResults.map(lhr => metric.getValue(lhr))
              csvLineItems.push(stats[stat](metricValues))
              csv += csvLineItems.join(",") + "\n"
            }
          }
        }
      }
    }
  }
  fs.writeFileSync(program.outDir + "/stats.csv", csv)
}

function getRunKey(run) {
  let urlKey = run.url.replace(/https?\:\/\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9\-\.]/g, "")
  return urlKey + "_" + getConfigHash(run.config) + "_" + run.runIndex
}

function getConfigHash(config) {
  return hashString(JSON.stringify(config))
}

function getConfigIndexFromHash(configs, configHash) {
  return configs.map(config => getConfigHash(config)).indexOf(configHash)
}

const program = require('commander');
const fs = require("fs")
const hashString = require("./hashString")
const stats = require("./stats")


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

function getLhrPath(run) {
  let runKey = getRunKey(run)
  return "out" + "/lhr/" + runKey + ".json"
}


const metrics = [
  {
    name: "Performance Score",
    getValue: lhr => lhr.categories.performance.score * 100,
    stats: ["median", "min", "max"]
  },
  {
    name: "Page weight (kb)",
    getValue: lhr => Math.round(lhr.audits["total-byte-weight"].numericValue / 1024 * 10) / 10,
    stats: ["median", "min", "max"]
  }, {
    name: "TTI",
    getValue: lhr => lhr.audits["interactive"].numericValue,
    stats: ["median", "min", "max"]
  }
]

function generateStats(urls, configs, runCount) {
  fs.mkdirSync("out", { recursive: true })
  fs.mkdirSync("out" + "/lhr", { recursive: true })

  let csv = ""
  let failedUrls = []
  for (const metric of metrics) {
    for (const stat of metric.stats) {

      csv += metric.name + ` (${stat})\n\n`
      csv += `\nurl, ${configs.map((c, i) => c.name ? c.name : `config[${i}]`).join(",")} \n`

      for (const url of urls) {
        let csvLineItems = []
        //let name = url + `, [Config ${ getConfigIndexFromHash(configs, getConfigHash(config))}]`
        csvLineItems.push(url)
        let hasError = false
        for (const config of configs) {
          let runResults = []
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
          let metricValues = runResults.map(lhr => metric.getValue(lhr))
          csvLineItems.push(stats[stat](metricValues))
        }
        if (!hasError) {
          csv += csvLineItems.join(",") + '\n'
        }
      }

      csv += "\n"
    }
  }
  fs.writeFileSync("out" + "/stats.csv", csv)
}

module.exports = { generateStats, getLhrPath }

const program = require('commander');
const fs = require("fs")
const hashString = require("./hashString")
const stats = require("./stats")

//const urls = fs.readFileSync(program.urls, "utf-8").split("\n").filter(url => !!url)
//const configs = JSON.parse(fs.readFileSync(program.configs, "utf-8"))

function getLhrPath(run) {
  let runKey = getRunKey(run)
  return "out" + "/lhr/" + runKey + ".json"
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

const metrics = [
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


module.exports = function generateStats(urls, configs, runCount) {
  fs.mkdirSync("out", { recursive: true })
  fs.mkdirSync("out" + "/lhr", { recursive: true })

  let csv = ""
  let failedUrls = []
  for (const metric of metrics) {
    for (const stat of metric.stats) {
      csv += "\nurl,config," + metric.name + "\n"
      for (const url of urls) {
        if (failedUrls.indexOf(url) !== -1) {
          continue
	}
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
            console.error(`One or more trials for ${url} has failed. Results will not be generated for all trials of this url.`)
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
  fs.writeFileSync("out" + "/stats.csv", csv)
}

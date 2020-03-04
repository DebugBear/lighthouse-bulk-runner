
const header = document.querySelector("#header")

const container = document.querySelector("#myDiv")

let url = "http://www.google.com"
let metric = "Page weight (kb)"

let urls = _.uniq(data.map(d => d.url))
let metrics = _.uniq(data.map(d => d.metric))

const select = document.createElement("select")
header.appendChild(select)

urls.sort()
urls.forEach(url => {
  let option = document.createElement("option")
  option.value = url
  option.innerText = url.replace(/https?\:\/\//, "")
  select.append(option)
})


select.addEventListener("change", (e) => {
  container.innerHTML = ""
  metrics.forEach(metric => {
    const h2 = document.createElement("h2")
    h2.innerText = metric
    container.appendChild(h2)

    render(e.target.value, metric)

  })

})



function render(url, metric) {
  let urlData = data.filter(d => d.url === url)

  let id = "chart-" + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  let el = document.createElement("div")
  el.id = id
  container.appendChild(el)

  const configNames = _.uniq(data.map(d => d.configName))
  let plotData = []
  for (const configName of configNames) {
    let configData = urlData.find(d => d.metric === metric && d.configName === configName)
    plotData.push({
      y: configData.values,
      type: "box",
      name: configName,
    })
  }

  const layout = {
    title: `${url} - ${metric}`,
    yaxis: { rangemode: "tozero" },
  };



  Plotly.newPlot(id, plotData, layout);
}



const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

module.exports = async function ({ url, config }) {
  return chromeLauncher.launch({ chromeFlags: ['--no-sandbox', '--headless'] }).then(chrome => {
    return lighthouse(url, { port: chrome.port }, config)
      .catch(error => ({ error }))
      .finally(() => chrome.kill())
  })
}

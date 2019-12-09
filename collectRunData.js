const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

module.exports = async function ({ url, config }) {
  return chromeLauncher.launch({}).then(chrome => {
    return lighthouse(url, { port: chrome.port }, config).then(results => {
      return chrome.kill().then(() => results)
    });
  }).catch(e => console.error(url, e))
}

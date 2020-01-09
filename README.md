# lighthouse-bulk-runner

Compare the performance of different websites and Chrome extensions

compare headers/throttling methods/chrome versions//...

allows you to run performance analyses and comparisons

## example
after setting up Google Cloud container,
cd queueServer
node server.js --urls=testing/urls.txt --configs=testing/configs.json --outDir=out --publicUrl=https://12345.ngrok.io

## viewing individual results

copy Lighthouse result (lhr) json and paste it here https://googlechrome.github.io/lighthouse/viewer/

---

in future might be nice to be able to use the psi api, have some way to split the workload, ...

const { GoogleAuth } = require("google-auth-library");

module.exports = async function (clientUrl) {

  const auth = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform"
  });
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();
  const zone = "us-central1-a"

  async function countVMs() {
    const url = `https://www.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances`;

    return client
      .request({
        url: url,
        method: "get"
      })
      .then(function (res) {
        const { data, status } = res
        return data.items || [];
      });
  }

  let currentCount = (await countVMs()).length

  console.log({ currentCount })

  const sourceInstanceTemplate = `projects/${projectId}/global/instanceTemplates/dbr-deletable-1`;
  const url = `https://www.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances?sourceInstanceTemplate=${sourceInstanceTemplate}`;
  let vmName = "vm-" + Math.round(Math.random() * 1000000)

  return await client
    .request({
      url: url,
      method: "post",
      data: {
        name: vmName,
        // Use description rather than metadata because the GCE container setup uses a
        // gce-container-declaration metadata item that would be overridden
        // (we can't modify the gce-container-declaration meta property and pass this stuff in as env vars
        // because "This container declaration format is not public API and may change without notice.")
        description: JSON.stringify({
          queueServerUrl: clientUrl
        })
      }
    })
    .then(function (res) {
      const { data, status } = res;
      console.log(status)
      console.log("launched VM:", vmName)
      return { response: data, status };
    });
}

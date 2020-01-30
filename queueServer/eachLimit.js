module.exports = function eachLimit(list, itemCallback, { limit = 5}) {
    if (!limit || limit < 1) {
        throw Error("Max concurrent execution limit must be set and greater than 0")
    }
    return new Promise((resolve, reject) => {
        let operationsInProgess = 0
        let operationsStarted = 0
        startMoreOperations()

        function startMoreOperations() {
            while (operationsInProgess < limit) {
                let item = list[operationsStarted]
                if (!item && operationsInProgess === 0) {
                    resolve()
                }
                if (!item) {
                    return
                }
                operationsStarted++
                operationsInProgess++
                itemCallback(item, operationsStarted - 1).then(() => {
                    operationsInProgess--;
                    startMoreOperations()
                }).catch(err => {
                    reject(err)
                })
            }
        }
    })
}
const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

exports.handler = async function (event, context) {

    event.Records.forEach((record) => {
        console.log(record)
        const body = JSON.parse(record.body)
        console.log(body)
    })

    return {}

}
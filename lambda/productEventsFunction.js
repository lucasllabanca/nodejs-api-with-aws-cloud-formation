const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

//variaveis de ambiente - a tbm foi passada pela productsFunction-stack
const eventsDdb = process.env.EVENTS_DDB
const awsRegion = process.env.awsRegion

AWS.config.update({
    region: awsRegion
})

//preciso criar um cliente do DynamoDB
const ddbClient = new AWS.DynamoDB.DocumentClient()

//event: aqui tah um evento e aqui as informacoes de quem a triggou
//context: informacoes de onde tah executando, info contextuais
exports.handler = async function (event, context) {

    //Exceccao de proposito pra testar a DLQ
    //throw 'Non valid event type'

    console.log(event)

    //pelo menos a ultima operacao assincrona que faço preciso aguardar, pra retornar pra quem chamou
    await createEvent(event.productEvent)

    context.succeed(
        JSON.stringify({
            productEventCreated: true,
            message: "OK"
        })
    )
}

function createEvent(productEvent) {
    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 5 * 60) //tem que ser em segundos, por isso / 1000 + 5 minutos - ~~faz arredondamento
    const params = {
        TableName: eventsDdb,
        Item: {
            pk: `#product_${productEvent.productCode}`, //#product_COD4
            sk: `${productEvent.eventType}#${timestamp}`, //PRODUCT_UPDATED#12345
            ttl: ttl, //Pego o timestamp e adiciono o tempo que quero que fique no Dynamo
            email: productEvent.email,
            createdAt: timestamp,
            requestId: productEvent.requestId,
            eventType: productEvent.eventType,
            info: {
                productId: productEvent.productId,
                price: productEvent.productPrice
            }
        }
    }
    return ddbClient.put(params).promise()

}
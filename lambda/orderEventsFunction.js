const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

const awsRegion = process.env.awsRegion
const eventsDdb = process.env.EVENTS_DDB

AWS.config.update({
    region: awsRegion
})

//preciso criar um cliente do DynamoDB
const ddbClient = new AWS.DynamoDB.DocumentClient()

//Tem que estar apto a receber uma fila de eventos, quando inscreve um labda num topico
exports.handler = async function (event, context) {
   
    const promises = []

    //Pra cada evento que recebi
    //a exec de forEach pode ser aleatoria, paralela pois é assincrona, nao sabemos como será feito pelo js
    event.Records.forEach((record) => {

        promises.push(createEvent(record.Sns))

    })

    //aguardar todos os eventos de promise da lista pra retornar
    await Promise.all(promises)

    return 

}

function createEvent(body) {

    const envelope = JSON.parse(body.Message)
    const event = JSON.parse(envelope.data)

    console.log(`Creating order event - MessageId: ${body.MessageId}`) //Mesmo MessageId de quando publiquei o evento

    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 5 * 60) //timestamp em s + 5 Minutos
    const params = {
        TableName: eventsDdb,
        Item: {
            pk: `#order_${event.orderId}`, //igual foi restringido pela Policy
            sk: `${envelope.eventType}#${timestamp}`,
            ttl: ttl,
            email: event.email,
            createdAt: timestamp,
            requestId: event.requestId,
            eventType: envelope.eventType,
            info: {
                orderId: event.orderId,
                productCodes: event.productCodes,
                messageId: body.MessageId
            }
        }
    }

    return ddbClient.put(params).promise()

}
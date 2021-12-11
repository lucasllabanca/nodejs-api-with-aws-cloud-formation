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

exports.handler = async function (event, context) {
    const method = event.httpMethod;
    console.log(event);

    //id da requisicao do api gateway
    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId; //id dentro da minha infra

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`);

    //GET /orders/events?email=lucasllabanca@teste.com&eventType=ORDER_CREATED
    if (event.resource === '/orders/events') { //nao precisaria desse teste, o api gateway ja vai tah configurado pra barrar outras

        const email = event.queryStringParameters.email
        const eventType = event.queryStringParameters.eventType

        if (method === 'GET') { //nao precisaria tbm, configurado no gateway
            if (email && eventType) {

                const data = await getOrderEventsByEmailAndEventType(email, eventType)

                return {
                    statusCode: 200,
                    body: JSON.stringify(convertOrderEvents(data.Items))
                }

            } else if (email) {

                const data = await getOrderEventsByEmail(email)

                return {
                    statusCode: 200,
                    body: JSON.stringify(convertOrderEvents(data.Items))
                }

            }
        }

    }

    return {
        statusCode: 404,
        body: JSON.stringify('Bad request')
    }

}

function convertOrderEvents(items) {

    return items.map((item) => {
        return {
            email: item.email,
            createdAt: item.createdAt,
            eventType: item.eventType,
            requestId: item.requestId,
            orderId: item.info.orderId,
            productCodes: item.info.productCodes
        }
    })

}

function getOrderEventsByEmail(email) {

    return ddbClient.query({
        TableName: eventsDdb,
        IndexName: "emailIdx",
        KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
            ':email': email,
            ':prefix': 'ORDER_'
        }
    }).promise()

}

function getOrderEventsByEmailAndEventType(email, eventType) {

    return ddbClient.query({
        TableName: eventsDdb,
        IndexName: "emailIdx",
        KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
            ':email': email,
            ':prefix': eventType
        }
    }).promise()

}
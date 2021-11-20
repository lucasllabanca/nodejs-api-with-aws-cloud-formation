const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")
const uuid = require("uuid")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

//variaveis de ambiente - a tbm foi passada pela productsFunction-stack
const productsDdb = process.env.PRODUCTS_DDB
const ordersDdb = process.env.ORDER_DDB
const awsRegion = process.env.awsRegion

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
  
    if (event.resource === '/orders') {

        if (method === 'GET') {

            if (event.queryStringParameters) {

                if (event.queryStringParameters.email) {
                    if (event.queryStringParameters.orderId) {
                        //GET /orders?email=lucasllabanca@gmail.com&orderId=123-456
                        console.log('Get a user order by orderId')

                        return {
                            statusCode: 200,
                            body: JSON.stringify('Get a user order by orderId')
                        }

                    } else {
                        //GET /orders?email=lucasllabanca@gmail.com
                        console.log('Get all orders from a user')

                        return {
                            statusCode: 200,
                            body: JSON.stringify('Get all orders from a user')
                        }

                    }
                }

            } else {

                //GET /orders
                console.log('Get all orders')

                return {
                    statusCode: 200,
                    body: JSON.stringify('Get all orders')
                }

            }

        } else if (method === 'POST') {
        //POST /orders
            console.log('Create an order')

            return {
                statusCode: 200,
                body: JSON.stringify('Create an order')
            }

        } else if (method === 'DELETE') {
            //DELETE /orders?email=lucasllabanca@gmail.com&orderId=123-456
            console.log('Delete an order')

            return {
                statusCode: 200,
                body: JSON.stringify('Delete an order')
            }

        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify('Bad request')
    }
}
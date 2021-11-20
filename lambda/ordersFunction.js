const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")
const uuid = require("uuid")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

//variaveis de ambiente - a tbm foi passada pela productsFunction-stack
const productsDdb = process.env.PRODUCTS_DDB
const ordersDdb = process.env.ORDERS_DDB
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

                        const data = await getOrder(event.queryStringParameters.email, event.queryStringParameters.orderId)

                        if (data.Item) {
                            return {
                                statusCode: 200,
                                body: JSON.stringify(convertToOrderResponse(data.Item))
                            }
                        } else {
                            return {
                                statusCode: 404,
                                body: JSON.stringify('Order not found')
                            }
                        }             

                    } else {
                        //GET /orders?email=lucasllabanca@gmail.com
                        console.log('Get all orders from a user')

                        const data = await getOrdersByEmail(event.queryStringParameters.email)

                        return {
                            statusCode: 200,
                            body: JSON.stringify(data.Items.map(convertToOrderResponse))
                        }

                    }
                }

            } else {

                //GET /orders
                console.log('Get all orders')

                const data = await getAllOrders()
                
                return {
                    statusCode: 200,
                    body: JSON.stringify(data.Items.map(convertToOrderResponse))
                }

            }

        } else if (method === 'POST') {
        //POST /orders
            console.log('Create an order')

            const orderRequest = JSON.parse(event.body)

            const result = await fetchProducts(orderRequest)

            //comparando qtd de produtos que achou no banco com o que veio da interface
            if (result.Responses.products.length == orderRequest.productIds.length) {

                //TODO - there is no reason to do this
                const products = []
                result.Responses.products.forEach((product) => {
                    products.push(product)
                })

                const orderCreated = await createOrder(orderRequest, products)

                return {
                    statusCode: 201,
                    body: JSON.stringify(convertToOrderResponse(orderCreated))
                }

            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify('Some product was not found')
                }
            }

        } else if (method === 'DELETE') {
            //DELETE /orders?email=lucasllabanca@gmail.com&orderId=123-456
            console.log('Delete an order')

            //nao vai validar os QueryStrings pq vai fazer isso no api gateway pra torna-los obrigatorios, senao nem chama
            const data = await deleteOrder(event.queryStringParameters.email, event.queryStringParameters.orderId)

            if (data.Attributes) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(convertToOrderResponse(data.Attributes))
                }
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify('Order not found')
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify('Bad request')
    }
}

function deleteOrder(email, orderId) {

    const params = {
        TableName: ordersDdb,
        Key: {
            pk: email,
            sk: orderId
        },
        ReturnValues: "ALL_OLD"
    }

    return ddbClient.delete(params).promise()
}

function getOrder(email, orderId) {

    const params = {
        TableName: ordersDdb,
        Key: {
            pk: email,
            sk: orderId
        }     
    }

    return ddbClient.get(params).promise()

}

function getOrdersByEmail(email) {

    const params = {
        TableName: ordersDdb,
        KeyConditionExpression: "pk = :email",
        ExpressionAttributeValues: {
            ":email": email
        }
    }

    return ddbClient.query(params).promise()

}

function getAllOrders() {

    const params = {
        TableName: ordersDdb
    }

    return ddbClient.scan(params).promise()

}

function fetchProducts(orderRequest) {
    const keys = []

    orderRequest.productIds.forEach((productId) => {
        keys.push(
            {
                id: productId
            }
        )
    })

    const params = {
        RequestItems: {
            [productsDdb]: {
                Keys: keys
            }
        }
    }

    return ddbClient.batchGet(params).promise()

}

async function createOrder(orderRequest, products) {

    const timestamp = Date.now()
    const orderProducts = []
    let totalPrice = 0

    //no AWS armazenamento é mais barato que requisicoes, entao replicou code e price na tabela orders pra consultas
    products.forEach((product) => {
        totalPrice += product.price
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const orderItem = {
        pk: orderRequest.email,
        sk: uuid.v4(),
        createdAt: timestamp,
        billing: {
            payment: orderRequest.payment,
            totalPrice: totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }

    const params = {
        TableName: ordersDdb,
        Item: orderItem
    }

    await ddbClient.put(params).promise()

    return orderItem

}

function convertToOrderResponse(order) {
    return {
        email: order.pk,
        id: order.sk,
        createdAt: order.createdAt,
        products: order.products,
        billing: {
            payment: order.billing.payment,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type,
            carrier: order.shipping.carrier
        }
    }
}
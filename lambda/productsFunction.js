const AWS = require("aws-sdk");
const AWSXray = require("aws-xray-sdk-core")
const uuid = require("uuid")

const xRay = AWSXray.captureAWS(require("aws-sdk"))

//variaveis de ambiente - a tbm foi passada pela productsFunction-stack
const productsDdb = process.env.PRODUCTS_DDB
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME
const awsRegion = process.env.awsRegion

AWS.config.update({
    region: awsRegion
})

//preciso criar um cliente do DynamoDB
const ddbClient = new AWS.DynamoDB.DocumentClient()
const lambdaClient = new AWS.Lambda()

//tudo que colocou acima do handler vai ser executado no cold start do api gateway

//event: aqui tah um evento e aqui as informacoes de quem a triggou
//context: informacoes de onde tah executando, info contextuais
exports.handler = async function (event, context) {
    const method = event.httpMethod;
    console.log(event);

    //id da requisicao do api gateway
    const apiRequestId = event.requestContext.requestId;
    const lambdaRequestId = context.awsRequestId; //id dentro da minha infra

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`);

    if (event.resource === "/products") {
        if (method === "GET") {

            //GET /products
            console.log("GET /products")

            const data = await getAllProducts()

            return {
                statusCode: 200,
                headers: {},
                body: JSON.stringify(data.Items),
            };

        } else if (method === "POST") {
            // POST /products
            console.log("POST /products");

            const product = JSON.parse(event.body)
            product.id = uuid.v4()

            await createProduct(product)
            //por enquanto está de forma sincrona, entao posso aguardar e atribuir pra const
            const result = await createProductEvent(product, "PRODUCT_CREATED", "lucasllabanca@hotmail.com", lambdaRequestId)

            console.log(result)

            return {
                statusCode: 201,
                body: JSON.stringify(product)
            }

        }

    } else if (event.resource === '/products/{id}') {

        const productId = event.pathParameters.id

        if (method === 'GET') {
            //GET /products/{id}
            console.log("GET /products/{id}");

            const data = await getProductById(productId)

            if (data.Item) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(data.Item)
                }
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product not found with ID: ${productId}`)
                }
            }

        } else if (method === 'PUT') {
            //PUT /products/{id}
            console.log("PUT /products/{id}");

            const data = await getProductById(productId)

            if (data.Item) {

                const product = JSON.parse(event.body)

                await updateProduct(productId, product)
                
                const result = await createProductEvent(product, "PRODUCT_UPDATED", "lucasllabanca@gmail.com", lambdaRequestId)

                console.log(result)

                return {
                    statusCode: 200,
                    body: JSON.stringify(data.Item)
                }

            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product not found with ID: ${productId}`)
                }
            }

        } else if (method === 'DELETE') {
            //DELETE /products/{id}
            console.log("DELETE /products/{id}");

            //const data = await getProductById(productId) - nao vai buscar, vai pegar via params ReturnValues: "ALL_OLD"

            //if (data.Item) {

            //retirou o await e atribuiu pra const e disparou as duas abaixo - mudou de novo
            //voltou o await pra fazer o esquema do ALL_OLD

            const deleteResult = await deleteProduct(productId) 
                
            if (deleteResult.Attributes) {

                await createProductEvent(deleteResult.Attributes, "PRODUCT_DELETED", "teste@gmail.com", lambdaRequestId) //data.Item        

                return {
                    statusCode: 200,
                    body: JSON.stringify(deleteResult.Attributes) //data.Item
                }

                /* const deletePromiseResult = deleteProduct(productId) //retirou o await e atribuiu pra const e disparou as duas abaixo
                
                const eventPromise = createProductEvent(data.Item, "PRODUCT_DELETED", "teste@gmail.com", lambdaRequestId)

                const results = await Promise.all([deletePromise, eventPromise])

                console.log(results[1]) //o indice define a ordem do result que quero na ordem */

            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify(`Product not found with ID: ${productId}`)
                }
            }
        }
    }

    return {
        statusCode: 400,
        headers: {},
        body: JSON.stringify({
            message: "Bad request",
            ApiGwRequestId: apiRequestId,
            LambdaRequestId: lambdaRequestId,
        }),
    };
};

function createProductEvent(product, event, email, lambdaRequestId) {

    const params = {
        FunctionName: productEventsFunctionName,
        InvocationType: "Event", //RequestResponse - chamada sincrona
        Payload: JSON.stringify({
            productEvent: {
                requestId: lambdaRequestId,
                eventType: event,
                productId: product.id,
                productCode: product.code,
                productPrice: product.price,
                email: email
            }
        })
    }

    return lambdaClient.invoke(params).promise()

}

function getAllProducts() {
    
    const params = {
        TableName: productsDdb //const tbl name do env lá em cima
    }

    return ddbClient.scan(params).promise()
}

function getProductById(productId) { //productId já pegou: event.pathParameters.id
    
    const params = {
        TableName: productsDdb,
        Key: {
            id: productId
        }
    }
   
    return ddbClient.get(params).promise()
}

function createProduct(product) {
    
    const params = {
        TableName: productsDdb,
        Item: {
            id: product.id,
            model: product.model,
            code: product.code,
            price: product.price,
            productName: product.productName,
            productUrl: product.productUrl     
        }
    }
   
    return ddbClient.put(params).promise()
}

function updateProduct(productId, product) {

    const params = {
        TableName: productsDdb,
        Key: {
            id: productId
        },
        UpdateExpression: "set productName = :n, code = :c, price = :p, model = :m, productUrl = :u",
        ExpressionAttributeValues: {
            ":n": product.productName,
            ":c": product.code,
            ":p": product.price,
            ":m": product.model,
            ":u": product.productUrl,
        }         
    }

    return ddbClient.update(params).promise()

}

function deleteProduct(productId) {

    const params = {
        TableName: productsDdb,
        Key: {
            id: productId
        },
        ReturnValues: "ALL_OLD"
    }

    return ddbClient.delete(params).promise()

}
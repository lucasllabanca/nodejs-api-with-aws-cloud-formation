import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";

//interface pra conseguir passar varios stack handlers ao mesmo tempo,e nao ficar com 30 parametros
interface EcommerceApiStackProps extends cdk.StackProps {
    productsHandler: lambdaNodeJS.NodejsFunction,
    ordersHandler: lambdaNodeJS.NodejsFunction,
    orderEventsFetchHandler: lambdaNodeJS.NodejsFunction
}

export class EcommerceApiStack extends cdk.Stack {
    public readonly urlOutput: cdk.CfnOutput;

    constructor(scope: cdk.Construct, id: string, props: EcommerceApiStackProps) {

        super(scope, id, props);

        const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs");

        const api = new apigateway.RestApi(this, "ECommerceApi", {
            restApiName: "ECommerceApi",
            description: "This is the ECommerce API service",
            deployOptions: {
                methodOptions: {
                    '/*/*': { //todos os resources, dá pra especificar um ou mais
                        throttlingBurstLimit: 4, //num requisicoes simultaneas
                        throttlingRateLimit: 2 //requisicoes por segundo
                    }
                },
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true,
                }),
            },
        });

        const productsFunctionIntegration = new apigateway.LambdaIntegration(props.productsHandler);

        const productRequestValidator = new apigateway.RequestValidator(this, "ProductRequestValidator", {
            restApi: api,
            requestValidatorName: "Product request validator",
            validateRequestBody: true
        })

        const productModel = new apigateway.Model(this, "ProductModel", {
            modelName: "ProductModel",
            restApi: api,
            contentType: "application/json",
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    productName: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    code: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    price: {
                        type: apigateway.JsonSchemaType.NUMBER
                    },
                    model: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productUrl: {
                        type: apigateway.JsonSchemaType.STRING
                    }                  
                },
                required: [
                    "productName",
                    "code"
                ]
            }
        })

        // /products
        const productsResource = api.root.addResource("products"); //da pra passar default integration

        //GET /products
        productsResource.addMethod("GET", productsFunctionIntegration);

        //POST /products
        productsResource.addMethod("POST", productsFunctionIntegration, {
            requestValidator: productRequestValidator,
            requestModels: {"application/json": productModel}
        })

        /*const key = api.addApiKey("ApiKey")

        const plan = api.addUsagePlan("UsagePlan", {
            name: "Basic",
            throttle: {
                rateLimit: 4, //requisicoes por segundo
                burstLimit: 2 //requisicoes simultaneas
            },
            quota: {
                limit: 5, //num de requisicoes em um periodo
                period: apigateway.Period.DAY
            }
        })

        plan.addApiKey(key)

        plan.addApiStage({
            stage: api.deploymentStage,
            throttle: [
                {
                    method: postOrder, //declarar const pra receber o productsResource POST
                    throttle: {
                        rateLimit: 4, //requisicoes por segundo
                        burstLimit: 2 //requisicoes simultaneas
                    }
                }
            ]
        })*/

        // /products/{id}
        const productByIdResource = productsResource.addResource("{id}")

        //GET /products/{id}
        productByIdResource.addMethod("GET", productsFunctionIntegration)

        //PUT /products/{id}
        productByIdResource.addMethod("PUT", productsFunctionIntegration, {
            requestValidator: productRequestValidator,
            requestModels: {"application/json": productModel}
        })

        //DELETE /products/{id}
        productByIdResource.addMethod("DELETE", productsFunctionIntegration)

        const ordersFunctionIntegration = new apigateway.LambdaIntegration(props.ordersHandler)
        // resource - /orders   
        const ordersResource = api.root.addResource("orders")

        //GET /orders
        //GET /orders?email=lucasllabanca@gmail.com
        //GET /orders?email=lucasllabanca@gmail.com&orderId=123-456
        ordersResource.addMethod("GET", ordersFunctionIntegration)

        //DELETE /orders?email=lucasllabanca@gmail.com&orderId=123-456
        ordersResource.addMethod("DELETE", ordersFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true, //tornando os parametros obrigatorios
                'method.request.querystring.orderId': true
            },
            requestValidatorOptions: {
                requestValidatorName: 'Email and OrderId parameters validator',
                validateRequestParameters: true
            }
        })

        const ordersRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator", {
            restApi: api,
            requestValidatorName: "Order request validator",
            validateRequestBody: true
        })

        const orderModel = new apigateway.Model(this, "OrderModel", {
            modelName: "OrderModel",
            restApi: api,
            contentType: "application/json",
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productIds: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
                    }
                },
                required: [
                    "email",
                    "productIds",
                    "payment"
                ]
            }
        })

        //POST /orders
        ordersResource.addMethod("POST", ordersFunctionIntegration, {
            requestValidator: ordersRequestValidator,
            requestModels: {"application/json": orderModel}
        })

        this.urlOutput = new cdk.CfnOutput(this, "url", {
            exportName: "url",
            value: api.url,
        });

        //GET /orders/events
        const orderEventsResource = ordersResource.addResource("events")
        const orderEventsFunctionIntegration = new apigateway.LambdaIntegration(props.orderEventsFetchHandler)

        //GET /orders/events?email=lucasllabanca@gmail.com&eventType=ORDER_CREATED
        //GET /orders/events?email=lucasllabanca@gmail.com

        const orderEventsValidator = new apigateway.RequestValidator(this, "OrderEventsValidator", {
            restApi: api,
            requestValidatorName: "Order events fetch parameters",
            validateRequestParameters: true
        })

        orderEventsResource.addMethod("GET", orderEventsFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true //tornando os parametros obrigatorios
            },
            requestValidator: orderEventsValidator
        })

    }
}
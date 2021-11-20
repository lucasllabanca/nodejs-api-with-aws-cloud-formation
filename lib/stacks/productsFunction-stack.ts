import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb"

interface ProductsFunctionStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventsDdb: dynamodb.Table
}

export class ProductsFunctionStack extends cdk.Stack {
    readonly productsHandler: lambdaNodeJS.NodejsFunction //aqui precisava expor pro api gateway

    constructor(scope: cdk.Construct, id: string, props: ProductsFunctionStackProps) {
        super(scope, id, props);

        //aqui criou como constante pq essa stack que precisa reconhecer essa nova funcao e no o gateway
        const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, "ProductEventsFunction", {
            functionName: "ProductEventsFunction",
            entry: "lambda/productEventsFunction.js", //codigo que vai ser executado
            handler: "handler", //nome do metodo que vai ser invocado no arquivo
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            tracing: lambda.Tracing.ACTIVE, //habilita a funcao lambda pra gerar servicos do x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName //variavel de ambiente com nome da tbl pra usar na funcao de integracao
            },
            bundling: {
                minify: false,
                sourceMap: false,
            }
        });

        props.eventsDdb.grantWriteData(productEventsHandler)

        this.productsHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsFunction", {
            functionName: "ProductsFunction",
            entry: "lambda/productsFunction.js", //codigo que vai ser executado
            handler: "handler", //nome do metodo que vai ser invocado no arquivo
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            tracing: lambda.Tracing.ACTIVE, //habilita a funcao lambda pra gerar servicos do x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName, //variavel de ambiente com nome da tbl pra usar na funcao de integracao
                PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
            },
            bundling: {
                minify: false,
                sourceMap: false,
            }
        });

        props.productsDdb.grantReadWriteData(this.productsHandler)
        productEventsHandler.grantInvoke(this.productsHandler)

    }
}
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb"

interface OrdersApplicationStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table
}

export class OrdersApplicationStack extends cdk.Stack {
    readonly ordersHandler: lambdaNodeJS.NodejsFunction //aqui precisava expor pro api gateway 
    
    constructor(scope: cdk.Construct, id: string, props: OrdersApplicationStackProps) {
        super(scope, id, props);

        const ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",           
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: { //com isso temos uma chave composta
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY, //RETAIN mantem o banco mesmo apagando a stack
            billingMode: dynamodb.BillingMode.PROVISIONED, //capacidade provisionada fixa
            readCapacity: 1,
            writeCapacity: 1,
        })

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, "OrdersFunction", {
            functionName: "OrdersFunction",
            entry: "lambda/ordersFunction.js", //codigo que vai ser executado
            handler: "handler", //nome do metodo que vai ser invocado no arquivo
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            tracing: lambda.Tracing.ACTIVE, //habilita a funcao lambda pra gerar servicos do x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName, //variavel de ambiente com nome da tbl pra usar na funcao de integracao
                ORDERS_DDB: ordersDdb.tableName
            },
            bundling: {
                minify: false,
                sourceMap: false,
            }
        });

    }

}
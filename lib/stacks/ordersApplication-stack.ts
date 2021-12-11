import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb"
import * as sns from "@aws-cdk/aws-sns"
import * as subs from "@aws-cdk/aws-sns-subscriptions"
import * as iam from "@aws-cdk/aws-iam"
import * as sqs from "@aws-cdk/aws-sqs"
import * as lambdaEventSource from "@aws-cdk/aws-lambda-event-sources"

interface OrdersApplicationStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventsDdb: dynamodb.Table
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
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, //capacidade provisionada fixa //PROVISIONED
            /*
            readCapacity: 1,
            writeCapacity: 1,*/
        })
        

        /*Comentou abaixo pq passou pra modo on demand
        //Criando uma configuracao de Auto Scaling pra leitura
        const readScale = ordersDdb.autoScaleReadCapacity({
            maxCapacity: 4,
            minCapacity: 1
        })

        readScale.scaleOnUtilization({
            targetUtilizationPercent: 50, //quando chegar em 50% do provisionado escala
            scaleInCooldown: cdk.Duration.seconds(60), //tempo de espera até escalar de novo se necessario
            scaleOutCooldown: cdk.Duration.seconds(60), //tempo pra esperar a cada diminuicao do escalonamento
        })

        //Criando uma configuracao de Auto Scaling pra escrita
        const writeScale = ordersDdb.autoScaleWriteCapacity({
            maxCapacity: 4,
            minCapacity: 1
        })

        writeScale.scaleOnUtilization({
            targetUtilizationPercent: 50, //quando chegar em 50% do provisionado escala
            scaleInCooldown: cdk.Duration.seconds(60), //tempo de espera até escalar de novo se necessario
            scaleOutCooldown: cdk.Duration.seconds(60), //tempo pra esperar a cada diminuicao do escalonamento
        })*/

        const ordersTopic = new sns.Topic(this, "OrderEventsTopic", {
            topicName: "order-events",
            displayName: "Order events topic"
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
                ORDERS_DDB: ordersDdb.tableName,
                ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn
            },
            bundling: {
                minify: false,
                sourceMap: false,
            }
        })

        ordersDdb.grantReadWriteData(this.ordersHandler)
        props.productsDdb.grantReadData(this.ordersHandler)
        ordersTopic.grantPublish(this.ordersHandler)

        const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEventsFunction", {
            functionName: "OrderEventsFunction",
            entry: "lambda/orderEventsFunction.js", //codigo que vai ser executado
            handler: "handler", //nome do metodo que vai ser invocado no arquivo
            memorySize: 128,
            timeout: cdk.Duration.seconds(30), //Prof mudou pra 10 pra fazer um teste de um problema com multiplas chamadas
            tracing: lambda.Tracing.ACTIVE, //habilita a funcao lambda pra gerar servicos do x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
            bundling: {
                minify: false,
                sourceMap: false,
            }
        })

        const eventsDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            //pk: "#order_*"
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#order_*']
                }
            }
        })

        //Props pra filtrar as msgs que eu recebo e foram passadas por MessageAttributes na ordersFunction.js
        //Tem que ser tipo stringFilter pq defini como DataType: "String"
        orderEventsHandler.addToRolePolicy(eventsDdbPolicy)
        ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        }))

        //Criou a DLQ pra ser usada na SQS, a cada 3 tentativas de tratar e der excecao, manda pra DLQ
        const orderEventsDlq = new sqs.Queue(this, "OrderEventsDlq", {
            queueName: "order-events-dlq",
            retentionPeriod: cdk.Duration.days(10)     
        })

        //Criou a fila SQS
        const orderEventsQueue = new sqs.Queue(this, "OrderEventsQueue", {
            queueName: "order-events",
            deadLetterQueue: {
                queue: orderEventsDlq,
                maxReceiveCount: 3
            }
        })

        //Inscreveu ela no Topic e filtrou somente pra ORDER_CREATED eventType
        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        }))

        const orderEmailsHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEmailsFunction", {
            functionName: "OrderEmailsFunction",
            entry: "lambda/orderEmailsFunction.js",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(30),
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
            bundling: {
                minify: false,
                sourceMap: false,
            }
        });

        //A cada 1min vai buscar no maximo 5 msgs do topico sns e traz pro sqs
        orderEmailsHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventsQueue, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.minutes(1)    
        }))

        orderEventsQueue.grantConsumeMessages(orderEmailsHandler)

    }

}
import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { RemovalPolicy } from "@aws-cdk/core";

export class EventsDdbStack extends cdk.Stack {
    readonly table: dynamodb.Table;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.table = new dynamodb.Table(this, "EventsDdb", {
            tableName: "events",           
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: { //com isso tempo uma chave composta
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            timeToLiveAttribute: "ttl", //tempo em que o item vai ficar registrado no banco. ex: apagar em 30 dias
            removalPolicy: RemovalPolicy.DESTROY, //RETAIN mantem o banco mesmo apagando a stack
            billingMode: dynamodb.BillingMode.PROVISIONED, //capacidade provisionada fixa
            readCapacity: 1,
            writeCapacity: 1,
        });
    
        //Indice Global - GSI - Global Secondary Index
        //o DynamoDB vai criar a tabela projetada com as definicoes abaixo
        this.table.addGlobalSecondaryIndex({
            indexName: "emailIdx",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            projectionType: dynamodb.ProjectionType.ALL
        })

    }
}
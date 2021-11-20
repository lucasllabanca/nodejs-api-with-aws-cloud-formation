import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { RemovalPolicy } from "@aws-cdk/core";

export class ProductsDdbStack extends cdk.Stack {
    readonly table: dynamodb.Table;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.table = new dynamodb.Table(this, "ProductsDdb", {
            tableName: "products",           
            partitionKey: {
                name: "id",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: RemovalPolicy.DESTROY, //RETAIN mantem o banco mesmo apagando a stack
            billingMode: dynamodb.BillingMode.PROVISIONED, //capacidade provisionada fixa
            readCapacity: 1,
            writeCapacity: 1,
        });
    }
}
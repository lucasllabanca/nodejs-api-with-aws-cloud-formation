import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";

//interface pra conseguir passar varios stack handlers ao mesmo tempo,e nao ficar com 30 parametros
interface EcommerceApiStackProps extends cdk.StackProps {
    productsHandler: lambdaNodeJS.NodejsFunction
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

        // /products
        const productsResource = api.root.addResource("products"); //da pra passar default integration

        //GET /products
        productsResource.addMethod("GET", productsFunctionIntegration);

        //POST /products
        productsResource.addMethod("POST", productsFunctionIntegration);

        // /products/{id}
        const productByIdResource = productsResource.addResource("{id}")

        //GET /products/{id}
        productByIdResource.addMethod("GET", productsFunctionIntegration)

        //PUT /products/{id}
        productByIdResource.addMethod("PUT", productsFunctionIntegration)

        //DELETE /products/{id}
        productByIdResource.addMethod("DELETE", productsFunctionIntegration)

        this.urlOutput = new cdk.CfnOutput(this, "url", {
            exportName: "url",
            value: api.url,
        });
    }
}
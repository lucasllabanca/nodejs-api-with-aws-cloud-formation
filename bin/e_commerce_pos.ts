#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ProductsFunctionStack } from '../lib/stacks/productsFunction-stack';
import { EcommerceApiStack } from '../lib/stacks/ecommerceApi-stack';
import { ProductsDdbStack } from '../lib/stacks/productsDdb-stack';
import { EventsDdbStack } from '../lib/stacks/eventsDdb-stack';
import { OrdersApplicationStack } from '../lib/stacks/ordersApplication-stack';

const app = new cdk.App();

//regiao e num conta do console aws
const environment = {
  region: "us-east-1",
  account: "322605363175"
}

//Tags para usar filtros no aws para as tags
//Daria pra filtrar os gastos da tag Inatel para todos recursos
const tags = {
  cost: "ECommerce",
  team: "Inatel"
}

const productsDdbStack = new ProductsDdbStack(app, "ProductsDdb", {
  env: environment,
  tags: tags,
})

const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
  env: environment,
  tags: tags,
})

const productsFunctionStack = new ProductsFunctionStack(app, "ProductsFunction", {
  env: environment,
  tags: tags,
  productsDdb: productsDdbStack.table,
  eventsDdb: eventsDdbStack.table
});

productsFunctionStack.addDependency(productsDdbStack)
productsFunctionStack.addDependency(eventsDdbStack)

const ordersApplicationStack = new OrdersApplicationStack(app, "OrdersApplication", {
  productsDdb: productsDdbStack.table,
  eventsDdb: eventsDdbStack.table,
  env: environment,
  tags: tags,
})

ordersApplicationStack.addDependency(productsDdbStack)

const eCommerceApiStack = new EcommerceApiStack(app, "ECommerceApi", {
  productsHandler: productsFunctionStack.productsHandler,
  ordersHandler: ordersApplicationStack.ordersHandler,
  orderEventsFetchHandler: ordersApplicationStack.orderEventsFetchHandler, //nao preciso add dependencia dessa stack, tah em orders
  env: environment,
  tags: tags
});

//Esteira de pipeline, assim mostra as dependecias pra criar uma antes de outra
eCommerceApiStack.addDependency(productsFunctionStack)
eCommerceApiStack.addDependency(ordersApplicationStack)
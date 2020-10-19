var express = require('express');
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
var app = express(); 
var schema = require('./schema_fc.js')
var root = require('./root_fc.js')


// Đại diện cho 1 link trên domain - gồm nhiều route con ( get , post )
app.use('/graphql', graphqlHTTP({
  schema: buildSchema(schema),
  rootValue: root,
  graphiql: true,
}));



app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');
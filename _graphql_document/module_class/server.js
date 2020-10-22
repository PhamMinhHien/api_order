var express = require('express');
var app = express();
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
var { root } = require('./root') // root : chứa những thông tin 

app.use('/graphql', graphqlHTTP({
    schema: buildSchema(require('./schema.js')),
    rootValue: root,
    graphiql: true,
}));
app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');
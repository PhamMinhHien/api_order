require('./globals')

const fs = require('fs');
const path = require('path');

const cors = require('cors')
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
var express = require('express');
var app = express();


try {
    const schema = fs.readFileSync(path.resolve('./order/schema.graphql'), { encoding: 'utf8' })
    app.use('/order', graphqlHTTP({
        schema: buildSchema(`${schema}`),
        rootValue: require('./order/root.js'),
        graphiql: true,
    }));

    app.use(cors())

} catch (err) {
    console.log(err)
}


app.listen(62000);
console.log('Running a GraphQL API server at localhost:62000/order');


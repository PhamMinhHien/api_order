var express = require('express');
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');

// Thiết lập root cho page : order 
var { root } = require('./order/root')

// Biến chứa chuỗi txt |=> lấy bằng cách đọc file => thông qua thư mục cùng tên - order.txt
var txtSchema = `
    type RandomDie {
        numSides: Int!
        rollOnce: Int!
        roll(numRolls: Int!): [Int]
    }

    type Query {
        getDie(numSides: Int): RandomDie
    }
`
var schema = buildSchema(txtSchema); // xây dựng schema lên 



// The root provides the top-level API endpoints

var app = express();
app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));
app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');
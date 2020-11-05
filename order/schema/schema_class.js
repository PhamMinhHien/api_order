import { graphql, GraphqlSchema , GraphQLObjectType, GraphQLString } from 'graphql'


var schema = new GraphqlSchema({
    query: new GraphQLObjectType{
        name: "Root"
    }
})
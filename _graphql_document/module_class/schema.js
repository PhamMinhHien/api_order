module.exports = `
    type RandomDie {
        numSides: Int!
        rollOnce: Int!
        roll(numRolls: Int!): [Int]
    }

    type Query {
        getDie(numSides: Int): RandomDie
    }
`
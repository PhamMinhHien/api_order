/**
 * Những hàm - đại diện cho những route của 1 route cha có thể làm việc 
 * Viết thêm nhiều hàm thao tác bên trong đây 
 */

const rollDice = ({numDice, numSides}) => {
    var output = [];
    for (var i = 0; i < numDice; i++) {
      output.push(1 + Math.floor(Math.random() * (numSides || 6)));
    }
    return output;
}

module.exports = {
    rollDice

};
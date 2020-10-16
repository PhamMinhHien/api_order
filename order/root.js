const { RandomDie } = require('./class_order')

// Những kiểu câu truy vấn được từ 1 route : /graph . Nhưng có nhiều thể loại khác nhau 

const getdia = ({ numSides }) => {
    return new RandomDie(numSides || 6);
}


var root = {
    getDie: getdia
}


module.exports = {
    root 
}
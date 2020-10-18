const { RandomDie } = require('./class_order')

// Những kiểu câu truy vấn được từ 1 route : /graph . Nhưng có nhiều thể loại khác nhau 

const getAll = ({ numSides }) => {
    return new RandomDie(numSides || 6);
}

module.exports = {
    root: {
        getAll: getAll,
        loadMore: loadMore
    }
}


function getAll(request) {
    return db.query(`{
      result(func: type(PrimaryOrder), orderdesc: created_at) @filter(not eq(is_deleted, true)) {
        ${orderFragment}
      }
    }`)
  }
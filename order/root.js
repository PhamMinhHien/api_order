const db = require.main.require('./services/tvcdb')

const { mutate , orderFilter , loadMore, getByUid } = require('./query/api-cms') // import những hàm truy vấn từ api-cms


async function pagination_order(args){
    let os = args.offset  // Thiết lập giá trị mặc định - tùy ý 
    let nb = args.number
    const { result } = await loadMore(os,nb)
    console.log(result)
    return result
}
async function searchByUid(args){
    var uid = args.id
    const {result} = await getByUid(uid)
    console.log(result)
    return {
        id: result[0].uid,
        order_id: result[0].order_id
    }
}






async function getBrand(args) {
    var name = args.name
    const { result } = await db.query(`{ result(func: type(Brand)){uid,expand(_all_)} }`)
    console.log(result);
    return result.filter(rs => {
        return rs.brand_name == name;
    })[0];
}
module.exports = {
    brand: getBrand,
    searchByUid: searchByUid,
    // loadMoreOrder: pagination_order 
}
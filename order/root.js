const db = require.main.require('./services/tvcdb')

const { mutate , orderFilter , loadMore } = require('./query/api_cms.js') // import những hàm truy vấn từ api-cms


async function pagination_order(args){
    let os = args.offset 
    let nb = args.number
    const { result } = await loadMore(os,nb)
    console.log(result)
    return result
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
    mutate: mutate,
    orderFilter: orderFilter,
    loadMoreOrder: pagination_order 
}
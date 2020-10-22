const db = require.main.require('./services/tvcdb')

const { mutate , orderFilter , loadMore } = require('./api_cms/index') // import function từ api_cms


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
    loadMore: loadMore,
    getByUid: getByUid,
    orderExport: orderExport,
    // api_publish
}
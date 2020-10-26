const db = require.main.require('./services/tvcdb')

const { mutate , orderFilter , loadMore, getByUid } = require('./query/query') // import những hàm truy vấn từ api-cms

// Tìm theo UID => OK
async function searchByUid(args){
    var uid = args.id
    const {result} = await getByUid(uid)
    return result && { ...result[0], id: result[0].uid }
}

// Phân trang order => 
async function pagination_order(args){
    let nb = args.number
    let os = args.offset
    const { result } = await loadMore(nb,os)
    console.log(result)
    return result
}

// Lấy danh sách dữ liệu Order về CMS => đã qua cơ chế lọc dữ liệu trên table 
async function list_order(args){
    // let number = args.number 

    const { summary: [{totalCount}], data } = await orderFilter(args)
    return { totalCount, data }
}




module.exports = {
    searchByUid: searchByUid,
    loadMoreOrder: pagination_order,
    listOrder: list_order,
}
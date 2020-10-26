const db = require.main.require('./services/tvcdb')

const { mutate , orderFilter , loadMore, getByUid } = require('./query/query') // import những hàm truy vấn từ api-cms

async function create_order(input){
    const { result } = await mutate(input)
    return result
}


async function update_order(args){
    let id = args.uid
    let input = args.input
    const { result } = await mutate({uid,input})
    return result
}

// Tìm theo UID => OK
async function search_by_uid(args){
    var uid = args.id
    const {result} = await getByUid(uid)
    return result && { ...result[0], id: result[0].uid }
}

// Phân trang order => 
async function load_more_order(args){
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
    searchByUid: search_by_uid,
    loadMoreOrder: load_more_order,
    listOrder: list_order,
    createOrder: create_order,
    updateOrder: update_order,
}
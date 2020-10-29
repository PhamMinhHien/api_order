const { mutate , orderFilter , loadMore, getByUid } = require('./query/api_cms') // import những hàm truy vấn từ api-cms





/**
 * API CMS 
 */

async function create_order(input){
    const { result } = await mutate(input)
    return result
}
async function update_order(args){
    let uid = args.uid
    let input = args.input
    const { statusCode } = await mutate({uid,input})
    console.log(statusCode);
    return { statusCode }
}
async function search_by_uid(args){
    var uid = args.id
    const {result} = await getByUid(uid)
    return result && { ...result[0], id: result[0].uid }
}
async function load_more_order(args){
    let nb = args.number
    let os = args.offset
    const { result } = await loadMore(nb,os)
    console.log(result)
    return result
}
async function list_order(args){
    const { summary: [{totalCount}], data } = await orderFilter(args)
    return { totalCount, data }
}


/**
 * API PUBLIC 
 */

// TODO : CART 
// async function list_cart_item(args){
//     if(!args || !Array.isArray(args)) {
//         throw { statusCode: 400, message: "What are you doing here?" }
//     }
//     const { status , data } = listCartItems(args)
//     return { status, data }
// }














module.exports = {
    createOrder: create_order,
    updateOrder: update_order,
    searchByUid: search_by_uid,
    loadMoreOrder: load_more_order,
    listOrder: list_order
}
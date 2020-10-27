const { mutate , orderFilter , loadMore, getByUid } = require('./query/query_cms') // import những hàm truy vấn từ api-cms
const { listCartItems } = require('./query/api_public/order/cart') // import những hàm query từ api-public 
const { submitOrder } = require('./query/api_public/order/order')
/**
 * API CMS 
 */

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


// TODO: : 
async function submit_order(args){
    const { } = submitOrder(args)
    return { }
}













module.exports = {
    searchByUid: search_by_uid,
    loadMoreOrder: load_more_order,
    listOrder: list_order,
    createOrder: create_order,
    updateOrder: update_order,
    listCartItem: list_cart_item,

}
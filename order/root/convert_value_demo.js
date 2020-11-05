/**
 * Mục đích che dấu predicate => làm sao đó predicate được bản tòan 
 */

// Function chuyển đổi dữ liệu query về dữ liệu của graphql api 
const change_dgraph_to_graphql = ( schema_of_convert, data_query) => {
    let result = {}
    Object.keys(data_query).map(item => {
        let idx = schema_of_convert.findIndex(i => i.q_r === item)
        if (idx !== -1) {
            result[schema_of_convert[idx].r_q] = data_query[item]
        }
    })

    return result 
}

// function chuyển đổi dữ liệu tù graphql nhận được về cơ chế của dgraph 

const change_graphql_to_dgraph = ( schema_of_convert , data_graphql) => {
    let result = {}
    Object.keys(data_graphql).map(item => {
        let idx = schema_of_convert.findIndex(i => i.r_q === item)
        if (idx !== -1) {
            result[schema_of_convert[idx].q_r] = data_graphql[item]
        }
    })
}




// Sơ đồ chuyển đổi => mỗi cái bảng chuyển đổi đều thuộc 1 type khác nhau 
// Hạn chế chuyển đổi - chỉ che dấu những thông tin quan trọng => 
let schema_of_convert = [
    { q_r: "uid", r_q: "id" },
    { q_r: "partner", r_q: "id_order" }
]
// Dư liệu ảo 
let query_result = {
    uid: "0x123",
    order_id: "BCD455x4x4s5"
}

let result_query = {
    id: "0x123",
    id_order: "BCD455x4x4s5"
}


module.exports = {
    change_graphql_to_dgraph,
    change_dgraph_to_graphql
}
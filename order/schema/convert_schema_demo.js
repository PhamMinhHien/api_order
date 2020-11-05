const schema = {
    OrderType: {
        id: "String",
        order_id: "String"
    }
}

const chuyen_doi = (type) => {
    switch (type) {
        case "String":
            return "String";
        case "default":
            break;
    }
}


const thuc_thi_field = (obj) => {
  	let ob_value = {}
    Object.keys(obj).map((item,index) => {
        ob_value = { ...ob_value, [item]: obj[item] }
    })
    return {...ob_value}
}

let result = {}
Object.keys(schema).map(obj => {
    result = {
        [obj]: new Object({
            name: obj.replace("Type", ""),
            fields: thuc_thi_field(schema[obj])
        })
    }
})
console.log(result)


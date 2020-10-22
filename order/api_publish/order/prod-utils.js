"use strict"

function prodSummary(items, ...props) {
  return props.map(prop => {
    return items.reduce((prodSummary, item) => {
      return item[prop] ? prodSummary + (item[prop] * item.quantity) : prodSummary
    }, 0)
  })
}

module.exports = { prodSummary }
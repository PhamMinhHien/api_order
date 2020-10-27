"use strict"

function prodSummary (items, ...props) {
  return props.map(prop => items.reduce((prodSummary, item) => item[prop] ? prodSummary + (item[prop] * item.quantity) : prodSummary, 0))
}

module.exports = { prodSummary }
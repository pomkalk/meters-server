const parse = require('parsedbf')
const fs = require('fs')

let a = parse(fs.readFileSync("./import-data/2020/8/S_ADDR.DBF"), "cp866")

let s = new Set()

a.forEach(x=>s.add(x.ORG))

console.log(s)
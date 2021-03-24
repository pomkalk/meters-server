const parse = require('parsedbf')
const fs = require('fs')

let a = parse(fs.readFileSync("../S_SC.DBF"), "cp866")

a = a.filter(x => x.CK===503856)

console.log(a)
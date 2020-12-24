// const parseDbf = require('parsedbf')
// const fs = require('fs')
// const env = require('../lib/env')
// const postgres = require('postgres')

// let sql = postgres(env.db)

// const main = async () => {
//     let a = parseDbf(fs.readFileSync('./import-data/2020/10/S_SC.DBF'), 'cp866')
//     if (a[0].DTPN) {
//         console.log('x')
//     }
// }

// main()

const jwt = require('jsonwebtoken')

let d = { data: 123 }
let a = jwt.sign(d, 'asd', {expiresIn: '2000'})
console.log(a)

let s = jwt.verify(a, 'asd')
console.log(s)

setTimeout(() => {
    console.log(jwt.verify(a, 'asd'))
}, 5000)
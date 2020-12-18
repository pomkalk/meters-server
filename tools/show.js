const parseDbf = require('parsedbf')
const fs = require('fs')
const env = require('../lib/env')
const postgres = require('postgres')

let sql = postgres(env.db)

const main = async () => {
    let a = parseDbf(fs.readFileSync('./import-data/2020/10/S_SC.DBF'), 'cp866')
    if (a[0].DTPN) {
        console.log('x')
    }
}

main()

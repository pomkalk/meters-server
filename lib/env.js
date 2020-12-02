const fs = require('fs')

let conf = {
    port: '3000',
    db: {
        host: 'localhost',
        username: 'postgres',
        password: 'postgres',
        database: ''
    }
}

conf = [...fs.readFileSync('./.env').toString().matchAll(/^(.+?)=(.+?)$/gm)].reduce((t, v)=>{
    let key = v[1].trim().toLowerCase()
    let val = v[2].trim()
    if (key.startsWith('#')) return t
    if (key.indexOf('_')>0) {
        let keys = key.split('_')
        return { ...t, [keys[0]] : { ...t[keys[0]], [keys[1]]: val } }
    } else {
        return { ...t, [key]: val}
    }
}, conf)


module.exports = conf
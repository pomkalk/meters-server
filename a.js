// const env = require('./lib/env')
// const postgres = require('postgres')
// let sql = postgres(env.db)


// const main = async () => {
//     let a = await sql`SELECT '["asd","dsa", 123]'::jsonb ? '123'`
//     //let a = await sql`SELECT id, target->'list' as list FROM a WHERE (target->>'list')::jsonb ? '103030'`
//     console.log(JSON.stringify(a, null, 2))
    

// }

// main()


let a = {
    data: [1, 2, 3],
    name: 'ogogo'
}

const f = ({data: res, name: name}) => {
    console.log(res, name)
}

f(a)
const env = require('./lib/env')
const postgres = require('postgres')
let sql = postgres(env.db)
let faker = require('faker')

const addNick = async (name) => {
    await sql.begin(async sql=>{
        let [x] = await sql`insert into nicks (name) values (${name}) returning *`
        let data = {
            ref: x.id,
            list: [
                {
                    value: x.name,
                    date: x.created_at
                }
            ]
        }
        await sql`insert into nicks_hist (data) values (${ sql.json(data) })`
    })
}

const updateNick = async (id, name) => {
    await sql.begin(async sql => {
        let [x] = await sql`UPDATE nicks SET name=${name}, updated_at=now() WHERE id=${id} RETURNING *`
        let z = [{
            value: x.name,
            date: x.updated_at
        }]
        await sql`UPDATE nicks_hist SET data = jsonb_set(data, '{list}', data->'list'|| ${sql.json(z)}) WHERE data->'ref' = ${ sql.json(x.id)}`
    })
}

const main = async () => {
    try {
        let q = Array.from({length: 1000}, ()=>faker.name.findName())
        for (let x of q) {
            let id = faker.random.number({min: 1, max: 3})
            await updateNick(id, x)
        }
        
    } catch (e) {
        console.log(e)
    } finally {
        await sql.end()
    }
}

main()



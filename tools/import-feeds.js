const env = require('../lib/env')
const bcrypt = require('bcrypt')
const postgres = require('postgres')
const { createLogger } = require('../lib/logger')
const fs = require('fs')
const parseDbf = require('parsedbf')
const logger = createLogger('system')
const password = '$2b$10$mdn2xZLfZcaznJ8ZfPM/E.bo7LIhFOczZHaCRXFD2Qkikx9hpIMgi'
let sql = postgres(env.db)
const progress = require('progress')
const faker = require('faker')

const waitFor = (ms) => new Promise(resolve=>setTimeout(resolve, ms))

const main = async () => {
    let a = Array.from({length: 45}, () => {
        return {
            ls: faker.random.arrayElement([103030, 507654]),
            body: faker.lorem.lines(faker.random.number({min: 1, max: 10}))
        }
    })
    for (let x of a) {
        console.log(x)
        await waitFor(faker.random.number({min: 100, max: 130}))
        await sql`INSERT INTO feedbacks ${ sql(x)}`

    }
    
    console.log('done')
}
main()
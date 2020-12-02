const env = require('../lib/env')
const bcrypt = require('bcrypt')
const postgres = require('postgres')
const { createLogger } = require('../lib/logger')

const logger = createLogger('system')
const password = '$2b$10$mdn2xZLfZcaznJ8ZfPM/E.bo7LIhFOczZHaCRXFD2Qkikx9hpIMgi'

const authenticateDb = async sql => {
    try {
        await sql`SELECT 1+1`
        return true
    } catch (e) {
        return false
    }
}

const root = {
    name: 'Черепанов Роман',
    username: 'pomkalk',
    password
}

const options = [
    {key: 'site_on', valb: true },
    {key: 'siteoff_msg', valt: 'На сайте ведутся технические работы.'},
    {key: 'meters_period', valt: '17,08:00,25,23:59'},
    {key: 'meters_msg', valt: 'Здравствуйте, к сожалению, данный сервис доступен в период с 08:00 17 числа по 23:59 25 числа каждого месяца.'},
    {key: 'meters_block', valt: 'Уточнить причину блокировки или приостановки счетчика вы можете по телефону в абонентском отделе ООО «УЕЗ ЖКУ г. Ленинска-Кузнецкого» - 49-2-49. Наиболее частая причина блокировки является истечение сроков поверки счетчиков.'}
]

let sql;

const main = async () => {
    try {
        logger.info('Start import init data')
        sql = postgres(env.db)
        if (!await authenticateDb(sql)) return console.log('Auth error')
        let [user] = await sql`INSERT INTO users ${ sql(root) } RETURNING *`
        logger.info('Root user created', {...user, password: '*****' })
        await sql`INSERT INTO config ${ sql(options.map(x => Object.assign({valt: null, valj: null, valb: null, vali: null}, x))) }`
        logger.info('Default site configuration created')
    }
    catch (e) {
        logger.error(e)
    }
    finally {
        logger.info('Import complete')
        await sql.end({ timeout: 5 })
    }
}
main()
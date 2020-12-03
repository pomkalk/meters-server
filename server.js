const { createLogger } = require('./lib/logger')
const App = require('./lib/app')
const { sql, sqlCheck } = require('./lib/db')

const logger = createLogger('server')

const main = async () => {

    if (await sqlCheck) {
        logger.info('Database connected')
        const app = new App(sql)
        app.start()
    } else {
        logger.error('Database error')
    }
}

main()

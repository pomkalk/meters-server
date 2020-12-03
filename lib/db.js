const postgres = require('postgres')
const env = require('./env')
const { createLogger } = require('./logger')

const logger = createLogger('db')
const sql = postgres(env.db)

module.exports = {
    sql,
    sqlCheck: async () => {
        try {
            await sql`SELECT 1+1`
            return true
        } catch (e) {
            logger.error(e)
            return false
        }
    }
}
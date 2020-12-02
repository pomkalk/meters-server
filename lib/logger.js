const fs = require('fs')
const path = require('path')
const log4js = require('log4js')
const env = require('./env')

const log_path = path.resolve(__dirname, '../logs')
if (!fs.existsSync(log_path)) fs.mkdirSync(log_path)

log4js.configure({
    appenders: {
        everything: {
            type: 'dateFile',
            pattern: 'yyyy-MM-dd',
            filename: path.resolve(log_path, 'log'),
            keepFileExt: true,
            compress: true
        }
    },
    categories: {
        default: { appenders: [ 'everything' ], level: env.loglevel || 'debug'}
    }
})

module.exports = {
    log4js,
    createLogger: (category = 'default') => {
        let logger = log4js.getLogger(category)
        return logger
    }
}
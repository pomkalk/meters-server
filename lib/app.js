const Koa = require('koa')
const { createLogger } = require('./logger')
const env = require('./env')
const Router = require('koa-router')
const Static = require('koa-static')
const fs = require('fs')
const path = require('path')
const initIO = require('socket.io')
const http = require('http')
const Api = require('./api')


class App {
    constructor (sql) {
        this.port = env.port
        this.sql = sql
        this.log = createLogger('system')
        this.users = {}
        this.init()
    }

    init () {
        try {
            this.app = new Koa ()
            this.adminRouter = new Router()
            this.app.use(Static(env.admindir, { gzip: true }))
            this.adminRouter.get('/admin359:p(.*)', (ctx) => {
                ctx.body = fs.readFileSync(path.resolve(env.admindir, 'admin359/index.html')).toString()
            })
            this.app.use(this.adminRouter.routes()).use(this.adminRouter.allowedMethods())

            this.server = http.createServer(this.app.callback())
            this.io = initIO(this.server, {path: '/admin'})

            this.io.on('connect', (socket) => {
                this.log.info('socket connected:', socket.id)
                Api.create(socket, this)
            })
        } catch (e) {
            this.log.error(e)        
        }
    }

    start () {
        this.server.listen(this.port, () => {
            this.log.info(`Server started on port ${this.port}`)
        })
    }
}

module.exports = App

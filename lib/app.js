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
const multer = require('koa-multer')
const parseDbf = require('parsedbf')
const tmp = require('tmp')

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
            this.router = new Router()
            this.adminRouter = new Router()
            this.app.use(Static(env.admindir, { gzip: true }))

            const upload = multer()
            this.adminRouter.post('/admin359/import/file', upload.single('addr'), async (ctx) => {
                try {
                    let data = parseDbf(ctx.req.file.buffer, 'cp866')
                    let t = null
                    if (data[0].XF!==undefined&&data[0].XI!==undefined&&data[0].XO!==undefined) {
                        t = 'addr'
                    }
                    if (data[0].DTPN!==undefined) {
                        t = 'sc'
                    }
                    if (t==null) {
                        ctx.status = 500
                        return ctx.body = 'Bad file'
                    }
                    let f = tmp.fileSync()
                    fs.writeFileSync(f.name, ctx.req.file.buffer)
                    ctx.body = `${t}|${f.name}`
                } catch (e) {
                    ctx.status = 500
                    ctx.body = e.name + ' ' + e.message
                }
            })

            this.adminRouter.get('/admin359:p(.*)', (ctx) => {
                ctx.body = fs.readFileSync(path.resolve(env.admindir, 'admin359/index.html')).toString()
            })
            this.app.use(this.adminRouter.routes()).use(this.adminRouter.allowedMethods())
            this.app.use(this.router.routes()).use(this.router.allowedMethods())
            this.server = http.createServer(this.app.callback())
            this.io = initIO(this.server, {path: '/admin'})

            this.io.on('connect', (socket) => {
                this.log.info('socket connected:', socket.id)
                Api.create(socket, this)
            })
           
            
            this.router.get('/', async (ctx) => {
                ctx.body = 'hoho'
            })

            this.router.get('/api/address', async (ctx) => {
                ctx.body = await this.sql`SELECT id, type, name FROM streets ORDER BY name, type`
            })

            this.router.get('/api/address/:street_id', async (ctx) => {
                ctx.body = await this.sql`SELECT id, number, housing FROM buildings WHERE street_id=${ctx.params.street_id} ORDER BY number, housing`
            })            
            this.router.get('/api/address/:street_id/:building_id', async (ctx) => {
                ctx.body = await this.sql`SELECT * FROM apartments WHERE building_id=${ctx.params.building_id} ORDER BY number, part`
            })            
        } catch (e) {
            this.log.error(e)        
        }
    }

    async siteAccess (ctx, next) {
        let dt = new Date()
        let d = dt.getDate()
        let h = dt.getHours()
        let m = dt.getMinutes()
        console.log(d, h, m)
        next()
    }

    start () {
        this.server.listen(this.port, () => {
            this.log.info(`Server started on port ${this.port}`)
        })
    }
}

module.exports = App

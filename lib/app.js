const Koa = require('koa')
const { createLogger } = require('./logger')
const env = require('./env')
const bodyParser = require('koa-bodyparser')
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
const jwt = require('jsonwebtoken')

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
            this.apiRouter = new Router()
            this.adminRouter = new Router()
            this.app.use(Static(env.admindir, { gzip: true }))
            this.app.use(Static(env.clientdir, { gzip: true }))
            this.app.use(bodyParser())
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


            this.router.use(this.siteAccess.bind(this))
            this.router.get('/', async (ctx) => {
                ctx.body = fs.readFileSync(path.resolve(env.clientdir, 'index.html')).toString()
            })


            this.apiRouter.use(this.siteAccess.bind(this))
            this.apiRouter.get('/api/access', async (ctx) => {
                let [period] = await this.sql`SELECT p.id, p.p_start, p.p_end from periods AS p WHERE p.id = (SELECT vali FROM config AS c WHERE c.key='current')`
                let current = new Date()
                let start = new Date(period.p_start)
                let end = new Date(period.p_end)
                let access = current>start&&current<end
                let res = {access, start, end}
                if (!access) {
                    let [msg] = await this.sql`SELECT valt FROM config WHERE key='meters_msg'`
                    res.message = msg.valt
                }
                
                ctx.body = res
            })

            this.apiRouter.get('/api/address', async (ctx) => {
                ctx.body = await this.sql`SELECT id, type, name FROM streets ORDER BY name, type`
            })

            this.apiRouter.get('/api/address/s:street_id', async (ctx) => {
                ctx.body = await this.sql`SELECT id, number, housing FROM buildings WHERE street_id=${ctx.params.street_id} ORDER BY number, housing`
            })            
            this.apiRouter.get('/api/address/b:building_id', async (ctx) => {
                ctx.body = await this.sql`SELECT id, number, part FROM apartments WHERE building_id=${ctx.params.building_id} ORDER BY number, part`
            })
            this.apiRouter.post('/api/get-token/qr', async (ctx) => {
                try {
                    const data = ctx.request.body.code || ""
                    if (!['PersonalAcc', 'BIC', 'CorrespAcc', 'persAcc'].every(x => data.includes(x))) {
                        ctx.body = {error: 'Неверный QR код.'}
                        return
                    }
                    let match = data.match(/persAcc=(\d{6})/)
                    let ls = parseInt(match[1])
                    let [apartment] = await this.sql`SELECT a.id, a.ls, a.space, 
                    CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address 
                    FROM apartments AS a
                    LEFT JOIN buildings AS b ON b.id=a.building_id
                    LEFT JOIN streets as s ON s.id=b.street_id
                    WHERE a.ls=${ls}`

                    let [res] = await this.sql`INSERT INTO tokens ${ this.sql({ ls: apartment.ls }) } RETURNING *`

                    let td = {
                        ls: apartment.ls,
                        tid: res.id
                    }
                    let token = jwt.sign(td, env.secret)

                    ctx.body = {
                    address: apartment.address,
                    token, ls: apartment.ls
                }
                } catch (e) {
                    console.log(e)
                    ctx.body = {error: 'Обишка на сервере, администратор уже разбирается.'}
                }
                
            })
            this.apiRouter.post('/api/get-token', async (ctx) => {
                const data = ctx.request.body
                const ls = parseInt(data.ls)
                const space = parseFloat(data.space.replace(',','.'))
                let [apartment] = await this.sql`SELECT a.id, a.ls, a.space, 
                    CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address 
                    FROM apartments AS a
                    LEFT JOIN buildings AS b ON b.id=a.building_id
                    LEFT JOIN streets as s ON s.id=b.street_id
                    WHERE a.id=${data.apartment}`
                if (!apartment) {
                    ctx.body = {error: 'Лицевой счет не найден. Проверьте данные.'}
                    return
                }
                if (apartment.ls !== ls) {
                    ctx.body = {error: 'Неверный лицевой счет. Проверьте данные.'}
                    return
                }
                if (apartment.space !== space) {
                    ctx.body = {error: 'Неверно указана площадь. Проверьте данные.'}
                    return
                }

                let td = {
                    ls: apartment.ls
                }
                let token
                if (data.remember) {
                    let [res] = await this.sql`INSERT INTO tokens ${ this.sql({ ls: apartment.ls }) } RETURNING *`
                    td.tid = res.id
                    token = jwt.sign(td, env.secret)
                } else {
                    token = jwt.sign(td, env.secret, { expiresIn: '1d'})
                }

                ctx.body = {
                    address: apartment.address,
                    token, ls: apartment.ls
                }
            })

            this.apiRouter.post('/api/get-meters', async (ctx) => {
                try {
                    const token = ctx.request.body.token
                    let { ls, tid } = jwt.verify(token, env.secret)
                    let [period] = await this.sql`SELECT p.id, p.month, p.year, p.p_start, p.p_end from periods AS p WHERE p.id = (SELECT vali FROM config AS c WHERE c.key='current')`
                    let current = new Date()
                    let start = new Date(period.p_start)
                    let end = new Date(period.p_end)
                    let access = current>start&&current<end
                    let res = {access, period: { month: period.month, year: period.year}}
                    if (!access) {
                        let [msg] = await this.sql`SELECT valt FROM config WHERE key='meters_msg'`
                        res.message = msg.valt
                    }

                    let [[address], meters] = await Promise.all([
                        this.sql`SELECT a.id, CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address 
                        FROM apartments AS a
                        LEFT JOIN buildings AS b ON b.id=a.building_id
                        LEFT JOIN streets as s ON s.id=b.street_id
                        WHERE a.ls=${ls}`,
                        this.sql`SELECT m.id, m.service, m.status, m.last_month, m.last_year, m.last_value, m. new_value, m.new_date
                        FROM meters as m
                        WHERE m.ls=${ls} AND period_id=${period.id}
                        ORDER BY m.service, m.mid`
                    ])
                    res.address = address.address
                    res.meters = meters
                    ctx.body = res
                } catch (e) {
                    this.log.error(e, ctx.request.body)
                    ctx.staus = 500
                    ctx.body = 'error'
                }
            })

            this.apiRouter.post('/api/get-history', async (ctx) => {
                try {
                    const token = ctx.request.body.token
                    const meter_id = ctx.request.body.meter_id
                    let { ls, tid } = jwt.verify(token, env.secret)
                    let [[address], meters] = await Promise.all([
                        this.sql`SELECT a.id, CONCAT(s.type, '. ', s.name, ', д. ', CONCAT_WS('/', b.number, NULLIF(b.housing, '')), ', кв. ', CONCAT_WS('/', a.number, NULLIF(a.part, ''))) as address 
                        FROM apartments AS a
                        LEFT JOIN buildings AS b ON b.id=a.building_id
                        LEFT JOIN streets as s ON s.id=b.street_id
                        WHERE a.ls=${ls}`,
                        this.sql`SELECT m.id, m.mid, m.period_id, p.month, p.year, m.ls, m.service, m.status, m.last_month, m.last_year, m.last_value, m.new_value, m.new_date
                        FROM meters AS m
                        LEFT JOIN periods AS p ON p.id=m.period_id
                        WHERE m.ls=${ls} AND m.mid=(SELECT mid from meters WHERE id=${meter_id}) AND m.period_id IN (SELECT p.id
                        FROM periods AS p
                        WHERE deleted_at IS NULL
                        ORDER BY p.year DESC, p.month DESC
                        LIMIT 12)
                        ORDER BY p.year DESC, p.month DESC`
                    ])

                    ctx.body = { address: address.address, meters }
                } catch (e) {
                    this.log.error(e, ctx.request.body)
                    ctx.staus = 500
                    ctx.body = 'error'
                }
            })

            this.apiRouter.post('/api/save', async (ctx) => {
                try {
                    const token = ctx.request.body.token
                    const meter_id = ctx.request.body.meter_id
                    const value = ctx.request.body.value

                    let { ls, tid } = jwt.verify(token, env.secret)
                    let [[meter], [period]] = await Promise.all([
                        this.sql`SELECT * FROM meters WHERE id=${meter_id} AND ls=${ls}`,
                        this.sql`SELECT * FROM periods WHERE id = (SELECT period_id FROM meters WHERE id=${meter_id} AND ls=${ls})`
                    ])

                    let current = new Date()
                    let start = new Date(period.p_start)
                    let end = new Date(period.p_end)
                    let access = current>start&&current<end

                    if (!access) {
                        ctx.body = {error: 'Невозможно сохранить показания. Нет доступа.'}
                        this.log.error('Meter period error', ls, meter_id, value)
                        return
                    }

                    if (!meter) {
                        ctx.body = {error: 'Невозможно сохранить показания. Счетчик не найден.'}
                        this.log.warn('Meter not found', ls, meter_id, value)
                        return
                    }
                    if (!period) {
                        ctx.body = {error: 'Ошибка при сохранении данных счетчика'}
                        this.log.warn('Meter period not found', ls, meter_id, value)
                        return
                    }

                    if (meter.service===1||meter.service===2) {
                        let m = value - meter.last_value
                        if (m>30) {
                            ctx.body = {error: `Слишком большое значени показаний. Максимальное значение для данного счетчика может быть ${meter.last_value+30}`}
                            return
                        }
                        if (value < meter.last_value && value!==null) {
                            ctx.body = {error: `Показания не могут быть меньше, чем предыдущие.`}
                            return
                        }
                    }
                    
                    [meter] = await this.sql`UPDATE meters SET new_value=${value}, src=0, new_date=NOW() WHERE id=${meter_id} RETURNING *`
                    //SELECT m.id, m.service, m.status, m.last_month, m.last_year, m.last_value, m. new_value, m.new_date

                    ctx.body = {
                        meter: {
                            id: meter.id,
                            service: meter.service,
                            status: meter.status,
                            last_month: meter.last_month,
                            last_year: meter.last_year,
                            last_value: meter.last_value,
                            new_value: meter.new_value,
                            new_date: meter.new_date
                        }
                    }
                } catch (e) {
                    this.log.error(e, ctx.request.body)
                    ctx.staus = 500
                    ctx.body = 'error'
                }
            })

            this.apiRouter.post('/api/feedback', async (ctx) => {
                try {
                    const token = ctx.request.body.token
                    const body = ctx.request.body.text
                    let { ls, tid } = jwt.verify(token, env.secret)
                    let [period] = await this.sql`SELECT p.id, p.month, p.year, p.p_start, p.p_end from periods AS p WHERE p.id = (SELECT vali FROM config AS c WHERE c.key='current')`
                    let current = new Date()
                    let start = new Date(period.p_start)
                    let end = new Date(period.p_end)
                    let access = current>start&&current<end
                    let res = {access, period: { month: period.month, year: period.year}}
                    if (!access) {
                        this.log.error(e, ctx.request.body)
                        ctx.staus = 500
                        ctx.body = 'error'
                    }
                    await this.sql`INSERT INTO feedbacks ${ this.sql({ls, body }) }`
                    let [res2] = await this.sql`SELECT COUNT(*) FROM feedbacks WHERE read IS NULL`
                    this.io.to('event.feedbacks-count').emit('feedbacks.count', res2.count)
                    this.io.to('event.feedbacks-updated').emit('events', {event: 'event.feedbacks-updated', data: null})
                    ctx.body='ok'
                } catch (e) {
                    this.log.error(e, ctx.request.body)
                    ctx.staus = 500
                    ctx.body = 'error'
                }
            })

            this.app.use(this.adminRouter.routes()).use(this.adminRouter.allowedMethods())
            this.app.use(this.apiRouter.routes()).use(this.apiRouter.allowedMethods())
            this.app.use(this.router.routes()).use(this.router.allowedMethods())
            this.server = http.createServer(this.app.callback())
            this.io = initIO(this.server, {path: '/admin'})

            this.io.on('connect', (socket) => {
                console.log('->', socket.id)
                this.log.info('socket connected:', socket.id)
                Api.create(socket, this)
            })
           
            
              
        } catch (e) {
            this.log.error(e)        
        }
    }

    async siteAccess (ctx, next) {
        let [[siteon], [siteoffmsg]] = await Promise.all([
            this.sql`SELECT valb FROM config WHERE key='site_on'`,
            this.sql`SELECT valt FROM config WHERE key='siteoff_msg'`,
        ])
        if (!siteon.valb) {
            ctx.body = siteoffmsg.valt
        }
         else {
            await next()
         }
    }

    start () {
        this.server.listen(this.port, () => {
            this.log.info(`Server started on port ${this.port}`)
        })
    }
}

module.exports = App

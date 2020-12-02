const Koa = require('koa')
const postgres = require('postgres')
const env = require('./lib/env')
const { createLogger } = require('./lib/logger')
const Router = require('koa-router')
const Static = require('koa-static')
const fs = require('fs')

const app = new Koa()
const adminRouter = new Router()

console.log(env)

app.use(Static(env.admindir))


adminRouter.get('/admin:p(.*)', (ctx) => {
    ctx.body = fs.readFileSync(env.admindir+'/admin/index.html').toString()
})

app.use(adminRouter.routes()).use(adminRouter.allowedMethods())

app.listen(3000)

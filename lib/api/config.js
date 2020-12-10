const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')

class ConfigApi extends BaseApi {
    init () {
        this.bindAuth('config.data.get', this.getConfig, "config")
        this.bindAuth('config.data.set', this.setConfig, "config.e")

        this.bindAuth('users.data.get', this.getUsers, "users")
        this.bindAuth('users.permissions.get', this.getUsers, "users")
    }

    async getUsers () {
        let users = await this.sql`SELECT u.id, u.name, u.username, u.permissions, u.last_online, s.id as sid, s.name as sname
        FROM users as u
        LEFT JOIN suppliers as s ON s.id = u.supplier_id
        ORDER BY u.name`
        
        users = users.map(user => {
            if (env.root === user.username) {
                user.root = true
                user.permissions = permissions.forRoot()
            } else {
                try {
                    user.permissions = [...user.permissions.matchAll(/\[(.+?)\]/gm)].reduce((t, v) => {
                        let sp = v[1].split('.')
                        let acc = sp[1].split('')
                        return { ...t, [sp[0]]: acc}
                    }, {})
                } catch (e) {
                    user.permissions = {}
                    this.log.error('set user permissions error', e)
                }
            }
            return user
        })

        

        this.socket.emit('users.data', users)
    }

    async getConfig () {
        let config = await this.sql`SELECT * FROM config ORDER BY n`
        this.socket.emit('config.data', config)
    }

    async setConfig (data) {
        try {
            if (!['site_on', 'siteoff_msg', 'meters_period', 'meters_msg', 'meters_block'].includes(data.key)) {
                return this.socket.emit('msg', {
                    type: 'warn',
                    message: 'Неверный параметр'
                })
            }
            let value = {}
            switch (data.key) {
                case 'site_on': value = {valb: data.value, valt: null, valj: null, vali: null}; break;
                case 'siteoff_msg': value = {valb: null, valt: data.value, valj: null, vali: null}; break;
                case 'meters_period': value = {valb: null, valt: data.value, valj: null, vali: null}; break;
                case 'meters_msg': value = {valb: null, valt: data.value, valj: null, vali: null}; break;
                case 'meters_block': value = {valb: null, valt: data.value, valj: null, vali: null}; break;
            }
            if (data.key === 'meters_period') {
                let t = new RegExp(/^\d{1,2},\d{1,2}:\d{1,2},\d{1,2},\d{1,2}:\d{1,2}$/)
                if (!t.test(data.value)) {
                    return this.socket.emit('msg', {
                        type: 'warn',
                        message: 'Неверный параметр периода'
                    })  
                }
            }
            console.log(data)
            console.log(value)

            await this.sql`UPDATE config SET ${ this.sql(value) } WHERE key=${data.key}`
            this.emitEvent('event.config-updated')
            this.log.info('config updated', data.key, data.value)
        } catch (e) {
            this.log.error('config update error', e)
        }
    }
}

module.exports = ConfigApi

const { createLogger } = require('../logger')
const env = require('../env')
const permissions = require('../../permissions')

class BaseApi {
    constructor (socket, app) {
        this.socket = socket
        this.app = app
        this.sql = app.sql
        this.io = app.io
        this.log = this.initLog()
        this.setLogger('api')
        this.init()
    }

    setLogger(category) {
        this.logger = createLogger(category)
    }

    initLog () {
        let levels = ['debug', 'info', 'error', 'warn', 'warning', 'fatal']
        return levels.reduce((t, v) => {
            return {...t, [v]: (...args) => {
                let user = this.socket.user ? `[${this.socket.user.username}:${this.socket.user.id}]` : ''
                this.logger[v](user, ...args)
            }}
        }, {})
        
    }

    extends (child) {
        let api = new child(this.socket, this.app)
    }

    emitError ( message, description = null ) {

        this.socket.emit('errmsg', { message, description })
    }

    emitEvent (event, data = null) {
        this.io.to(event).emit('events', {event, data})
    }

    bindAuth (event, action, access = null) {
        this.socket.on(event, (...args) => {
            if (this.socket.user) {
                if (access) {
                    if (this.can(access)) {
                        action.apply(this, args)    
                    } else {
                        this.log.warn('Access error', event, access)
                        this.socket.emit('auth.msg', 'Надостаточно прав доступа для совершения данной операции.')        
                    }
                } else {
                    action.apply(this, args)
                }
            } else {
                this.log.warn('Access error', event, access, this.socket.user)
                this.socket.emit('auth.msg', 'Необходимо авторизироваться для начала работы.')
            }
        })
    }

    _checkAccess (access) {
        return Object.keys(this.socket.user.permissions).includes(access)
    }

    _checkPermission (access, perm) {
        let a = this.socket.user.permissions[access]
        if (!a) return false
        if (a[0] === '*') return true
        return perm.every(x=>{
            return a.includes(x)
        })
    }

    can (access) {
        if (Array.isArray(access)) {
            return access.some(x => this.can(x))
        }
        if (access.length == 0) return false
        let a = access.split('.')
        if (a.length == 1) {
            return this._checkAccess(a[0])
        } else {
            if (a[1].length == 0) return false
            let s = a[1].split('')
            return this._checkPermission(a[0], s)
        }
        return false
    }

    init () {

    }

    initUser (data) {
        const user = {
            id: data.id,
            name: data.name,
            username: data.username,
            supplier_id: data.supplier_id,
        }
        if (env.root === data.username) {
            user.root = true
            user.permissions = permissions.forRoot()
            
            
        } else {
            try {
                user.permissions = [...data.permissions.matchAll(/\[(.+?)\]/gm)].reduce((t, v) => {
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
    }

    getMonthByNum (code) {
        switch (code) {
            case 1: return 'Январь'
            case 2: return 'Февраль'
            case 3: return 'Март'
            case 4: return 'Апрель'
            case 5: return 'Май'
            case 6: return 'Июнь'
            case 7: return 'Июль'
            case 8: return 'Август'
            case 9: return 'Сентябрь'
            case 10: return 'Октябрь'
            case 11: return 'Ноябрь'
            case 12: return 'Декабрь'
            default: return code
        }
    }

    parseDate (dateString) {
        const zero = (d) => {
            return ('0'+d).slice(-2)
        }
        let d = new Date(dateString)
        return `${zero(d.getDate())}.${zero(d.getMonth()+1)}.${zero(d.getFullYear())} ${zero(d.getHours())}:${zero(d.getMinutes())}:${zero(d.getSeconds())}`
    }
   
}

module.exports = BaseApi

const { createLogger } = require('../logger')
const env = require('../env')
const permissions = require('../../permissions')

class BaseApi {
    constructor (socket, app) {
        this.socket = socket
        this.app = app
        this.sql = app.sql
        this.io = app.io

        this.log = createLogger('api')
        this.init()
    }

    setLogger(category) {
        this.log = createLogger(category)
    }

    extends (child) {
        let api = new child(this.socket, this.app)
    }

    emitEvent (event) {
        this.io.to(event).emit('events', event)
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
}

module.exports = BaseApi

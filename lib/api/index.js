const { createLogger } = require('../logger')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const env = require('../env')

class Api {
    constructor (socket, app) {
        this.socket = socket
        this.socket.user = null
        this.app = app
        this.sql = app.sql
        this.io = app.io

        this.log = createLogger('auth')
        this.init()
    }

    static create (socket, app) {
        return new Api(socket, app)
    }

    bindAuth (event, action) {
        this.socket.on(event, (...args) => {
            if (this.socket.user) {
                action.apply(this, args)
            } else {
                this.socket.emit('auth.msg', 'Необходимо авторизироваться для начала работы.')
            }
        })
    }

    init () {
        this.socket.on('disconnect', () => {
            if (this.socket.user) {
                this.log.info('logout')
                delete this.app.users[this.socket.user.id]
                this.socket.user = null
                this.log = createLogger('auth')
            }
            this.log.info('socket disconnected:', this.socket.id)
        })
        this.socket.on('auth.login', this.login.bind(this))
        this.socket.on('auth.logout', this.logout.bind(this))
        this.socket.on('auth.restore', this.restore.bind(this))

        this.bindAuth('test.1', this.test)
    }

    test () {
        console.log('AUTH AUTH')
    }

    async login (data) {
        this.log.info('socket login:', this.socket.id, '- username:', data.username)
        const bad_login = 'Неверное имя пользователя или пароль.'
        try {
            let [user] = await this.sql`SELECT * from users WHERE username=${data.username}`
            
            if (!user) {
                this.log.warn('user not founded:', data.username)
                return this.socket.emit('auth.error', bad_login)
            }
            if (!bcrypt.compareSync(data.password, user.password)) {
                this.log.warn('bad password', data.username)
                return this.socket.emit('auth.error', bad_login)
            }
            
            this.authenticate(user)
        } catch (e) {
            this.socket.emit('auth.error', 'Ошибка при аутентификации.')
            this.log.error(e)
        }
    }

    logout (data) {
        this.log.info('logout')
        this.log = createLogger('auth')
        delete this.app.users[this.socket.user.id]
        this.socket.user = null
        this.socket.emit('auth.logout', null)
    }

    authenticate (user) {
        try {
            this.socket.user = {
                id: user.id,
                name: user.name,
                username: user.username,
                permissions: user.permissions,
                supplier_id: user.supplier_id,
            }
    
            if (env.root === user.username) {
                this.socket.user['root'] = true
                this.log.info('root user logged:', user.username, '- id:', user.id)
                this.log = createLogger(`root:${user.username}:${user.id}`)
            } else {
                this.log.info('user logged:', user.username, '- id:', user.id)
                this.log = createLogger(`${user.username}:${user.id}`)
            }
    
            this.app.users[user.id] = {
                user: this.socket.user,
                socket: this.socket
            }
    
            this.socket.emit('auth.user', {
                token: jwt.sign({user_id: user.id}, env.secret, { expiresIn: '1d'}),
                user: this.socket.user
            })
        } catch (e) {
            this.socket.emit('auth.logout', null)
            this.log.error(e)
        }
    }

    async restore (token) {
        this.log.info('user try restore:', token)
        try {
            let data = jwt.decode(token, env.secret)
            if (!data) return this.socket.emit('auth.logout', null)
            let [user] = await this.sql`SELECT * from users WHERE id=${data.user_id}`
            if (!user) {
                this.log.warn('user restore not found:', data.id)
                return this.socket.emit('auth.logout', null)
            }
            this.authenticate(user)
            this.socket.emit('auth.restored')
        } catch (e) {
            this.socket.emit('auth.logout', null)
            this.log.error(e)
        }
    }
}

module.exports = Api

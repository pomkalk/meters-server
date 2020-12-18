const { createLogger } = require('../logger')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const env = require('../env')
const permissions = require('../../permissions')
const BaseApi = require('./base')


class LoginApi extends BaseApi {
    init () {
        this.setLogger('auth')

        this.socket.on('disconnect', () => {
            if (this.socket.user) {
                this.log.info('logout')
                delete this.app.users[this.socket.user.id]
                this.socket.user = null
                this.setLogger('auth')
                this.emitEvent('event.users-updated')
            }
            this.log.info('socket disconnected:', this.socket.id)
        })
        this.socket.on('auth.login', this.login.bind(this))
        this.socket.on('auth.logout', this.logout.bind(this))
        this.socket.on('auth.restore', this.restore.bind(this))

        
        this.bindAuth('auth.change-password', this.authChangePassword)
    }

    async authChangePassword (data) {
        try {
            const [user] = await this.sql`SELECT * from users WHERE id=${this.socket.user.id}`
            if (!user) {
                this.log.warn('user not founded:', this.socket.user)
                return this.socket.emit('auth.change-password-error', [{ name: 'pass_old', errors: ['Пользователь не найден.']}])
            }
            let validator = new RegExp(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
            if (!validator.test(data.pass_new)) {
                this.log.warn('Bad password validation')
                return this.socket.emit('auth.change-password-error', [{name: 'pass_new', errors: ['Пароль должен быть не короче 8 символов и содержать одну букву и одну цифру.']} ])
            }
            if (!bcrypt.compareSync(data.pass_old, user.password)) {
                this.log.warn('bad user old password')
                return this.socket.emit('auth.change-password-error', [{ name: 'pass_old', errors: ['Неверный пароль.']}])
            }
            let pass = bcrypt.hashSync(data.pass_new, 10)
            await this.sql`UPDATE users SET password=${pass} WHERE id=${this.socket.user.id}`
            this.log.info('user password updated')
            return this.socket.emit('auth.change-password-ok')
        } catch (e) {
            this.log.error('user password update error', e)
            this.socket.emit('auth.change-password-error', [{ name: 'pass_old', errors: ['Ошибка пользователя']}])
            this.socket.emit('auth.msg', 'Произошла ошибка обновления пароля пользователя.')
        }
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

    async logout (data) {
        this.log.info('logout')
        await this.sql`UPDATE users SET last_online=NOW() WHERE id=${this.socket.user.id}`
        this.setLogger('auth')
        this.socket.leave('logged')
        delete this.app.users[this.socket.user.id]
        this.socket.user = null
        this.socket.emit('auth.logout', null)
        this.emitEvent('event.users-updated')
    }

    authenticate (user) {
        try {
            const logged = this.initUser(user)
            this.socket.user = logged
    
            if (env.root === user.username) {
                this.log.info('root user logged:', user.username, '- id:', user.id)
                this.setLogger(`root:${user.username}:${user.id}`)
            } else {
                this.log.info('user logged:', user.username, '- id:', user.id)
                this.setLogger(`${user.username}:${user.id}`)
            }
    
            this.app.users[user.id] = {
                user: this.socket.user,
                socket: this.socket
            }
    
            this.socket.join('logged')

            this.socket.emit('auth.user', {
                token: jwt.sign({user_id: user.id}, env.secret, { expiresIn: '1d'}),
                user: this.socket.user
            })

            this.socket.emit('config.permissions', permissions.get())

            this.emitEvent('event.users-updated')
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

module.exports = LoginApi

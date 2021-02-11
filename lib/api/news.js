const { createLogger } = require('../logger')
const BaseApi = require('./base')
const permissions = require('../../permissions')
const env = require('../env')
const axios = require('axios')

class NewsApi extends BaseApi {
    init () {
        this.setLogger('news')

        this.bindAuth('news.data.get', this.getNews, 'news')
        this.bindAuth('news.message.get', this.getMessage, 'news')
        this.bindAuth('news.add', this.addNews, 'news')
        this.bindAuth('news.delete', this.deleteNews, 'news')
        this.bindAuth('news.edit.get', this.editNews, 'news')
        this.bindAuth('news.edit.update', this.editUpdateNews, 'news')
        this.bindAuth('news.notification.send', this.sendNotification, 'news')
    }

    async sendNotification (data) {
        let devices = await this.sql`SELECT DISTINCT expo FROM devices WHERE news = true`
        let udevices = devices.map(x=>{
            return {
                to: x.expo,
                title: data.title,
                body: data.body,
                data: { action: "meters"},
                channelId: 'uezmeters'
            }
        })
        let m = Math.ceil(udevices.length/100)
        for (let i=0;i<m;i++) {
            let res = await axios.post('https://exp.host/--/api/v2/push/send', udevices.splice(0, 100))
            let data = res.data.data
            for (let i=0;i<data.length;i++) {
                if (data[i].status === 'error') {
                    if (data[i].details.error === 'DeviceNotRegistered') {
                        await this.sql`UPDATE devices SET news=false WHERE expo=${devices[i].expo}`
                    }
                }
            }
        }
    }

    async editUpdateNews (data) {
        try {
            await this.sql`UPDATE news SET title=${data.title}, body=${data.body}, updated_at=NOW() WHERE id=${data.id}`
            this.emitEvent('event.news-updated')
            this.socket.emit('msg', { type: 'success', message: `Новость обновлена`})
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка загрузки новости.')
        }
    }

    async editNews (id) {
        try {
            let [res] = await this.sql`SELECT * FROM news WHERE id=${id}`
            this.socket.emit('news.edit', res)
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка загрузки новости.')
        }
    }

    async deleteNews (id) {
        try {
            await this.sql`UPDATE news SET deleted_at = NOW() WHERE id=${id}`
            this.emitEvent('event.news-updated')
            this.socket.emit('msg', { type: 'success', message: `Новость удалена`})
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка удаления новости.')
        }
    }

    async addNews (data) {
        try {
            let [news] = await this.sql`INSERT INTO news ${ this.sql({...data, user_id: this.socket.user.id}, "title", "body", "user_id") } RETURNING *`
            if (data.notify) {
                let devices = await this.sql`SELECT DISTINCT expo FROM devices WHERE news = true`
                let udevices = devices.map(x=>{
                    return {
                        to: x.expo,
                        title: data.title,
                        body: data.body.slice(0, 40)+'...',
                        data: { action: "news", id: news.id },
                        channelId: 'uezmeters'
                    }
                })
    
                let m = Math.ceil(udevices.length/100)
                for (let i=0;i<m;i++) {
                    let res = await axios.post('https://exp.host/--/api/v2/push/send', udevices.splice(0, 100))
                    let data = res.data.data
                    for (let i=0;i<data.length;i++) {
                        if (data[i].status === 'error') {
                            if (data[i].details.error === 'DeviceNotRegistered') {
                                await this.sql`UPDATE devices SET news=false WHERE expo=${devices[i].expo}`
                            }
                        }
                    }
                }
            }
            
            this.emitEvent('event.news-updated')
            this.socket.emit('msg', { type: 'success', message: `Новость добавлена`})
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка сохранения новости.')
        }
    }

    async getMessage (id) {
        try {
            let [res] = await this.sql`SELECT n.id, n.title,n.body, u.name as author, n.updated_at
            FROM news as n
            LEFT JOIN users as u ON u.id=n.user_id
            WHERE n.id=${id}`
            this.socket.emit('news.message', res)
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка получения новости.')
        }
    }

    async getNews (params) {
        try {
            const [[total], data] = await Promise.all([
                this.sql`SELECT COUNT(*) FROM news`,
                this.sql`SELECT n.id, n.title, CASE WHEN LENGTH(n.body)>40 THEN left(n.body, 40)||'...' ELSE n.body END as body, u.name as author, n.created_at
                    FROM news as n
                    LEFT JOIN users as u ON u.id=n.user_id
                    WHERE n.deleted_at IS NULL
                    ORDER BY n.created_at DESC`
            ])
            this.socket.emit('news.data', {
                data,
                page: params.page,
                pageSize: params.pageSize,
                total: total.count
            })
        } catch (e) {
            this.log.error(e)
            this.emitError('Ошибка получения новостей.')
        }
    }


}

module.exports = NewsApi

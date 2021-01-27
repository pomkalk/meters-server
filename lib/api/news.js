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
        console.log({...data, author: this.socket.user.id})
        try {
            let [news] = await this.sql`INSERT INTO news ${ this.sql({...data, user_id: this.socket.user.id}, "title", "body", "user_id") } RETURNING *`
            if (data.notify) {
                let devices = await this.sql`SELECT DISTINCT expo FROM devices WHERE news = true`
                devices = devices.map(x=>{
                    return {
                        to: x.expo,
                        title: data.title,
                        body: data.body.slice(0, 40),
                        data: { action: "news", id: news.id }
                    }
                })
    
                let m = Math.ceil(devices.length/100)
                for (let i=0;i<m;i++) {
                    axios.post('https://exp.host/--/api/v2/push/send', devices.splice(0, 100))
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
                this.sql`SELECT n.id, n.title, CASE WHEN LENGTH(n.body)>40 THEN left(n.body, 40)||'...' ELSE n.body END as body, u.name as author, n.updated_at
                    FROM news as n
                    LEFT JOIN users as u ON u.id=n.user_id
                    WHERE n.deleted_at IS NULL
                    ORDER BY n.updated_at DESC`
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
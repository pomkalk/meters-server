const BaseApi = require('./base')


class SubscribeApi extends BaseApi {
    init () {
        this.subscribes = {}
        this.bindAuth('subscribe', this.subscribe)
        this.bindAuth('unsubscribe', this.unsubscribe)
        this.socket.on('disconnect', () => {
            this.subscribes = {}
        })
    }



    subscribe (event) {
        if (this.subscribes[event]) {
            this.subscribes[event] += 1
        } else {
            this.subscribes[event] = 1
        }
        this.socket.join(event)
        this.log.info('subscribe to:', event)
        console.log(this.subscribes)
    }

    unsubscribe (event) {
        if (this.subscribes[event]) {
            this.subscribes[event] -= 1
            if (this.subscribes[event] <0 ) { 
                this.subscribes[event] = 0
            }
        }
        if (this.subscribes[event] === 0) {
            this.socket.leave(event)
            this.log.info('unsubscribe from:', event)
        }
        console.log(this.subscribes)
    }
}

module.exports = SubscribeApi

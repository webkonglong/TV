import Event from './event.js'

const socket = {
  socket: null, // socket name
  marketName: null, // marketName
  INTERVAL: '0', // interval
  DATA_LIMIT: 5, // data_limit
  intervalObj: null, // 定时器的名字
  lastMarke: null,
  openSocket (options, market, history) {
    this.options = options
    this.marketName = market
    if (this.lastMarke) {
      !history && this.sendWsRequest({
        args: [this.lastMarke],
        cmd: 'unsub'
      })
      this.sendWsRequest(this.options)
      !history && this.sendWsRequest({
        args: [this.marketName],
        cmd: 'sub',
        id : '1621570e-78a8-4413-997a-eedced6c55e0'
      })
    } else {
      this.lastMarke = market
      this.socketOpen(options)
    }
  },
  socketOpen () {
    this.socket = new WebSocket('wss://api.fcoin.com/v2/ws')
    this.socket.onopen = () => {
      this.sendWsRequest(this.options)
      this.sendWsRequest({
        args: [this.marketName],
        cmd: 'sub',
        id : '1621570e-78a8-4413-997a-eedced6c55e0'
      })
    }
    this.socket.onmessage = resp => {
      this.message(resp)
    }
    this.socket.onclose = () => {
      this.close()
    }
    this.socket.onerror = err => {
      this.error(err)
    }
  },
  error (err) {
    console.log(err, 'depth-socket::error')
  },
  close () {
    this.socketOpen()
    console.log('depth-socket::close')
  },
  message (resp) {
    const data = JSON.parse(resp.data.replace(/\r/g, '').replace(/\n/g, ''))
    this.lastMarket = this.marketName
    Event.emit('realTime', data)
    Event.emit('data', data)
  },
  checkSendMessage (options) {
    let checkTimes = 10
    let i = 0
    this.intervalObj = setInterval(() => {
      i += 1
      if (this.socket.readyState === 1) {
        // ...
        this.socket.send(options)
        clearInterval(this.intervalObj)
        return
      }

      if (i >= checkTimes) {
        clearInterval(this.intervalObj)
        console.log('send post_data_str timeout.')
      }
    }, 500)
  },
  sendWsRequest (options) {
    switch (this.socket.readyState) {
      case 0:
        this.checkSendMessage(JSON.stringify(options))
        break
      case 1:
        this.socket.send(JSON.stringify(options))
        break
      case 2:
        console.log('ws关闭状态')
        break
      case 3:
        this.socketOpen()
        break
      default:
        console.log('ws未知错误')
    }
  }
}

export default socket
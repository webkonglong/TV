import socket from './socket.js';
import Event from './event.js'
let historyTime = 0 // 历史数据 第一条数据的 时间撮  往前加载历史数据需要 这个时间撮
let lastResolution = null // 上一次的 K线周期


function dtFormat (time) {
    const date = new Date(time)
    const Y = date.getFullYear()
    const M = (date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1)
    const D = (date.getDate() < 10 ? `0${date.getDate()}` : date.getDate())
    const h = (date.getHours() < 10 ? `0${date.getHours()}` : date.getHours())
    const m = (date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes())
    const s = (date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds())
    return `${Y}-${M}-${D} ${h}:${m}:${s}`
  }

var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) { if (b.hasOwnProperty(p)) { d[p] = b[p]; } } };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

function logMessage (message) {
  console.log('%c ' + message,'background:#42c02e;color:#fff')
}

function getErrorMessage (error) {
  if (error === undefined) {
    return ''
  } else if (typeof error === 'string') {
    return error
  }

  return error.message
}

/*extractField*/

function extractField (data, field, arrayIndex) {
  const value = data[field]
  return Array.isArray(value) ? value[arrayIndex] : value
}

/*SymbolsStorage*/

class SymbolsStorage {
  constructor (datafeedUrl, datafeedSupportedResolutions, requester) {
    this._exchangesList = ['NYSE', 'FOREX', 'AMEX']
    this._symbolsInfo = {}
    this._symbolsList = []
    this._datafeedUrl = datafeedUrl
    this._datafeedSupportedResolutions = datafeedSupportedResolutions
    this._requester = requester
    this._readyPromise = this._init()
    this._readyPromise.catch(error => {
      console.error(`SymbolsStorage: 不能初始化, error= ${error.toString()}`)
    })
  }
  // 注意 这个函数不考虑符号的交换。
  resolveSymbol (symbolName) {
    return this._readyPromise.then(() => {
      return this._symbolsInfo[symbolName] === undefined ? Promise.reject('无效符号') : Promise.resolve(this._symbolsInfo[symbolName])
    })
  }

  _init () {
    const promises = [];
    const alreadyRequestedExchanges = {}

    for (let i = 0; i < this._exchangesList.length; i+= 1) {
      if (alreadyRequestedExchanges[this._exchangesList[i]]) {
        continue
      }

      alreadyRequestedExchanges[this._exchangesList[i]] = true
    }

    return Promise.all(promises).then(() => {
      this._symbolsList.sort()
    })
  }
}

/*extractField$1*/
function extractField$1(data, field, arrayIndex) {
  return Array.isArray(data[field]) ? data[field][arrayIndex] : data[field]
}

function defaultConfiguration () {
  return {
    supports_search: false,
    supports_group_request: true,
    supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '720', '1D', '3D', '1W', '1M'],
    supports_marks: false,
    supports_timescale_marks: false
  }
}

/*报价提供者*/
class QuotesProvider {
  constructor (datafeedUrl, requester) {
    this._datafeedUrl = datafeedUrl
    this._requester = requester
  }

  getQuotes (symbols) {
    return new Promise((resolve, reject) => {
      this._requester.sendRequest(this._datafeedUrl, 'quotes', {symbols: symbols}).then(response => {
        if (response.s === 'ok') {
          resolve(response.d)
        } else {
          reject(response.errmsg)
        }
      }).catch(error => {
        reject(`network error: ${getErrorMessage(error)}`)
      })
    })
  }
}


/*请求*/

class Requester {
  constructor (headers) {
    if (headers) {
      this._headers = headers
    }
  }

  sendRequest (datafeedUrl, urlPath, params) {
    if (params !== undefined) {
      const paramKeys = Object.keys(params)
      if (paramKeys.length !== 0) {
        urlPath += '?';
      }

      urlPath += paramKeys.map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key].toString());
      }).join('&')
    }

    const options = {credentials: 'same-origin'}

    if (this._headers !== undefined) {
      options.headers = this._headers
    }

    return fetch(`${datafeedUrl}/${urlPath}`, options).then(response => response.text()).then(responseTest => JSON.parse(responseTest))
  }
}

/*UDFCompatibleDatafeedBase*/

export default class UDFCompatibleDatafeedBase {
  constructor (datafeedURL, quotesProvider, requester, updateFrequency) {
    if (updateFrequency === void 0) {
      updateFrequency = 10 * 1000
    }
    this._configuration = defaultConfiguration()
    this._symbolsStorage = null
    this._datafeedURL = datafeedURL
    this._requester = requester || new Requester()

    this._quotesProvider = quotesProvider || new QuotesProvider()

    this._setupWithConfiguration(defaultConfiguration())
  }

  onReady (callback) {
    callback(this._configuration)
  }

  getQuotes (symbols, onDataCallback, onErrorCallback) {
    this._quotesProvider.getQuotes(symbols).then(onDataCallback).catch(onErrorCallback)
  }

  subscribeQuotes (symbols, fastSymbols, onRealtimeCallback, listenerGuid) {
  }

  unsubscribeQuotes (listenerGuid) {
  }

  calculateHistoryDepth (resolution, resolutionBack, intervalBack) {
    return undefined
  }

  getMarks (symbolInfo, startDate, endDate, onDataCallback, resolution) {
    if (!this._configuration.supports_marks) {
      return
    }

    const requestParams = {
      symbol: symbolInfo.ticker || '',
      from: startDate,
      to: endDate,
      resolution: resolution
    }

    this._send('marks', requestParams).then((response) => {
      const result = []
      if (!Array.isArray(response)) {
        for (let i = 0; i < response.id.length; i += 1) {
          result.push({
            id: extractField$1(response, 'id', i),
            time: extractField$1(response, 'time', i),
            color: extractField$1(response, 'color', i),
            text: extractField$1(response, 'text', i),
            label: extractField$1(response, 'label', i),
            labelFontColor: extractField$1(response, 'labelFontColor', i),
            minSize: extractField$1(response, 'minSize', i)
          })
        }
      }
      onDataCallback(result)
    }).catch(error => {
      logMessage(`UdfCompatibleDatafeed: 请求marks失败 ${getErrorMessage(error)}`)
      onDataCallback([])
    })
  }

  getTimescaleMarks (symbolInfo, startDate, endDate, onDataCallback, resolution) {
    if (!this._configuration.supports_timescale_marks) {
      return
    }

    const requestParams = {
      symbol: symbolInfo.ticker || '',
      from: startDate,
      to: endDate,
      resolution: resolution
    }

    this._send('timescale_marks', requestParams).then(response => {
      const result = []
      if (!Array.isArray(response)) {
        for (let i = 0; i < response.id.length; ++i) {
          result.push({
            id: extractField$1(response, 'id', i),
            time: extractField$1(response, 'time', i),
            color: extractField$1(response, 'color', i),
            label: extractField$1(response, 'label', i),
            tooltip: extractField$1(response, 'tooltip', i),
          })
        }
      }
      onDataCallback(response)
    }).catch(error => {
      logMessage(`UdfCompatibleDatafeed: 请求timescale_marks失败 ${getErrorMessage(error)}`)
      onDataCallback([])
    })
  }

  getServerTime (callback) {
    if (!this._configuration.supports_time) {
      return
    }
    this._send('time').then(response => {
      !isNaN(parseInt(response)) && callback(parseInt(response))
    }).catch(error => {
      logMessage(`UdfCompatibleDatafeed 无法加载服务器时间 error=${getErrorMessage(error)}`)
    })
  }

  resolveSymbol (symbolName, onResolve, onError) {
    onResolve({
      "name": "BTC/USTD",
      "timezone": "Asia/Shanghai",
      "pricescale": 100,
      "minmov": 1,
      "minmov2": 0,
      "ticker": "BTC/USTD",
      "description": "",
      "session": "24x7",
      "type": "bitcoin",
      "exchange-traded": "myExchange",
      "exchange-listed": "myExchange",
      "has_intraday": true,
      "intraday_multipliers": ['1', '3', '5', '15', '30', '60', '240', '360', '1D'],
      "has_weekly_and_monthly": false,
      "has_no_volume": false,
      "regular_session": "24x7"
    })
  }

  getApiTime (resolution) {
    switch (resolution) {
      case '1':
        return 'M1'
      case '3':
        return 'M3'
      case '5':
        return 'M5'
      case '15':
        return 'M15'
      case '30':
        return 'M30'
      case '60':
        return 'H1'
      case '240':
        return 'H4'
      case '360':
        return 'H6'
      case '1D':
        return 'D1'
      default:
        return 'M1'
    }
  }

  getBars (symbolInfo, resolution, rangeStartDate, rangeEndDate, onResult, onError) {
      let history = true
      if (!historyTime || (resolution !== lastResolution)) {
        // 如果更换了k线周期  或者 第一次请求 历史数据 请求历史数据的时间撮 轨道现在
        history = false
        historyTime = window.parseInt((Date.now() / 1000))
      }

      socket.openSocket({
        args: [`candle.${this.getApiTime(resolution)}.btcusdt`, 1441, historyTime],
        cmd: 'req',
        id: '0a0493f7-80d4-4d1a-9d98-6da9ae9d399e'
      }, `candle.${this.getApiTime(resolution)}.btcusdt`, history)
      Event.off('data')

      Event.on('data', data => {
        if (data.data && Array.isArray(data.data)) {
          lastResolution = resolution
          let meta = {noData: false}
          const bars = []
          if (data.data.length) {
            console.log(data.data)
            historyTime = data.data[0].id - 1
            for (let i = 0; i < data.data.length; i += 1) {
              bars.push({
                time: data.data[i].id * 1000,
                close: data.data[i].close,
                open: data.data[i].open,
                high: data.data[i].high,
                low: data.data[i].low,
                volume: data.data[i].count
              })
            }
          } else {
            meta = {noData: true}
          }
          onResult(bars, meta)
        }
      })
  }

  subscribeBars (symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
    Event.off('realTime')
    Event.on('realTime', data => {
      if (Object.prototype.toString.call(data) === '[object Object]' && data.hasOwnProperty('open')) {
        console.log(dtFormat(data.id * 1000), data)
        onTick({
          time: data.id * 1000,
          close: data.close,
          open: data.open,
          high: data.high,
          low: data.low,
          volume: data.count
        })
      }
    })
  }

  unsubscribeBars (listenerGuid) {
  }

  _send (urlPath, params) {
    return this._requester.sendRequest(this._datafeedURL, urlPath, params)
  }

  _setupWithConfiguration (configurationData) {
    this._configuration = configurationData
    if (configurationData.exchanges === undefined) {
      configurationData.exchanges = []
    }

    if (!configurationData.supports_search && !configurationData.supports_group_request) {
      throw new Error('Unsupported datafeed 配置。必须支持搜索或支持组请求')
    }

    if (configurationData.supports_group_request || !configurationData.supports_search) {
      this._symbolsStorage = new SymbolsStorage(this._datafeedURL, configurationData.supported_resolutions || [], this._requester);
    }

    logMessage(`初始化的 ${JSON.stringify(configurationData)}`)
  }
}

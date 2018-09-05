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

/*历史数据提供函数*/
class HistoryProvider {
  constructor (datafeedUrl, requester) {
    this._datafeedUrl = datafeedUrl
    this._requester = requester
  }

  getBars (symbolInfo, resolution, rangeStartDate, rangeEndDate) {
    const requestParams = {
      symbol: symbolInfo.ticker || '',
      resolution: resolution,
      from: rangeStartDate,
      to: rangeEndDate
    }

    return new Promise((resolve, reject) => {
      this._requester.sendRequest(this._datafeedUrl, 'history', requestParams).then(response => {
        if (response.s !== 'ok' && response.s !== 'no_data') {
          reject(response.errmsg)
          return
        }

        const bars = []
        const meta = {noData: false}

        if (response.s === 'no_data') {
          meta.noData = true
          meta.nextTime = response.nextTime
        } else {
          const volumePresent = response.v !== undefined
          const ohlPresent = response.o !== undefined
          for (let i = 0; i < response.t.length; i += 1) {
            const barValue = {
              time: response.t[i] * 1000,
              close: Number(response.c[i]),
              open: Number(response.c[i]),
              high: Number(response.c[i]),
              low: Number(response.c[i])
            }

            if (ohlPresent) {
              barValue.open = Number(response.o[i])
              barValue.high = Number(response.h[i])
              barValue.low = Number(response.l[i])
            }

            if (volumePresent) {
              barValue.volume = Number(response.v[i])
            }
            bars.push(barValue)
          }
        }

        resolve({bars: bars, meta: meta})
      }).catch(reason => {
        const reasonString = getErrorMessage(reason)
        console.warn(`HistoryProvider: 获取数据失败, 失败原因===${reasonString}`)
        reject(reasonString)
      })
    })
  }
}

/*数据脉冲提供函数*/
class DataPulseProvider {
  constructor (historyProvider, updateFrequency) {
    this._subscribers = {}
    this._requestsPending = 0
    this._historyProvider = historyProvider
    console.log('DataPulseProviderDataPulseProviderDataPulseProvider')
    setInterval(this._updateData.bind(this), updateFrequency)
  }

  subscribeBars (symbolInfo, resolution, newDataCallback, listenerGuid) {
    if (this._subscribers.hasOwnProperty(listenerGuid)) {
      return
    }
    console.log(symbolInfo, resolution, newDataCallback, listenerGuid, 'xxx')
    this._subscribers[listenerGuid] = {
      lastBarTime: null,
      listener: newDataCallback,
      resolution: resolution,
      symbolInfo: symbolInfo
    }

    console.log(listenerGuid, 'newDataCallback')

    logMessage(`DataPulseProvider 订阅 # ${listenerGuid} - ${symbolInfo.name} ---- ${resolution}`)
  }

  unsubscribeBars (listenerGuid) {
    delete this._subscribers[listenerGuid]
  }

  _updateData () {
    console.log('_updateData', false)
    if (this._requestsPending > 0) {
      return
    }

    this._requestsPending = 0

    const _loop_1 = (listenerGuid) => {
      this._requestsPending += 1
      this._updateDataForSubscriber(listenerGuid).then(() => {
        this._requestsPending -= 1
        logMessage(`${listenerGuid}数据更新成功 待定${this._requestsPending}`)
      }).catch(reason => {
        this._requestsPending -= 1
        logMessage(`${listenerGuid}数据更新失败 失败原因是${getErrorMessage(reason)} 待定${this._requestsPending}`)
      })
    }

    for (let listenerGuid in this._subscribers) {
      _loop_1(listenerGuid)
    }
  }

  _updateDataForSubscriber (listenerGuid) {
    const subscriptionRecord = this._subscribers[listenerGuid]
    const rangeEndTime = window.parseInt((Date.now() / 1000).toString())
    const rangeStartTime = rangeEndTime - periodLengthSeconds(subscriptionRecord.resolution, 10)
    return this._historyProvider.getBars(subscriptionRecord.symbolInfo, subscriptionRecord.resolution, rangeStartTime, rangeEndTime).then(result => {
      console.log(result, 'result')
      this._onSubscriberDataReceived(listenerGuid, result)
    })
  }

  _onSubscriberDataReceived (listenerGuid, result) {
    if (!this._subscribers.hasOwnProperty(listenerGuid)) {
      return
    }

    const bars = result.bars
    if (bars.length === 0) {
      return
    }

    const lastBar = bars[bars.length - 1]
    const subscriptionRecord = this._subscribers[listenerGuid]
    console.log(this._subscribers, 'this._subscribers')
    if (subscriptionRecord.lastBarTime !== null && lastBar.time < subscriptionRecord.lastBarTime) {
      return
    }

    const isNewBar = subscriptionRecord.lastBarTime !== null && lastBar.time > subscriptionRecord.lastBarTime
    // 画线更新可能遗漏一些交易数据（例如，如果k线周期=10秒，并且在上一次更新后5秒启动新栏，则
    // bars的最后5秒交易将丢失。因此，在最后时，我们应该在准备好的时候广播老的bars更新。
    if (isNewBar) {
      if (bars.length < 2) {
        throw new Error('在历史数据里面没有足够的bars进行画线，至少需要2个');
      }

      const previousBar = bars[bars.length - 2]
      subscriptionRecord.listener(previousBar)
    }

    subscriptionRecord.lastBarTime = lastBar.time
    subscriptionRecord.listener(lastBar)
  }
}

/*周期长度*/
function periodLengthSeconds (resolution, requiredPeriodsCount) {
  let daysCount = 0

  switch (resolution) {
    case 'D':
      daysCount = requiredPeriodsCount
      break
    case 'M':
      daysCount = 31 * requiredPeriodsCount
      break
    case 'W':
      daysCount = 7 * requiredPeriodsCount
      break
    default:
      daysCount = requiredPeriodsCount * parseInt(resolution) / (24 * 60)
  }

  return daysCount * 24 * 60 * 60
}

/*引用脉冲*/
class QuotesPulseProvider {
  constructor (quotesProvider) {
    this._subscribers = {}
    this._requestsPending = 0
    this._quotesProvider = quotesProvider
    setInterval(this._updateQuotes.bind(this, 1 /* 快的 */), 10000 /* 快的 */)
    setInterval(this._updateQuotes.bind(this, 0 /* 一般 */), 60000 /* 一般 */)
  }

  subscribeQuotes (symbols, fastSymbols, onRealtimeCallback, listenerGuid) {
    this._subscribers[listenerGuid] = {
      symbols: symbols,
      fastSymbols: fastSymbols,
      listener: onRealtimeCallback
    }
  }

  unsubscribeQuotes (listenerGuid) {
    delete this._subscribers[listenerGuid]
  }

  _updateQuotes (updateType) {
    if (this._requestsPending > 0) {
      return
    }

    const _loop_1 = (listenerGuid) => {
      this._requestsPending += 1
      const subscriptionRecord = this._subscribers[listenerGuid]
      this._quotesProvider.getQuotes(updateType === 1 /*块的*/ ? subscriptionRecord.fastSymbols : subscriptionRecord.symbols).then(data => {
        this._requestsPending -= 1
        if (!this._subscribers.hasOwnProperty(listenerGuid)) {
          return
        }
        subscriptionRecord.listener(data)
        logMessage(`QuotesPulseProvider 数据 ${listenerGuid} 更新成功, type === ${updateType} 待定${this._requestsPending}`)
      }).catch(reason => {
        this._requestsPending -= 1
        logMessage(`QuotesPulseProvider 数据 ${listenerGuid} 更新失败, type === ${updateType};;; 失败原因===${getErrorMessage(reason)} 待定${this._requestsPending}`)
      })
    }

    for (let listenerGuid in this._subscribers) {
      _loop_1(listenerGuid)
    }
  }
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

  searchSymbols (searchString, exchange, symbolType, maxSearchResults) {
    return this._readyPromise.then(() => {
      const weightedResult = []
      const queryIsEmpty = searchString.length === 0
      searchString = searchString.toUpperCase()

      const _loop_1 = (symbolName) => {
        const symbolInfo = this._symbolsInfo[symbolName]

        if ((symbolInfo === undefined) || (symbolType.length > 0 && symbolInfo.type !== symbolType) || (exchange && exchange.length > 0 && symbolInfo.exchange !== exchange)) {
          return "continue"
        }

        const positionInName = symbolInfo.name.toUpperCase().indexOf(searchString)
        const positionInDescription = symbolInfo.description.toUpperCase().indexOf(searchString)

        if (queryIsEmpty || positionInName >= 0 || positionInDescription >= 0) {
          const alreadyExists = weightedResult.some(item => item.symbolInfo === symbolInfo)

          if (!alreadyExists) {
            const weight = positionInName >= 0 ? positionInName : 8000 + positionInDescription
            weightedResult.push({symbolInfo: symbolInfo, weight: weight})
          }
        }
      }

      for (let i = 0; i < this._symbolsList.length; i += 1) {
        _loop_1(this._symbolsList[i])
      }

      return Promise.resolve(weightedResult.sort((item1, item2) => item1.weight - item2.weight).slice(0, maxSearchResults).map(item => ({
        symbol: item.symbolInfo.name,
        full_name: item.symbolInfo.full_name,
        description: item.symbolInfo.description,
        exchange: item.symbolInfo.exchange,
        params: [],
        type: item.symbolInfo.type,
        ticker: item.symbolInfo.name
      })))
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
      promises.push(this._requestExchangeData(this._exchangesList[i]))
    }

    return Promise.all(promises).then(() => {
      this._symbolsList.sort()
    })
  }

  _requestExchangeData (exchange) {
    return new Promise((resolve, reject) => {
      this._requester.sendRequest(this._datafeedUrl, 'symbol_info', {group: exchange}).then(response => {
        try {
          this._onExchangeDataReceived(exchange, response)
        } catch (error) {
          reject(error)
          return
        }

        resolve()
      }).catch(reason => {
        logMessage(`SymbolsStorage: 请求交换数据 ${exchange} failed, reason=${getErrorMessage(reason)}`)
        resolve()
      })
    })
  }

  _onExchangeDataReceived (exchange, data) {
    let symbolIndex = 0

    try {
      const symbolsCount = data.symbol.length
      const tickerPresent = data.ticker !== undefined

      for (; symbolIndex < symbolsCount; ++symbolIndex) {
        const symbolName = data.symbol[symbolIndex]
        const listedExchange = extractField(data, 'exchange-listed', symbolIndex)
        const tradedExchange = extractField(data, 'exchange-traded', symbolIndex)
        const fullName = `${tradedExchange}:${symbolName}`
        const ticker = tickerPresent ? extractField(data, 'ticker', symbolIndex) : symbolName
        const symbolInfo = {
          ticker: ticker,
          name: symbolName,
          base_name: [`${listedExchange}:${symbolName}`],
          full_name: fullName,
          listed_exchange: listedExchange,
          exchange: tradedExchange,
          description: extractField(data, 'description', symbolIndex),
          has_intraday: definedValueOrDefault(extractField(data, 'has-intraday', symbolIndex), false),
          has_no_volume: definedValueOrDefault(extractField(data, 'has-no-volume', symbolIndex), false),
          minmov: extractField(data, 'minmovement', symbolIndex) || extractField(data, 'minmov', symbolIndex) || 0,
          minmove2: extractField(data, 'minmove2', symbolIndex) || extractField(data, 'minmov2', symbolIndex),
          fractional: extractField(data, 'fractional', symbolIndex),
          pricescale: extractField(data, 'pricescale', symbolIndex),
          type: extractField(data, 'type', symbolIndex),
          session: extractField(data, 'session-regular', symbolIndex),
          timezone: extractField(data, 'timezone', symbolIndex),
          supported_resolutions: definedValueOrDefault(extractField(data, 'supported-resolutions', symbolIndex), this._datafeedSupportedResolutions),
          force_session_rebuild: extractField(data, 'force-session-rebuild', symbolIndex),
          has_daily: definedValueOrDefault(extractField(data, 'has-daily', symbolIndex), true),
          intraday_multipliers: definedValueOrDefault(extractField(data, 'intraday-multipliers', symbolIndex), ['1', '5', '15', '30', '60']),
          has_weekly_and_monthly: extractField(data, 'has-weekly-and-monthly', symbolIndex),
          has_empty_bars: extractField(data, 'has-empty-bars', symbolIndex),
          volume_precision: definedValueOrDefault(extractField(data, 'volume-precision', symbolIndex), 0)
        }

        this._symbolsInfo[ticker] = symbolInfo
        this._symbolsInfo[symbolName] = symbolInfo
        this._symbolsInfo[fullName] = symbolInfo
        this._symbolsList.push(symbolName)
      }
    } catch (error) {
      throw new Error(`SymbolsStorage: API 处理交换时错误 ${exchange} symbol #${symbolIndex}(${data.symbol[symbolIndex]}):${error.message}`)
    }
  }
}

/*definedValueOrDefault*/
function definedValueOrDefault (value, defaultValue) {
  return value !== undefined ? value : defaultValue
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
    this._historyProvider = new HistoryProvider(datafeedURL, this._requester)
    this._quotesProvider = quotesProvider || new QuotesProvider()
    this._dataPulseProvider = new DataPulseProvider(this._historyProvider, updateFrequency)
    this._quotesPulseProvider = new QuotesPulseProvider(this._quotesProvider)
    this._configurationReadyPromise = this._requestConfiguration().then(configuration => {
      if (configuration === null) {
        configuration = defaultConfiguration();
      }
      this._setupWithConfiguration(configuration)
    })
  }

  onReady (callback) {
    this._configurationReadyPromise.then(() => {
      callback(this._configuration)
    })
  }

  getQuotes (symbols, onDataCallback, onErrorCallback) {
    this._quotesProvider.getQuotes(symbols).then(onDataCallback).catch(onErrorCallback)
  }

  subscribeQuotes (symbols, fastSymbols, onRealtimeCallback, listenerGuid) {
    this._quotesPulseProvider.subscribeQuotes(symbols, fastSymbols, onRealtimeCallback, listenerGuid)
  }

  unsubscribeQuotes (listenerGuid) {
    this._quotesPulseProvider.unsubscribeQuotes(listenerGuid)
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

  searchSymbols (userInput, exchange, symbolType, onResult) {
    if (this._configuration.supports_search) {
      const params = {
        limit: 30 /* 搜索限制 */,
        query: userInput.toUpperCase(),
        type: symbolType,
        exchange: exchange
      }

      this._send('search', params).then(response => {
        if (response.s !== undefined) {
          logMessage(`UdfCompatibleDatafeed: 搜索失败 error=${response.errmsg}`)
          onResult([])
          return
        }
        onResult(response)
      }).catch(reason => {
        logMessage(`UdfCompatibleDatafeed 搜索symbols=${userInput}失败 失败原因=${getErrorMessage(reason)}`)
        onResult([])
      })
    } else {
      if (this._symbolsStorage === null) {
        throw new Error('UdfCompatibleDatafeed: 配置不一致')
      }
      this._symbolsStorage.searchSymbols(userInput, exchange, symbolType, 30/* 搜索限制 */).then(onResult).catch(onResult.bind(null, []))
    }
  }

  resolveSymbol (symbolName, onResolve, onError) {
    const onResultReady = (symbolInfo) => {
      console.log(symbolInfo, 'xxxxxxxxxxxxxx')
      // onResolve(symbolInfo)
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

    if (!this._configuration.supports_group_request) {
      const params = {
        symbol: symbolName
      }

      this._send('symbols', params).then(response => {
        if (response.s !== undefined) {
          onError('unknown_symbol')
        } else {
          onResultReady(response)
        }
      }).catch(reason => {
        logMessage(`UdfCompatibleDatafeed: resolve Symbol错误 ${getErrorMessage(reason)}`)
        onError('unknown_symbol')
      })
    } else {
      if (this._symbolsStorage === null) {
        throw new Error('UdfCompatibleDatafeed: 配置不一致')
      }

      this._symbolsStorage.resolveSymbol(symbolName).then(onResultReady).catch(onError)
    }
  }

  // args: ['candle.M1.btcusdt'],
  // cmd: 'req',
  // id: '3fc17e59-05ef-4d72-8b0b-bf6c22b500db'
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
    //this._historyProvider.getBars(symbolInfo, resolution, rangeStartDate, rangeEndDate).then(result => {
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
    // onResetCacheNeededCallback()
    // this._dataPulseProvider.subscribeBars(symbolInfo, resolution, onTick, listenerGuid)
    Event.off('realTime')
    
    Event.on('realTime', data => {
      if (Object.prototype.toString.call(data) === '[object Object]' && data.hasOwnProperty('open')) {
        console.log(dtFormat(data.id * 1000))
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
    this._dataPulseProvider.unsubscribeBars(listenerGuid)
  }

  _requestConfiguration () {
    return this._send('config').catch(reason => {
      logMessage(`UdfCompatibleDatafeed: 无法获得数据传送配置-使用默认值  错误=${getErrorMessage(reason)}`)
    })
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

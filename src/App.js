import React, { Component } from 'react';
import UDFCompatibleDatafeedBase from './bundle.js';
import './App.css';
// this.widget.chart() && this.widget.chart().setResolution(e)
let widget = null

class App extends Component {
  state = {
    interval: {
      Realtime: "1R",
      M1: "1",
      M3: "3",
      M5: "5",
      M15: "15",
      M30: "30",
      H1: "60",
      H4: "240",
      H6: "360",
      D1: "1D"
    },
    activeCycle: '1'
  }

  componentDidMount () {
    window.TradingView.onready(() => {
      widget = new window.TradingView.widget({
        fullscreen: true,
  			symbol: 'AAPL',
        timezone: "Asia/Shanghai", // 时区api参考https://b.aitrade.ga/books/tradingview/book/Symbology.html#timezone
  			interval: "1", // 1
  			container_id: "tv_chart_container",
  			datafeed: new UDFCompatibleDatafeedBase("https://demo_feed.tradingview.com"),
  			library_path: "/charting_library/",
  			locale: "zh",
  			drawings_access: { type: 'black', tools: [ { name: "Regression Trend" } ] },
  			disabled_features: ["use_localstorage_for_settings"],
  			preset: "mobile"
      })
    })
  }

  changeInterval (cycle) {
    console.log(cycle)
    if (cycle === '1R') {
      widget.setSymbol('ETC/ETH', 1, () => {
        console.log('切换产品成功了???')
      })
    } else {
      widget.chart().setResolution(cycle)
      this.setState({ activeCycle: cycle })
    }
  }

  render () {
    const { interval, activeCycle } = this.state
    return (
      <div className="App">
        <div id="tv_chart_container"></div>
        <div className="interval">
          {Object.keys(interval).map(item => (
            <div
              key={item}
              onClick={this.changeInterval.bind(this, interval[item])}
              className={activeCycle === interval[item] ? 'active' : ''}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default App;

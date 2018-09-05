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
      D1: "1D",
      INDICATORS: "indicators"
    },
    activeCycle: '1'
  }

  componentDidMount () {
    window.TradingView.onready(() => {
      widget = new window.TradingView.widget({
        fullscreen: true,
  			symbol: 'BTC/USDT',
        timezone: "Asia/Shanghai", // 时区api参考https://b.aitrade.ga/books/tradingview/book/Symbology.html#timezone
  			interval: "1", // 1
  			container_id: "tv_chart_container",
  			datafeed: new UDFCompatibleDatafeedBase("https://demo_feed.tradingview.com"),
  			library_path: "/charting_library/",
  			locale: "zh",
  			// drawings_access: { type: 'black', tools: [ { name: "Regression Trend" } ] },
  			disabled_features: ["context_menus", "use_localstorage_for_settings", "border_around_the_chart", "left_toolbar", "header_symbol_search", "header_resolutions", "header_interval_dialog_button", "show_interval_dialog_on_key_press", "header_chart_type", "header_settings", "header_indicators", "header_compare", "header_undo_redo", "header_fullscreen_button", "header_saveload", "header_screenshot", "timeframes_toolbar", "go_to_date", "volume_force_overlay"],
        enabled_features: ['hide_last_na_study_output'],
        custom_css_url: "chart.css",
  			// preset: "mobile",
        studies_overrides: {
          "volume.volume.color.0": "#ff5353",
          "volume.volume.color.1": "#00b07c",
          "volume.volume.transparency": "53",
          "volume.show ma": true,
          "volume.volume ma.plottype": "line"
        },
        overrides: {
          "mainSeriesProperties.showCountdown": false,
          "volumePaneSize": "small",
          "paneProperties.background": "#1f2b34",
          "paneProperties.vertGridProperties.color": "#202d33",
          "paneProperties.horzGridProperties.color": "#202d33",
          "mainSeriesProperties.candleStyle.upColor": "#00b07c",
          "mainSeriesProperties.candleStyle.downColor": "#ff5353",
          "mainSeriesProperties.candleStyle.drawWick": true,
          "mainSeriesProperties.candleStyle.drawBorder": false,
          "mainSeriesProperties.candleStyle.borderUpColor": "#00b07c",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ff5353",
          "mainSeriesProperties.candleStyle.wickUpColor": "#00b07c",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ff5353",
          "mainSeriesProperties.candleStyle.barColorsOnPrevClose": false,
          "mainSeriesProperties.areaStyle.color1": "rgba(39,56,68,.3)",
          "mainSeriesProperties.areaStyle.color2": "rgba(39,56,68,.3)",
          "mainSeriesProperties.areaStyle.linecolor": "#7291a1",
          "mainSeriesProperties.areaStyle.linestyle": 0,
          "mainSeriesProperties.areaStyle.linewidth": 1,
          "mainSeriesProperties.areaStyle.priceSource": "close"
        }
      })

      widget && widget.onChartReady && widget.onChartReady(() => {
        widget.chart().createStudy('Moving Average', false, false, [7], null, {'Plot.linewidth': 2, 'Plot.color': '#2ba7d6'})
        widget.chart().createStudy('Moving Average', false, false, [30], null, {'Plot.linewidth': 2, 'Plot.color': '#de9f66'})
      })
    })
  }

  changeInterval (cycle) {
    if (cycle === '1R') {
      widget.setSymbol('ETH/USDT', 1, () => {
        console.log('切换产品成功了???')
      })
    } else if (cycle === 'indicators') {
      // 打开指标面板
      widget.chart().executeActionById('insertIndicator')
    } else {
      widget.chart().setResolution(cycle)
      this.setState({ activeCycle: cycle })
    }
  }

  render () {
    const { interval, activeCycle } = this.state
    return (
      <div className="App">
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
        <div id="tv_chart_container"></div>
      </div>
    );
  }
}

export default App;

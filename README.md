项目 需要在服务器下面运行，不可以直接点击 index.html

node npm 下载http-server 后 用http-server -p 8888启动一个服务器。或者别的方法启动一个服务器

项目 各个js文件作用均在index.html引入的时候 有注释。


charting_library文件夹为图表库官方给的文件,不应该经过任何打包工具打包。
换到你们项目里面以后，charting_library文件 更换了路径 需要修改chartConfig.js里面的library_path字段 。 

覆盖k线图默认样式 在charting_library/static/chart.css

charting_library文件夹只可以修改charting_library/static/chart.css文件 别的文件禁止修改。





/******************************************************/
后端websocket接口订阅规范
/******************************************************/

// 取历史数据详解
{args: ["candle.M1.btcusdt", 1441, 1541425959]
cmd: "req"
id: "0a0493f7-80d4-4d1a-9d98-6da9ae9d399e"}

args为参数 
  M1代表一分钟  
  btcusdt代表产品名  
  1441代表多少条历史数据
  1541425959 代表 时间搓   请求的时候 就是从这个时间搓，向前要1441条数据

cmd 行为 值为req 代表取历史数据
id  一个随机数 可要可无

/******************************************************/

// 取实时数据详解
args: ["candle.M1.btcusdt"]
cmd: "sub"
id: "fd0823a5-e16b-4f46-8b68-3fd723beb321"

args为参数 
  M1代表一分钟  
  btcusdt代表产品名  
cmd 行为 值为 sub 代表订阅实时数据
id 一个随机数 可要可无

/******************************************************/

// 取消订阅实时数据 详情
args: ["candle.M1.btcusdt"]
cmd: "unsub"

args为参数 
  M1代表一分钟  
  btcusdt代表产品名  
cmd 行为 值为 unsub 代表取消订阅实时数据

/******************************************************/

修改 websocket请求地址 目录 /websocket.js

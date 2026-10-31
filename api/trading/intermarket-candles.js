// Live OHLC candle history for JIN Cross-Asset Gold Monitor.
// Public Yahoo Finance chart data can be delayed; this endpoint never fabricates candles.
const send = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(body);
};

const ASSETS = [
  { symbol: 'XAUUSD', ticker: 'GC=F' },
  { symbol: 'DXY', ticker: 'DX-Y.NYB' },
  { symbol: 'US10Y', ticker: '^TNX' },
  { symbol: 'US02Y', ticker: '^IRX' },
  { symbol: 'USDJPY', ticker: 'USDJPY=X' },
  { symbol: 'EURUSD', ticker: 'EURUSD=X' },
  { symbol: 'USDCHF', ticker: 'USDCHF=X' },
  { symbol: 'USOIL', ticker: 'CL=F' },
  { symbol: 'XAGUSD', ticker: 'SI=F' },
  { symbol: 'HG', ticker: 'HG=F' },
  { symbol: 'SPX500', ticker: '^GSPC' },
  { symbol: 'BTCUSDT', ticker: 'BTC-USD' }
];
const finite = v => typeof v === 'number' && Number.isFinite(v);
const toCandle = (symbol, timeframe, timestamp, q, i) => {
  const open=q.open?.[i], high=q.high?.[i], low=q.low?.[i], close=q.close?.[i], volume=q.volume?.[i];
  if (![open,high,low,close].every(finite)) return null;
  return { symbol, timeframe, timestamp: new Date(timestamp*1000).toISOString(), open, high, low, close, volume: finite(volume)?volume:0, source:'Yahoo Finance', isSimulated:false };
};
async function fetchCandles(asset, timeframe) {
  const isDaily = timeframe === 'D1';
  const interval = isDaily ? '1d' : '1h';
  const range = isDaily ? '1y' : '3mo';
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(asset.ticker) + '?range=' + range + '&interval=' + interval;
  const response = await fetch(url, { headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 JIN-CrossAsset/1.0'}, signal:AbortSignal.timeout(9000), cache:'no-store' });
  if (!response.ok) throw new Error(asset.symbol + ' provider HTTP ' + response.status);
  const payload=await response.json(), result=payload?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(asset.symbol + ' has no candle timestamps');
  const q=result.indicators?.quote?.[0];
  if (!q) throw new Error(asset.symbol + ' has no OHLC series');
  const raw=result.timestamp.map((t,i)=>toCandle(asset.symbol,isDaily?'D1':'H1',t,q,i)).filter(Boolean);
  if (isDaily) return raw;
  // Aggregate hourly bars into UTC-aligned 4-hour candles.
  const buckets=new Map();
  for (const c of raw) {
    const t=Date.parse(c.timestamp), start=Math.floor(t/14400000)*14400000, key=String(start);
    const prev=buckets.get(key);
    if (!prev) buckets.set(key,{...c,timeframe:'H4',timestamp:new Date(start).toISOString()});
    else {
      prev.high=Math.max(prev.high,c.high); prev.low=Math.min(prev.low,c.low);
      prev.close=c.close; prev.volume=(prev.volume||0)+(c.volume||0);
    }
  }
  return Array.from(buckets.values()).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)).slice(-500);
}
export default async function handler(req,res) {
  if (req.method==='OPTIONS') return send(res,204,{});
  if (req.method!=='GET') return send(res,405,{success:false,error:'Method not allowed. Use GET.'});
  const requested=String(req.query?.symbols||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
  const selected=requested.length?ASSETS.filter(a=>requested.includes(a.symbol)):ASSETS;
  if (!selected.length) return send(res,400,{success:false,error:'No supported symbols requested.'});
  const jobs=selected.flatMap(asset=>['D1','H4'].map(timeframe=>({asset,timeframe})));
  const settled=await Promise.allSettled(jobs.map(j=>fetchCandles(j.asset,j.timeframe)));
  const data={}, errors=[];
  settled.forEach((entry,i)=>{
    const {asset,timeframe}=jobs[i], key=asset.symbol;
    if (!data[key]) data[key]={D1:[],H4:[]};
    if (entry.status==='fulfilled') data[key][timeframe]=entry.value;
    else errors.push({symbol:key,timeframe,message:String(entry.reason?.message||entry.reason).slice(0,180)});
  });
  const counts=Object.values(data).flatMap(v=>[v.D1.length,v.H4.length]);
  return send(res,200,{success:true,provider:'Yahoo Finance chart API',delayed:true,fetchedAt:new Date().toISOString(),data,errors,summary:{symbols:selected.length,successfulSeries:counts.filter(n=>n>0).length,totalSeries:counts.length,unavailableSeries:counts.filter(n=>n===0).length},note:'Public market data may be delayed and is not a guaranteed real-time broker feed.'});
}

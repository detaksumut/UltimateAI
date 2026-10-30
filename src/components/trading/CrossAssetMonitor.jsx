import React, { useEffect, useMemo, useState } from 'react';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';
import { getChartCandles } from '../../services/trading/ChartReader.js';

const ASSETS = [
  { symbol: 'XAUUSD', label: 'GOLD · XAUUSD', group: 'ACUAN UTAMA' },
  { symbol: 'DXY', label: 'US Dollar Index (DXY)', group: 'USD / SUKU BUNGA' },
  { symbol: 'US10Y', label: 'US Treasury Yield 10Y', group: 'USD / SUKU BUNGA' },
  { symbol: 'US02Y', label: 'US Treasury Yield 2Y', group: 'USD / SUKU BUNGA' },
  { symbol: 'USDJPY', label: 'USDJPY', group: 'MATA UANG' },
  { symbol: 'EURUSD', label: 'EURUSD', group: 'MATA UANG' },
  { symbol: 'USDCHF', label: 'USDCHF', group: 'MATA UANG' },
  { symbol: 'USOIL', label: 'WTI Crude Oil', group: 'KOMODITAS' },
  { symbol: 'XAGUSD', label: 'Silver · XAGUSD', group: 'KOMODITAS' },
  { symbol: 'HG', label: 'Copper', group: 'KOMODITAS' },
  { symbol: 'SPX500', label: 'S&P 500', group: 'RISK SENTIMENT' },
  { symbol: 'BTCUSDT', label: 'Bitcoin · BTCUSDT', group: 'RISK SENTIMENT' },
];
const TF = ['D1', 'H4'];
const fmt = v => Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(2) + '%' : '—';
const pearson = (a,b) => {
  const n=Math.min(a.length,b.length); if(n<10)return null;
  const x=a.slice(-n),y=b.slice(-n),mx=x.reduce((s,v)=>s+v,0)/n,my=y.reduce((s,v)=>s+v,0)/n;
  let num=0,dx=0,dy=0;for(let i=0;i<n;i++){const vx=x[i]-mx,vy=y[i]-my;num+=vx*vy;dx+=vx*vx;dy+=vy*vy;}
  return dx&&dy?num/Math.sqrt(dx*dy):null;
};
function summarize(symbol, tf) {
  const result=getChartCandles(symbol,tf,200), candles=result.candles||[];
  if(candles.length<20)return {symbol,tf,status:result.status||'NO_DATA',count:candles.length,freshness:result.freshness||'NO_DATA',trend:'DATA BELUM CUKUP',change:null,returns:[]};
  const closes=candles.map(c=>c.close),last=closes.at(-1),base=closes.at(-6);
  const recent=closes.slice(-5).reduce((s,v)=>s+v,0)/5,prior=closes.slice(-20,-5).reduce((s,v)=>s+v,0)/15;
  const returns=[];for(let i=1;i<closes.length;i++){if(closes[i-1]!==0)returns.push((closes[i]-closes[i-1])/closes[i-1]);}
  return {symbol,tf,status:result.status,count:candles.length,freshness:result.freshness,price:last,change:base?((last-base)/base)*100:null,trend:recent>prior*1.001?'BULLISH':recent<prior*.999?'BEARISH':'SIDEWAYS',returns};
}
export default function CrossAssetMonitor(){
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const unsub=marketDataServiceInstance.subscribe(()=>setRevision(v=>v+1));const timer=setInterval(()=>setRevision(v=>v+1),30000);return()=>{if(typeof unsub==='function')unsub();clearInterval(timer)}},[]);
 const rows=useMemo(()=>ASSETS.map(a=>({...a,readings:TF.map(tf=>summarize(a.symbol,tf))})),[revision]);
 const gold=rows.find(r=>r.symbol==='XAUUSD');
 const correlations=useMemo(()=>Object.fromEntries(rows.filter(r=>r.symbol!=='XAUUSD').map(r=>{const daily=r.readings[0];const corr=gold?pearson(gold.readings[0].returns,daily.returns):null;return[r.symbol,corr]})),[rows]);
 const pill=(value)=>({display:'inline-block',padding:'3px 6px',borderRadius:4,fontSize:9,fontWeight:900,border:'1px solid '+(value==='BULLISH'?'#166534':value==='BEARISH'?'#9f1239':'#334155'),color:value==='BULLISH'?'#4ade80':value==='BEARISH'?'#fb7185':'#cbd5e1',background:value==='BULLISH'?'#052e16':value==='BEARISH'?'#4c0519':'#0f172a'});
 const correlationLabel=v=>!Number.isFinite(v)?'BELUM ADA DATA':v<=-.65?'KUAT BERLAWANAN':v>=.65?'KUAT SEARAH':v<=-.35?'CENDERUNG BERLAWANAN':v>=.35?'CENDERUNG SEARAH':'LEMAH / CAMPURAN';
 return <section style={{marginTop:12,padding:12,border:'1px solid #164e63',borderRadius:8,background:'#06101d',color:'#dbeafe',fontFamily:'Inter,system-ui,sans-serif'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
   <div><h2 style={{margin:0,color:'#67e8f9',fontSize:14,letterSpacing:'.06em'}}>JIN CROSS-ASSET GOLD MONITOR</h2><div style={{fontSize:10,color:'#94a3b8',marginTop:5}}>Pembacaan otomatis D1 + H4 · pembaruan saat data pasar masuk dan tiap 30 detik</div></div>
   <button onClick={()=>setRevision(v=>v+1)} style={{padding:'7px 10px',background:'#082f49',border:'1px solid #0e7490',borderRadius:5,color:'#67e8f9',fontWeight:800,cursor:'pointer'}}>↻ REFRESH DATA</button>
  </header>
  <div style={{marginTop:10,overflowX:'auto'}}>
   <table style={{width:'100%',minWidth:900,borderCollapse:'collapse',fontSize:10}}>
    <thead><tr>{['INSTRUMEN','D1 TREND','D1 Δ 5 BAR','KORELASI D1 vs GOLD','H4 TREND','H4 Δ 5 BAR','DATA D1 / H4'].map(h=><th key={h} style={{padding:8,textAlign:'left',color:'#94a3b8',borderBottom:'1px solid #164e63',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
    <tbody>{rows.map(asset=>{const d=asset.readings[0],h=asset.readings[1],corr=correlations[asset.symbol];return <tr key={asset.symbol}>
     <td style={{padding:8,borderBottom:'1px solid #12283a',fontWeight:800,color:asset.symbol==='XAUUSD'?'#67e8f9':'#e2e8f0'}}>{asset.label}<div style={{fontSize:8,color:'#64748b',marginTop:3}}>{asset.group}</div></td>
     <td style={{padding:8,borderBottom:'1px solid #12283a'}}><span style={pill(d.trend)}>{d.trend}</span></td>
     <td style={{padding:8,borderBottom:'1px solid #12283a',color:(d.change||0)>0?'#4ade80':(d.change||0)<0?'#fb7185':'#cbd5e1'}}>{fmt(d.change)}</td>
     <td style={{padding:8,borderBottom:'1px solid #12283a'}}><div style={{fontWeight:800,color:Number.isFinite(corr)?corr<=-.35?'#4ade80':corr>=.35?'#fb7185':'#cbd5e1':'#fbbf24'}}>{Number.isFinite(corr)?corr.toFixed(2):'—'}</div><div style={{fontSize:8,color:'#94a3b8',marginTop:3}}>{correlationLabel(corr)}</div></td>
     <td style={{padding:8,borderBottom:'1px solid #12283a'}}><span style={pill(h.trend)}>{h.trend}</span></td>
     <td style={{padding:8,borderBottom:'1px solid #12283a',color:(h.change||0)>0?'#4ade80':(h.change||0)<0?'#fb7185':'#cbd5e1'}}>{fmt(h.change)}</td>
     <td style={{padding:8,borderBottom:'1px solid #12283a',color:d.count>=50&&h.count>=50?'#4ade80':'#fbbf24'}}>{d.count} / {h.count} candle · {d.freshness} / {h.freshness}</td>
    </tr>})}</tbody>
   </table>
  </div>
  <div style={{marginTop:10,padding:9,border:'1px solid #854d0e',borderRadius:5,background:'#211608',fontSize:10,lineHeight:1.6,color:'#fcd34d'}}>
   Kualitas data: monitor hanya menghitung tren/korelasi dari candle OHLC yang tersedia di MarketDataService. Jika tertulis DATA BELUM CUKUP atau korelasi “BELUM ADA DATA”, JIN belum menerima riwayat yang memadai untuk instrumen/timeframe itu—bukan berarti instrumen tidak berpengaruh. Korelasi D1 dihitung dari return harian yang tersedia, minimal 10 pasangan; korelasi historis bukan jaminan hubungan masa depan.
  </div>
 </section>;
}

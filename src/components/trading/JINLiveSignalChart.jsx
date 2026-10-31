import React, { useEffect, useMemo, useState } from 'react';
import { marketDataServiceInstance } from '../../services/trading/MarketDataService.js';

const TF_MS = { M5: 300000, M15: 900000, M30: 1800000, H1: 3600000, H4: 14400000, D1: 86400000 };
const TF_FROM_INTERVAL = { '5': 'M5', '15': 'M15', '30': 'M30', '60': 'H1', '240': 'H4', D: 'D1' };
const API = 'http://127.0.0.1:20200/api/trading/ohlc';

function valid(c) {
  return c && [c.open,c.high,c.low,c.close].every(Number.isFinite) &&
    c.high >= Math.max(c.open,c.close,c.low) && c.low <= Math.min(c.open,c.close,c.high) &&
    typeof c.timestamp === 'string' && Number.isFinite(Date.parse(c.timestamp)) &&
    c.isSimulated !== true && c.source === 'MT5_LOCAL_BRIDGE';
}
function trend(candles) {
  if (!Array.isArray(candles) || candles.length < 50) return 'UNKNOWN';
  const closes = candles.map(c => c.close);
  const ema = (values, n) => {
    const k = 2 / (n + 1); let value = values.slice(0,n).reduce((a,b)=>a+b,0)/n;
    for (let i=n;i<values.length;i++) value = values[i]*k + value*(1-k);
    return value;
  };
  const last=closes.at(-1), e9=ema(closes,9), e20=ema(closes,20), e50=ema(closes,50);
  if (last > e20 && e9 > e20 && e20 > e50) return 'BULLISH';
  if (last < e20 && e9 < e20 && e20 < e50) return 'BEARISH';
  return 'SIDEWAYS';
}
function getSignal(series) {
  const required=['H4','H1','M15','M5'];
  if (required.some(tf => !series[tf] || series[tf].length < 50)) return {side:'WAIT', reason:'Menunggu minimal 50 candle valid pada H4, H1, M15, dan M5.'};
  const dirs=Object.fromEntries(required.map(tf=>[tf,trend(series[tf])]));
  const m5=series.M5, last=m5.at(-1), previous=m5.slice(-21,-1);
  if (!last || previous.length < 20) return {side:'WAIT',reason:'Data pemicu M5 belum cukup.'};
  const resistance=Math.max(...previous.map(c=>c.high)), support=Math.min(...previous.map(c=>c.low));
  const bullish=last.close>last.open, bearish=last.close<last.open;
  const breakout=last.close>resistance && bullish;
  const breakdown=last.close<support && bearish;
  const up=dirs.H4==='BULLISH' && dirs.H1==='BULLISH' && dirs.M15==='BULLISH';
  const down=dirs.H4==='BEARISH' && dirs.H1==='BEARISH' && dirs.M15==='BEARISH';
  if (up && breakout) return {side:'BUY',reason:'H4/H1/M15 bullish dan candle M5 mengonfirmasi breakout.',price:last.close, timestamp:last.timestamp};
  if (down && breakdown) return {side:'SELL',reason:'H4/H1/M15 bearish dan candle M5 mengonfirmasi breakdown.',price:last.close,timestamp:last.timestamp};
  return {side:'WAIT',reason:'Konfirmasi empat timeframe belum lengkap atau tidak selaras.',dirs,support,resistance};
}

export default function JINLiveSignalChart({symbol='XAUUSD',interval='60'}) {
  const tf=TF_FROM_INTERVAL[interval] || 'H1';
  const [series,setSeries]=useState({});
  const [error,setError]=useState('');
  const [lastPoll,setLastPoll]=useState(null);
  useEffect(()=>{
    let cancelled=false, busy=false;
    const poll=async()=>{
      if(busy)return; busy=true;
      try {
        const wanted=[...new Set([tf,'M5','M15','H1','H4'])];
        const results=await Promise.all(wanted.map(async timeframe=>{
          const r=await fetch(`${API}?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`,{cache:'no-store'});
          if(!r.ok) throw new Error(`OHLC HTTP ${r.status}`);
          return [timeframe,await r.json()];
        }));
        if(cancelled)return;
        const next={};
        for(const [timeframe,data] of results) {
          next[timeframe]=(data.ok && Array.isArray(data.candles) ? data.candles.filter(valid) : []).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
        }
        // Keep the same validated broker candles available to ChartReader and the
        // advanced analysis modal, not only to this SVG component.
        const allCandles = Object.entries(next).flatMap(([timeframe, rows]) =>
          rows.map(c => ({ ...c, symbol, timeframe, source: 'MT5_LOCAL_BRIDGE', isSimulated: false }))
        );
        if (allCandles.length) {
          marketDataServiceInstance.addBatchCandles(allCandles);
          marketDataServiceInstance.setStatus('CONNECTED', { source: 'MT5_LOCAL_BRIDGE', isSimulated: false });
        } else {
          marketDataServiceInstance.setStatus('DISCONNECTED', { source: 'MT5_LOCAL_BRIDGE', isSimulated: false });
        }
        setSeries(next); setError(''); setLastPoll(new Date().toISOString());
      } catch(e) { if(!cancelled)setError(e?.message||'Sumber OHLC lokal tidak tersedia'); }
      finally { busy=false; }
    };
    poll(); const timer=window.setInterval(poll,5000);
    return ()=>{cancelled=true;window.clearInterval(timer);};
  },[symbol,tf]);
  const candles=series[tf]||[];
  const signal=useMemo(()=>getSignal(series),[series]);
  const latest=candles.at(-1);
  const chartCandles=candles.slice(-100);
  const W=900,H=520,left=18,right=76,top=22,bottom=42;
  const values=chartCandles.flatMap(c=>[c.high,c.low]);
  const min=values.length?Math.min(...values):0, max=values.length?Math.max(...values):1;
  const pad=(max-min)*0.08 || Math.abs(max||1)*0.002;
  const lo=min-pad, hi=max+pad;
  const x=i=>left+(i+0.5)*(W-left-right)/Math.max(chartCandles.length,1);
  const y=v=>top+(hi-v)*(H-top-bottom)/(hi-lo || 1);
  const bodyW=Math.max(2,Math.min(9,(W-left-right)/Math.max(chartCandles.length,1)*0.58));
  const signalTime = signal.timestamp ? Date.parse(signal.timestamp) : NaN;
  const latestTime = latest?.timestamp ? Date.parse(latest.timestamp) : NaN;
  const canShowSignal=signal.side!=='WAIT' && latest && Number.isFinite(signalTime) && Number.isFinite(latestTime) && signalTime >= latestTime && signalTime < latestTime + (TF_MS[tf] || 3600000) && latest.isSimulated!==true;
  return <section style={{height:'100%',minHeight:560,display:'flex',flexDirection:'column',background:'#030812',color:'#cbd5e1',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'9px 12px',borderBottom:'1px solid #142d40',flexWrap:'wrap'}}>
      <strong style={{fontSize:11,color:'#22d3ee',letterSpacing:'.05em'}}>JIN LIVE SIGNAL CHART · {symbol} · {tf}</strong>
      <span style={{fontSize:10,color:canShowSignal?(signal.side==='BUY'?'#34d399':'#f87171'):'#fbbf24',fontWeight:800}}>{canShowSignal?signal.side:'WAIT'}</span>
    </div>
    {error && <div style={{padding:8,color:'#fca5a5',fontSize:10}}>Data feed tidak tersedia: {error}</div>}
    {!chartCandles.length ? <div style={{flex:1,minHeight:450,display:'grid',placeItems:'center',padding:24,textAlign:'center',color:'#fbbf24',fontSize:12}}>
      <div><strong>MENUNGGU DATA CANDLE VALID</strong><p style={{color:'#94a3b8',fontSize:11,lineHeight:1.6}}>Chart lokal hanya menampilkan data pasar yang lolos validasi sumber. Data simulasi tidak ditampilkan. Pastikan penyedia OHLC yang sah terhubung ke LocalRouterServer.</p><small style={{color:'#64748b'}}>Polling: {lastPoll?new Date(lastPoll).toLocaleTimeString():'menunggu'} · {error||'NO_DATA'}</small></div>
    </div> : <>
      <div style={{flex:1,minHeight:420,overflow:'hidden'}}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Candlestick chart ${symbol} ${tf} dengan sinyal JIN`} style={{width:'100%',height:'100%',display:'block',background:'#030812'}}>
          {[0,1,2,3,4,5].map(i=>{const val=hi-(hi-lo)*i/5;return <g key={i}><line x1={left} x2={W-right} y1={y(val)} y2={y(val)} stroke="#142033" strokeDasharray="3 4"/><text x={W-right+7} y={y(val)+4} fill="#94a3b8" fontSize="11">{val.toFixed(symbol==='XAUUSD'?2:4)}</text></g>})}
          {chartCandles.map((c,i)=>{const rising=c.close>=c.open, color=rising?'#10b981':'#f43f5e', bx=x(i), by=Math.min(y(c.open),y(c.close)), bh=Math.max(1,Math.abs(y(c.open)-y(c.close)));return <g key={c.timestamp}><line x1={bx} x2={bx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.2"/><rect x={bx-bodyW/2} y={by} width={bodyW} height={bh} fill={color}/></g>})}
          {canShowSignal && <g><line x1={left} x2={W-right} y1={y(signal.price)} y2={y(signal.price)} stroke={signal.side==='BUY'?'#34d399':'#fb7185'} strokeDasharray="5 4"/><rect x={x(chartCandles.length-1)-24} y={signal.side==='BUY'?y(latest.low)+10:y(latest.high)-30} width="48" height="22" rx="4" fill={signal.side==='BUY'?'#059669':'#e11d48'}/><text x={x(chartCandles.length-1)} y={(signal.side==='BUY'?y(latest.low)+25:y(latest.high)-15)} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">{signal.side}</text></g>}
          <text x={left} y={H-14} fill="#64748b" fontSize="10">{chartCandles[0]?.timestamp?new Date(chartCandles[0].timestamp).toLocaleString():''}</text>
          <text x={W-right-130} y={H-14} fill="#64748b" fontSize="10">{latest?.timestamp?new Date(latest.timestamp).toLocaleString():''}</text>
        </svg>
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:'9px 12px',borderTop:'1px solid #142d40',fontSize:10}}>
        <span>Harga: <b>{latest?.close?.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})||'—'}</b></span>
        <span>Jumlah candle: <b>{candles.length}</b></span>
        <span>Empat TF: <b>{['H4','H1','M15','M5'].map(t=>`${t} ${trend(series[t]||[])}`).join(' · ')}</b></span>
      </div>
      <div style={{padding:'9px 12px',background:'#06101d',borderTop:'1px solid #142d40',fontSize:10,lineHeight:1.6}}>
        <b style={{color:canShowSignal?(signal.side==='BUY'?'#34d399':'#fb7185'):'#fbbf24'}}>JIN {canShowSignal?signal.side:'WAIT'}</b> — {signal.reason}
        <div style={{color:'#64748b',marginTop:3}}>Sumber dibatasi pada candle berlabel MT5_LOCAL_BRIDGE dan bukan simulasi. Sinyal hanya muncul jika data valid tersedia pada empat timeframe. Polling terakhir: {lastPoll?new Date(lastPoll).toLocaleTimeString():'—'}.</div>
      </div>
    </>}
  </section>;
}

/** MIE v1 backend — ANALISIS MAKRO & TEKNIKAL. Angka hanya dari provider nyata. */
import fs from 'fs';
import path from 'path';
import { retrieveMarketData } from './marketRetrievalRouter.mjs';
import { getMarketSeries } from './MarketDataService.mjs';
const SYMBOL_MAP = { IHSG:{q:'ihsg',p:'market.ihsg',c:'IDX'}, USDIDR:{q:'usd_idr',p:'market.usd_idr',c:'IDR'}, 'USD/IDR':{q:'usd_idr',p:'market.usd_idr',c:'IDR'}, DXY:{q:'dxy',p:'market.dxy',c:'INDEX'}, US10Y:{q:'us10y',p:'market.us10y',c:'PERCENT'}, GOLD:{q:'gold',p:'market.gold',c:'USD'}, 'XAU/USD':{q:'gold',p:'market.gold',c:'USD'}, WTI:{q:'wti',p:'market.wti',c:'USD'}, BTC:{q:'bitcoin',p:'market.bitcoin',c:'USD'} };
const snapPath = () => path.resolve(process.cwd(), 'storage/vault/macro_snapshot.json');
export function getMacroSnapshot() {
  try { const p = snapPath(); if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf-8')); } catch {}
  return { pce:{actual:null,forecast:null}, nfp:{actual:null,forecast:null}, foreignFlow:{direction:'UNKNOWN',valueRpMiliar:null}, updatedAt:null };
}
export function saveMacroSnapshot(patch={}) {
  const prev = getMacroSnapshot() || {};
  const next = { pce:{...(prev.pce||{}),...((patch&&patch.pce)||{})}, nfp:{...(prev.nfp||{}),...((patch&&patch.nfp)||{})}, foreignFlow:{...(prev.foreignFlow||{}),...((patch&&patch.foreignFlow)||{})}, updatedAt:new Date().toISOString() };
  try { fs.mkdirSync(path.dirname(snapPath()),{recursive:true}); fs.writeFileSync(snapPath(),JSON.stringify(next,null,2)); } catch(e){ return {ok:false,error:e.message}; }
  return { ok:true, ...next };
}
function quoteOf(r, cur) {
  if (!r||!r.ok||!r.result||!Number.isFinite(Number(r.result.price))) return { last:null, changePct:null, dataStatus:'UNAVAILABLE', source:(r&&r.canonical&&r.canonical.name)||'—', sourceUrl:null, currency:cur||null, error:(r&&r.message)||'provider tidak terjangkau' };
  const v=r.result; return { last:Number(v.price), changePct:Number.isFinite(Number(v.change24h))?Number(v.change24h):null, dataStatus:'LIVE', source:v.source||'—', sourceUrl:v.sourceUrl||null, currency:v.currency||cur||null };
}
function rsi14(c){ if(!Array.isArray(c)||c.length<15) return null; let g=0,l=0; for(let i=c.length-14;i<c.length;i++){ const d=c[i]-c[i-1]; if(d>=0)g+=d; else l-=d; } const rs=l===0?100:g/l; return 100-100/(1+rs); }
function sma(a,n){ if(!Array.isArray(a)||a.length<n) return null; return a.slice(-n).reduce((x,y)=>x+y,0)/n; }
function buildTech(ok, series, lastPx) {
  const none=(note)=>({rsi14:null,momentum:'UNKNOWN',trend:'UNKNOWN',resistance:[],support:[],dataStatus:'UNAVAILABLE',note});
  if(!ok||!series||!Array.isArray(series.points)||series.points.length<20) return none('Seri harga live tidak tersedia.');
  const cl=series.points.map((p)=>Number(p.value)).filter((v)=>Number.isFinite(v));
  if(cl.length<20) return none('Seri harga terlalu pendek.');
  const rsi=rsi14(cl); const s20=sma(cl,20); const s50=sma(cl,Math.min(50,cl.length));
  const last=Number.isFinite(Number(lastPx))?Number(lastPx):cl[cl.length-1];
  const mo=rsi==null?'UNKNOWN':rsi>=70?'OVERBOUGHT':rsi<=30?'OVERSOLD':rsi>=55?'BULLISH':rsi<=45?'BEARISH':'NEUTRAL';
  const tr=s20!=null&&s50!=null?(last>s20&&s20>=s50?'UPTREND':last<s20&&s20<=s50?'DOWNTREND':'SIDEWAYS'):'UNKNOWN';
  const w=cl.slice(-60); const hi=Math.max(...w); const lo=Math.min(...w);
  return {rsi14:rsi!=null?Number(rsi.toFixed(1)):null,momentum:mo,trend:tr,resistance:[hi,hi*1.02].map((v)=>Number(v.toFixed(2))),support:[lo,lo*0.98].map((v)=>Number(v.toFixed(2))),dataStatus:'COMPUTED_FROM_LIVE_SERIES',note:`Dihitung dari ${cl.length} titik live.`};
}
// MIE v1 — ambil basket market paralel, teknikal dari seri live, makro jujur.
export async function getMarketAnalysis(symRaw = 'IHSG') {
  const sym=String(symRaw||'IHSG').toUpperCase();
  const norm=SYMBOL_MAP[sym]||SYMBOL_MAP.IHSG; const label=SYMBOL_MAP[sym]?sym:'IHSG';
  const qs=[norm.q,'ihsg','usd_idr','dxy','us10y','gold','wti','bitcoin'];
  const st=await Promise.all(qs.map((q)=>retrieveMarketData(q).catch((e)=>({ok:false,message:e.message}))));
  const R=(i,c)=>quoteOf(st[i],c);
  const mainQ=R(0,norm.c),ihsgQ=R(1),usdidrQ=R(2),dxyQ=R(3),us10yQ=R(4),goldQ=R(5),wtiQ=R(6),btcQ=R(7);
  let series=null,sok=false,serr=null;
  try{ const r=await getMarketSeries({panelId:norm.p,range:'3M'}); if(r&&r.ok){sok=true;series=r.series;} else serr=(r&&r.error)||'no series'; }catch(e){ serr=e.message; }
  const tech = buildTech(sok, series, mainQ.last);
  if (!sok) tech.note = `Seri harga: ${serr || 'tidak tersedia'}.`;
  const manual = getMacroSnapshot() || {};
  const hasM = Boolean((manual.pce && (manual.pce.actual != null || manual.pce.forecast != null)) || (manual.nfp && (manual.nfp.actual != null || manual.nfp.forecast != null)));
  const macro = {provider:'FRED (belum dikonfigurasi)',dataStatus:hasM?'MANUAL_SNAPSHOT':'UNAVAILABLE',items:[],consensusNote:hasM?'Snapshot manual PCE/NFP. Hubungkan FRED API untuk live.':'Makro live butuh kunci FRED API.',transmission:{verdict:'UNKNOWN',dataStatus:hasM?'MANUAL_SNAPSHOT':'UNAVAILABLE',factors:[],rule:'Transmisi makro dihitung setelah data makro tersedia.'}};
  const rm=usdidrQ.changePct==null?null:usdidrQ.changePct<0;
  const fx={usdidr:usdidrQ,dxy:dxyQ,rupiahMenguat:rm,transmissionPath:'USD/IDR ↓ + DXY ↓ + US10Y ↓ → risk-on Asia → menopang IHSG.'};
  const r1=(tech.resistance||[])[0],r2=(tech.resistance||[])[1],s1=(tech.support||[])[0],s2=(tech.support||[])[1];
  const px=mainQ.last;
  const sc={bullish:{trigger:r1!=null?`Break & close di atas ${r1}`:'Break resistance (tunggu seri live)',path:[r1,r2].filter((v)=>v!=null),range:[]},sideways:{trigger:(s1!=null&&r1!=null)?`Bertahan ${s1} – ${r1}`:'Konsolidasi (tunggu seri live)',path:[],range:[s1,r1].filter((v)=>v!=null)},bearish:{trigger:s1!=null?`Jebol & close di bawah ${s1}`:'Jebol support (tunggu seri live)',path:[s1,s2].filter((v)=>v!=null),range:[]}};
  const fd=String((manual&&manual.foreignFlow&&manual.foreignFlow.direction)||'UNKNOWN').toUpperCase();
  const fdir = ['BUY', 'SELL', 'UNKNOWN'].includes(fd) ? fd : 'UNKNOWN';
  const fl = {direction:fdir,dataStatus:fdir!=='UNKNOWN'?'MANUAL_SNAPSHOT':'UNAVAILABLE',honestNote:'Flow asing real-time butuh feed BEI.'};
  const ff=(q,n)=>`${n}: ${q.last!=null?q.last:'—'} (${q.dataStatus})`;
  const mon=[{no:1,topic:'USD/IDR',condition:'Waspadai pelemahan di atas 16.500',current:ff(usdidrQ,'USD/IDR'),honest:usdidrQ.dataStatus!=='LIVE'},{no:2,topic:'DXY & US10Y',condition:'DXY > 100 / US10Y > 4,2% menekan risk-on',current:`${ff(dxyQ,'DXY')} · ${ff(us10yQ,'US10Y')}`,honest:dxyQ.dataStatus!=='LIVE'||us10yQ.dataStatus!=='LIVE'},{no:3,topic:'Emas & WTI',condition:'Emas tajam = risk-off; WTI naik = inflasi',current:`${ff(goldQ,'Gold')} · ${ff(wtiQ,'WTI')}`,honest:goldQ.dataStatus!=='LIVE'||wtiQ.dataStatus!=='LIVE'},{no:4,topic:'PCE / NFP AS',condition:'Data panas menunda cut-rate',current:hasM?`PCE ${manual?.pce?.actual??'—'}/${manual?.pce?.forecast??'—'} · NFP ${manual?.nfp?.actual??'—'}/${manual?.nfp?.forecast??'—'} (manual)`:'Belum tersedia (butuh FRED/manual)',honest:true}];
  const anyLive=[mainQ,ihsgQ,usdidrQ,dxyQ,us10yQ,goldQ,wtiQ,btcQ].some((q)=>q.dataStatus==='LIVE');
  const gate='Rebound butuh konfirmasi: Rupiah stabil + DXY/US10Y jinak + close di atas resistance.';
  return {service:'MARKET_INTELLIGENCE',ok:true,symbol:label,marketState:mainQ.dataStatus==='LIVE'?'LIVE':anyLive?'PARTIAL':'OFFLINE',timestamp:Date.now(),price:{...mainQ},technical:tech,fx,rates:{us10y:us10yQ},commodities:{wti:wtiQ,gold:goldQ},crypto:{btc:btcQ},macro,flow:fl,scenarios:sc,monitorList:mon,confirmation:{macro:hasM?'NEUTRAL':'UNKNOWN',fx:rm==null?'UNKNOWN':rm?'POSITIVE':'NEGATIVE',flow:fdir,technical:tech.trend||'UNKNOWN',priceAction:px!=null&&s1!=null&&px<s1?'BELOW_SUPPORT':px!=null&&r1!=null&&px>r1?'ABOVE_RESISTANCE':'IN_RANGE',scores:{Teknikal:tech.rsi14!=null?{score:tech.rsi14}:null,Harga:px!=null?{score:Number(Number(px).toFixed(2))}:null},gate,rule:gate}};
}
export default { getMarketAnalysis, getMacroSnapshot, saveMacroSnapshot };

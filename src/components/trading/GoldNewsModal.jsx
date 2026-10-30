import React, { useCallback, useEffect, useState } from 'react';
import { localRouterClient } from '../../services/router/LocalRouterClient.js';
import { RouterConfig } from '../../services/router/RouterConfig.js';
const SOURCES=[{key:'fed',label:'Federal Reserve',url:'https://www.federalreserve.gov/'},{key:'bls',label:'BLS · CPI/NFP',url:'https://www.bls.gov/schedule/news_release/'},{key:'bea',label:'BEA · PCE/GDP',url:'https://www.bea.gov/news/schedule/'},{key:'treasury',label:'US Treasury',url:'https://home.treasury.gov/'},{key:'cftc',label:'CFTC · COT',url:'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm'}];
const TABS=[['summary','RINGKASAN'],['asia','ASIA'],['london','LONDON'],['newyork','NEW YORK'],['history','RIWAYAT']];
const box={background:'#071321',border:'1px solid #164e63',borderRadius:7,padding:11};const muted={color:'#94a3b8',fontSize:11,lineHeight:1.6};
const sessionNow=()=>{const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return h>=6&&h<14?'asia':h>=14&&h<19?'london':'newyork'};
const parseJson=t=>{
 const text=String(t??'').trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
 try { const value=JSON.parse(text); if(value&&typeof value==='object'&&!Array.isArray(value))return value; } catch {}
 let start=-1,depth=0,inString=false,escaped=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(start<0){if(ch==='{'){start=i;depth=1;}continue;}
  if(inString){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"')inString=false;continue;}
  if(ch==='"'){inString=true;continue;}
  if(ch==='{')depth++;
  else if(ch==='}'){
   depth--;
   if(depth===0){
    try {const value=JSON.parse(text.slice(start,i+1));if(value&&typeof value==='object'&&!Array.isArray(value))return value;}catch{}
    start=-1;
   }
  }
 }
 throw Error('Respons analis tidak berisi objek JSON valid. Coba Refresh; jika berulang, periksa output model di LocalRouterClient.');
};
const errorText=e=>{const v=e?.message??e?.error??e; if(typeof v==='string')return v;try{return JSON.stringify(v)}catch{return String(v)}};
export default function GoldNewsModal({open,onClose,instrument='XAUUSD'}){
 const [tab,setTab]=useState('summary'),[busy,setBusy]=useState(false),[status,setStatus]=useState('BELUM DICARI'),[error,setError]=useState(''),[sources,setSources]=useState([]),[report,setReport]=useState(null),[history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('jin-gold-news-history-v1')||'[]')}catch{return[]}});
 const readNews=useCallback(async(reason)=>{if(busy)return;setBusy(true);setError('');setStatus('MEMBACA SUMBER RESMI…');try{
  const endpoint=String(RouterConfig.getEndpoint()).replace(/\/+$/,'');
  const statusRoute=endpoint.endsWith('/api')?'/trading/fundamental-status':'/api/trading/fundamental-status';
  const readRoute=endpoint.endsWith('/api')?'/trading/fundamental-read':'/api/trading/fundamental-read';
  let payload=null; let usedScheduled=false; let usedTavily=false;
  if(reason==='refresh manual'){
   const searchResponse=await fetch(endpoint+(endpoint.endsWith('/api')?'/trading/gold-news-search':'/api/trading/gold-news-search'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instrument,session:sessionNow(),requestedAt:new Date().toISOString()}),signal:AbortSignal.timeout(20000),cache:'no-store'});
   const searchPayload=await searchResponse.json();
   if(!searchResponse.ok||!searchPayload.success)throw Error(errorText(searchPayload.error)||('Pencarian Tavily gagal (HTTP '+searchResponse.status+').'));
   payload={success:true,fetchedAt:searchPayload.fetchedAt,searchProvider:searchPayload.provider,directAnswer:searchPayload.directAnswer,sources:searchPayload.sources.map((s,i)=>({key:'tavily_'+i,label:s.title||s.domain||('Hasil Tavily '+(i+1)),url:s.url,status:'READ',fetchedAt:searchPayload.fetchedAt,content:'Judul: '+(s.title||'Tidak tersedia')+'\\nDomain: '+(s.domain||'Tidak tersedia')+'\\nCuplikan hasil pencarian (bukan konfirmasi artikel penuh): '+(s.snippet||'Tidak tersedia')+'\\nSkor relevansi pencarian: '+(s.score??'tidak tersedia')+'\\nKategori domain: '+(s.category||'GENERAL')}))};
   usedTavily=true;
  }
  try {
   if(!payload){
   const sr=await fetch(endpoint+statusRoute,{signal:AbortSignal.timeout(5000),cache:'no-store'});
   if(sr.ok){const state=await sr.json();const last=state.lastRun;const age=last?.completedAt?Date.now()-Date.parse(last.completedAt):Infinity;
    if(last?.success&&Array.isArray(last.sources)&&last.sources.some(s=>s.status==='READ'&&s.content)&&age<10*60*60*1000){
     payload={success:true,sources:last.sources,fetchedAt:last.fetchedAt,scheduledSession:last.sessionLabel,scheduledAtWIB:last.scheduledAtWIB};usedScheduled=true;
    }
   }
   }
  } catch(e) { if(reason!=='refresh manual'){} else { throw e; } }
  if(!payload){
   const response=await fetch(endpoint+readRoute,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources:SOURCES.map(s=>s.key),instrument,session:sessionNow(),requestedAt:new Date().toISOString()}),signal:AbortSignal.timeout(45000)});
   payload=await response.json();if(!response.ok||!payload.success)throw Error(payload.error||'Endpoint pembaca berita belum tersedia.');
  }
  const read=Array.isArray(payload.sources)?payload.sources:[];setSources(read);const readable=read.filter(s=>s.status==='READ'&&s.content);if(!readable.length)throw Error('Tidak ada isi sumber yang berhasil dibaca. Berita tidak dapat diverifikasi.');
  const evidence=readable.map(s=>({source:s.label,url:s.url,fetchedAt:s.fetchedAt,content:String(s.content).slice(0,10000)}));
  const prompt=['Analisis hanya berita/peristiwa makro yang dapat memengaruhi XAUUSD dari bukti halaman berikut. Jangan mengarang headline, angka actual/consensus/previous, tanggal atau waktu. Pisahkan jadwal masa depan dari berita yang telah terbit.','Output JSON valid: {"summary":"...","facts":[{"headline":"...","summary":"...","sourceLabel":"...","sourceUrl":"...","publishedAt":"...","eventTimeWIB":"...","session":"asia|london|newyork|all","importance":"HIGH|MEDIUM|LOW","impact":"BULLISH_GOLD|BEARISH_GOLD|VOLATILITY_RISK|MIXED|UNKNOWN","impactReason":"...","factOrInterpretation":"FACT|INTERPRETATION|SCHEDULE"}],"risks":["..."],"missing":["..."],"asOf":"ISO timestamp"}. Jika tidak ada bukti relevan, facts [].','Instrumen '+instrument+'; sesi '+sessionNow()+'; waktu '+new Date().toISOString()+'. Provider pencarian: '+(payload.searchProvider||'pembacaan sumber terjadwal/resmi')+'. Catatan: hasil Tavily adalah cuplikan pencarian dan bukan bukti bahwa artikel penuh telah dibaca; jangan mengklaim tanggal publikasi jika tidak tersedia. Ringkasan mesin pencari (jika ada): '+(payload.directAnswer||'tidak tersedia')+'. Bukti: '+JSON.stringify(evidence)].join('\n\n');
  const raw=await localRouterClient.streamChat({messages:[{role:'system',content:'Analis berita fundamental emas. Hanya gunakan bukti sumber, jangan mengarang fakta terkini. Output JSON tanpa markdown.'},{role:'user',content:prompt}],temperature:0.1});const parsed=parseJson(raw);
  // Keep only claims that point to a source actually supplied to the model.
  const evidenceByUrl=new Map(evidence.map(s=>[s.url,s]));
  const candidateFacts=Array.isArray(parsed.facts)?parsed.facts:[];
  const verifiedFacts=candidateFacts.filter(f=>typeof f?.sourceUrl==='string'&&evidenceByUrl.has(f.sourceUrl));
  parsed.facts=verifiedFacts.map(f=>{
   const source=evidenceByUrl.get(f.sourceUrl);
   const dateText=String(source?.content||'');
   const hasPublicationDate=!!f.publishedAt&&dateText.includes(String(f.publishedAt).slice(0,10));
   return {...f,publishedAt:hasPublicationDate?f.publishedAt:'',sourceLabel:source?.source||f.sourceLabel||'Sumber tidak diketahui'};
  });
  if(!parsed.facts.length)parsed.summary='Belum ada klaim berita yang dapat dihubungkan secara tepat ke URL sumber yang dibaca. Tidak ada kesimpulan arah XAUUSD yang dibuat.';
  if(!Array.isArray(parsed.risks))parsed.risks=[];
  if(!Array.isArray(parsed.missing))parsed.missing=[];
  const item={...parsed,checkedAt:new Date().toISOString(),sourceCount:readable.length,reason,sourceFetchMode:usedScheduled?'scheduled pre-session':usedTavily?'manual Tavily search ('+(payload.searchProvider||'provider unknown')+')':'manual live read',scheduledSession:payload.scheduledSession||null,scheduledAtWIB:payload.scheduledAtWIB||null};setReport(item);setStatus(readable.length+' SUMBER DIBACA');setHistory(old=>{const next=[item,...old].slice(0,100);try{localStorage.setItem('jin-gold-news-history-v1',JSON.stringify(next))}catch{}return next});
 }catch(e){setError(errorText(e)||'Pencarian berita gagal.');setStatus('GAGAL / BELUM TERVERIFIKASI')}finally{setBusy(false)}},[busy,instrument]);
 useEffect(()=>{if(open){setTab(sessionNow());if(!report)readNews('modal dibuka')}},[open]);
 useEffect(()=>{
  if(!open)return;
  // Search once when the modal is opened; while it remains open, search only
  // when crossing a major session boundary in WIB (06:00, 14:00, 19:00).
  const sessionKey=()=>{const d=new Date();const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return parts+':'+sessionNow()};
  let lastKey=sessionKey();
  const id=setInterval(()=>{
   const nextKey=sessionKey();
   if(nextKey!==lastKey){lastKey=nextKey;readNews('pergantian sesi market: '+sessionNow())}
  },60000);
  return()=>clearInterval(id);
 },[open,readNews]);
 useEffect(()=>{const f=e=>{if(e.key==='Escape'&&open)onClose()};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 if(!open)return null;const facts=Array.isArray(report?.facts)?report.facts:[];const visible=tab==='summary'?facts:facts.filter(f=>!f.session||f.session==='all'||f.session===tab);
 const btn=k=>({border:'1px solid '+(tab===k?'#0284c7':'#20364a'),background:tab===k?'#0878e8':'#06111e',color:tab===k?'#fff':'#a9c4d9',padding:'9px 12px',fontSize:10,fontWeight:900,borderRadius:5,cursor:'pointer',whiteSpace:'nowrap'});
 return <div role="dialog" aria-modal="true" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} style={{position:'fixed',inset:0,zIndex:100010,background:'rgba(0,3,10,.86)',backdropFilter:'blur(5px)',display:'flex',alignItems:'center',justifyContent:'center',padding:8}}><div style={{width:'min(1100px,98vw)',height:'min(850px,94vh)',display:'flex',flexDirection:'column',background:'#030b15',border:'1px solid #087e9c',borderRadius:12,overflow:'hidden',color:'#dbeafe',fontFamily:'Inter,system-ui,sans-serif'}}>
 <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:15,borderBottom:'1px solid #164e63',flexWrap:'wrap'}}><div><div style={{fontSize:18,fontWeight:900}}>JIN GOLD NEWS INTELLIGENCE</div><div style={muted}>Berita XAUUSD · WIB · sesi: {sessionNow().toUpperCase()}</div></div><div style={{display:'flex',gap:7}}><button style={btn('refresh')} disabled={busy} onClick={()=>readNews('refresh manual')}>{busy?'MEMBACA…':'↻ REFRESH'}</button><button style={btn('close')} onClick={onClose}>×</button></div></header>
 <nav style={{display:'flex',gap:5,padding:10,overflowX:'auto',borderBottom:'1px solid #132b3d'}}>{TABS.map(([k,l])=><button key={k} style={btn(k)} onClick={()=>setTab(k)}>{l}</button>)}</nav>
 <main style={{overflowY:'auto',padding:13,flex:1,display:'grid',alignContent:'start',gap:10}}><section style={box}><strong style={{color:status.startsWith('GAGAL')?'#fca5a5':'#67e8f9',fontSize:11}}>{status}</strong><div style={muted}>Pencarian terakhir: {report?.checkedAt?new Date(report.checkedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Belum ada hasil sukses'} · pencarian saat modal dibuka; sumber terjadwal digunakan bila tersedia, atau pembacaan langsung jika belum ada.</div><div style={muted}>Sumber terbaca: {sources.filter(s=>s.status==='READ').length}/{sources.length||SOURCES.length}</div></section>
 {error&&<section style={{...box,borderColor:'#991b1b',color:'#fca5a5'}}>{error}<div style={muted}>Tidak menampilkan berita lama sebagai berita baru.</div></section>}
 {tab==='history'?<section style={box}><strong>RIWAYAT PENCARIAN</strong>{history.length?history.map((h,i)=><div key={h.checkedAt||i} style={{padding:'10px 0',borderTop:'1px solid #19364b'}}><strong style={{fontSize:11}}>{new Date(h.checkedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</strong><div style={muted}>{h.summary||'Tidak ada ringkasan.'}</div><div style={muted}>{(h.facts||[]).length} item berita · {h.sourceCount||0} sumber</div></div>):<p style={muted}>Belum ada riwayat.</p>}</section>:<><section style={box}><strong style={{color:'#67e8f9'}}>{tab==='summary'?'RINGKASAN BERITA PENTING':'BERITA SESI '+tab.toUpperCase()}</strong><p style={{fontSize:12,lineHeight:1.7}}>{report?.summary||'Belum ada ringkasan terverifikasi.'}</p></section>
 {visible.length?visible.map((f,i)=><article key={(f.sourceUrl||'news')+i} style={box}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{fontSize:13}}>{f.headline||'Peristiwa makro'}</strong><span style={{fontSize:9,color:f.importance==='HIGH'?'#fb7185':'#fbbf24'}}>{f.importance||'UNRANKED'}</span></div><p style={muted}>{f.summary||'Ringkasan belum tersedia.'}</p><strong style={{fontSize:10,color:String(f.impact||'').includes('BULLISH')?'#34d399':String(f.impact||'').includes('BEARISH')?'#fb7185':'#fbbf24'}}>POTENSI DAMPAK EMAS: {f.impact||'UNKNOWN'}</strong><p style={muted}>{f.impactReason||'Alasan belum tersedia.'}</p><div style={muted}>Jenis: {f.factOrInterpretation||'BELUM DIPISAHKAN'} · Publikasi: {f.publishedAt||'Tidak ditemukan'} · Jadwal WIB: {f.eventTimeWIB||'Tidak ditemukan'} · Sesi: {String(f.session||'all').toUpperCase()}</div>{f.sourceUrl&&<a href={f.sourceUrl} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:7,color:'#67e8f9',fontSize:10}}>{f.sourceLabel||'Sumber asli'} ↗</a>}</article>):<section style={{...box,color:'#fbbf24'}}>{report?'Tidak ada berita penting yang terverifikasi untuk tab ini.':'Menunggu pembacaan sumber.'}</section>}
 {!!report?.risks?.length&&<section style={box}><strong>RISIKO / CATATAN</strong><ul style={muted}>{report.risks.map((x,i)=><li key={i}>{x}</li>)}</ul></section>}</>}
 <section style={box}><strong style={{fontSize:10,color:'#67e8f9'}}>SUMBER YANG DIPANTAU</strong><div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:7}}>{SOURCES.map(s=><a key={s.key} href={s.url} target="_blank" rel="noreferrer" style={{color:'#67e8f9',fontSize:10}}>{s.label} ↗</a>)}</div><div style={muted}>Pencarian berjalan saat modal dibuka dan saat pergantian sesi terdeteksi. Ini berjalan hanya selama aplikasi/modal aktif; scheduler persisten saat browser tertutup belum tersedia. Jam sesi adalah perkiraan WIB dan harus disesuaikan dengan DST, hari libur, serta jam broker.</div></section></main></div></div>
}
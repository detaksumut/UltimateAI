/** Market Intelligence provider gate: legacy external price provider disabled. */
export const MIE_BASKET = {
 IHSG:{symbol:'^JKSE',currency:'IDX'}, USDIDR:{symbol:'USDIDR=X',currency:'IDR'},
 DXY:{symbol:'DX-Y.NYB',currency:'INDEX'}, US10Y:{symbol:'^TNX',currency:'PERCENT'},
 WTI:{symbol:'CL=F',currency:'USD'}, GOLD:{symbol:'GC=F',currency:'USD'}, BTC:{symbol:'BTC-USD',currency:'USD'}
};
export async function fetchExternalCloses() {
 return {ok:false,error:'Provider harga Market Intelligence dinonaktifkan; tidak ada permintaan eksternal yang dikirim.'};
}
export default {MIE_BASKET,fetchExternalCloses};

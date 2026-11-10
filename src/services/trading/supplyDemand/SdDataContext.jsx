/**
 * SdDataContext — Shared S&D data between panels.
 *
 * SupplyDemandEnginePanel adalah pemilik data: ia fetch OHLC XM sekali dan
 * menyimpan hasil analisis + payload M1 ke dalam context. ScalpingM1Panel
 * membaca payload M1 dari context sehingga tidak perlu fetch OHLC sendiri
 * dan hanya menampilkan analisis M1.
 */
import { createContext, useContext, useState, useCallback } from 'react';

const SdDataContext = createContext(null);

export function SdDataProvider({ children }) {
  const [sdData, setSdData] = useState(null);
  const [m1Payload, setM1Payload] = useState(null);

  const updateSdData = useCallback(({ analysis, payloads }) => {
    setSdData(analysis || null);
    if (payloads && payloads.M1) {
      setM1Payload(payloads.M1);
    } else {
      setM1Payload(null);
    }
  }, []);

  const value = { sdData, m1Payload, updateSdData };
  return (
    <SdDataContext.Provider value={value}>
      {children}
    </SdDataContext.Provider>
  );
}

export function useSdData() {
  const ctx = useContext(SdDataContext);
  if (!ctx) {
    throw new Error('useSdData harus digunakan di dalam SdDataProvider');
  }
  return ctx;
}

export default SdDataContext;

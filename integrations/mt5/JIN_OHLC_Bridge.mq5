#property strict
#property version   "1.00"
#property description "JIN local OHLC bridge: publish real broker candles from MetaTrader 5 to UltimateAI LocalRouter."

input string InpLocalRouterURL = "http://127.0.0.1:20200/api/trading/ohlc/ingest";
input string InpBrokerSymbol = ""; // Empty = chart symbol. Supports broker suffixes, e.g. XAUUSD.a.
input int    InpBarsPerTimeframe = 300;
input int    InpPublishSeconds = 5;

string JIN_Symbol()
{
   string s = InpBrokerSymbol == "" ? _Symbol : InpBrokerSymbol;
   StringToUpper(s);
   if(StringFind(s, "XAUUSD") == 0) return "XAUUSD";
   if(StringFind(s, "BTCUSDT") == 0) return "BTCUSDT";
   if(StringFind(s, "ETHUSDT") == 0) return "ETHUSDT";
   if(StringFind(s, "EURUSD") == 0) return "EURUSD";
   if(StringFind(s, "GBPUSD") == 0) return "GBPUSD";
   if(StringFind(s, "US30") == 0 || StringFind(s, "DJI") == 0) return "US30";
   return s;
}

string JsonNumber(double value)
{
   if(!MathIsValidNumber(value)) return "0";
   return DoubleToString(value, 8);
}

void AppendRates(string &json, ENUM_TIMEFRAMES tf, string tfName, string symbol)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int requested = MathMax(50, MathMin(InpBarsPerTimeframe, 500));
   int copied = CopyRates(InpBrokerSymbol == "" ? _Symbol : InpBrokerSymbol, tf, 0, requested, rates);
   if(copied <= 0)
   {
      Print("[JIN MT5 Bridge] CopyRates failed for ", tfName, " error=", GetLastError());
      return;
   }
   // MT5 returns the current candle at index 0 in series mode. Publish oldest to newest.
   for(int i = copied - 1; i >= 0; i--)
   {
      if(StringLen(json) > 0) json += ",";
      json += "{\"symbol\":\"" + symbol + "\",\"timeframe\":\"" + tfName + "\",";
      json += "\"timestamp\":" + IntegerToString((long)rates[i].time) + ",";
      json += "\"open\":" + JsonNumber(rates[i].open) + ",";
      json += "\"high\":" + JsonNumber(rates[i].high) + ",";
      json += "\"low\":" + JsonNumber(rates[i].low) + ",";
      json += "\"close\":" + JsonNumber(rates[i].close) + ",";
      json += "\"volume\":" + JsonNumber((double)rates[i].tick_volume) + "}";
   }
}

void Publish()
{
   string symbol = JIN_Symbol();
   string candles = "";
   AppendRates(candles, PERIOD_H4, "H4", symbol);
   AppendRates(candles, PERIOD_H1, "H1", symbol);
   AppendRates(candles, PERIOD_M15, "M15", symbol);
   AppendRates(candles, PERIOD_M5, "M5", symbol);
   AppendRates(candles, PERIOD_D1, "D1", symbol);

   MqlTick tick;
   string ticks = "";
   string brokerSymbol = InpBrokerSymbol == "" ? _Symbol : InpBrokerSymbol;
   if(SymbolInfoTick(brokerSymbol, tick))
   {
      ticks = "{\"symbol\":\"" + symbol + "\",\"bid\":" + JsonNumber(tick.bid) +
              ",\"ask\":" + JsonNumber(tick.ask) + "}";
   }
   string payload = "{\"candles\":[" + candles + "],\"ticks\":[" + ticks + "]}";
   char post[], response[];
   string responseHeaders;
   int bytes = StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(bytes > 0) ArrayResize(post, bytes - 1); // exclude terminal NUL
   ResetLastError();
   int status = WebRequest("POST", InpLocalRouterURL, "Content-Type: application/json\r\n", 10000, post, response, responseHeaders);
   if(status == -1)
   {
      Print("[JIN MT5 Bridge] WebRequest failed. In MT5 open Tools > Options > Expert Advisors and allow URL http://127.0.0.1:20200. Error=", GetLastError());
      return;
   }
   string body = CharArrayToString(response, 0, -1, CP_UTF8);
   if(status < 200 || status >= 300)
      Print("[JIN MT5 Bridge] LocalRouter HTTP ", status, ": ", body);
   else
      Print("[JIN MT5 Bridge] Published candles. HTTP ", status, ": ", body);
}

int OnInit()
{
   EventSetTimer(MathMax(5, InpPublishSeconds));
   Print("[JIN MT5 Bridge] Started for broker symbol ", (InpBrokerSymbol == "" ? _Symbol : InpBrokerSymbol),
         ". Ensure LocalRouterServer is running and allow http://127.0.0.1:20200 in MT5 WebRequest settings.");
   Publish();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   Publish();
}

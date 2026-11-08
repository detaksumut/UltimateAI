import fs from 'fs';

const serverFile = 'd:/Users/ultimateai/server/local_router/LocalRouterServer.mjs';
let code = fs.readFileSync(serverFile, 'utf8');

// 1. Add imports at the top
const importMarker = "import intermarketQuotesHandler from '../../api/trading/intermarket-quotes.js';";
const newImports = `import intermarketQuotesHandler from '../../api/trading/intermarket-quotes.js';
import { paymentGatewayServiceInstance } from '../payment/PaymentGatewayService.mjs';
import { paymentLedgerInstance } from '../payment/PaymentLedger.mjs';`;

if (!code.includes("from '../payment/PaymentGatewayService.mjs'")) {
  if (code.includes(importMarker)) {
    code = code.replace(importMarker, newImports);
    console.log('Payment imports added to LocalRouterServer.mjs.');
  } else {
    console.error('Could not find importMarker');
  }
}

// 2. Add Payment Routes right before 404 Handler
const routeMarker = `    // 404 Handler
    res.writeHead(404, { 'Content-Type': 'application/json' });`;

const newRoutes = `    // ── Payment Gateway & E-Wallet Deposit Routes (DANA, OVO, GoPay) ──
    if (pathname === '/api/payment/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        config: paymentGatewayServiceInstance.getEnvironmentInfo()
      }));
      return;
    }

    if ((pathname === '/api/payment/deposit/create' || pathname === '/api/payment/create-deposit') && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const result = await paymentGatewayServiceInstance.createDeposit({
            userId: body.userId || 'user-default',
            amount: body.amount,
            method: body.method,
            customerDetails: body.customerDetails || {}
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/payment/webhook' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyStr || '{}');
          const result = await paymentGatewayServiceInstance.processWebhookNotification(payload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'OK', result }));
        } catch (err) {
          console.error('[PaymentWebhook] Webhook verification error:', err.message);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/payment/wallet' && req.method === 'GET') {
      const urlObj = new URL(req.url, \`http://\${req.headers.host || '127.0.0.1'}\`);
      const userId = urlObj.searchParams.get('userId') || 'user-default';
      const wallet = paymentLedgerInstance.getWallet(userId);
      const transactions = paymentLedgerInstance.getUserTransactions(userId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, wallet, transactions }));
      return;
    }

    if (pathname === '/api/payment/status' && req.method === 'GET') {
      const urlObj = new URL(req.url, \`http://\${req.headers.host || '127.0.0.1'}\`);
      const orderId = urlObj.searchParams.get('orderId');
      if (!orderId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Parameter orderId diperlukan' }));
        return;
      }
      const tx = paymentLedgerInstance.getTransaction(orderId);
      if (!tx) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Transaksi tidak ditemukan' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, transaction: tx }));
      return;
    }

    if (pathname === '/api/payment/sandbox/simulate-pay' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const result = await paymentGatewayServiceInstance.simulateSandboxPayment(
            body.orderId,
            body.status || 'settlement'
          );
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // 404 Handler
    res.writeHead(404, { 'Content-Type': 'application/json' });`;

if (!code.includes("'/api/payment/deposit/create'")) {
  if (code.includes(routeMarker)) {
    code = code.replace(routeMarker, newRoutes);
    console.log('Payment route handlers inserted into LocalRouterServer.mjs.');
  } else {
    console.error('Could not find routeMarker');
  }
}

fs.writeFileSync(serverFile, code, 'utf8');
console.log('Server update complete.');


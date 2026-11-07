import fs from 'fs';

const filePath = 'd:/Users/ultimateai/src/pages/PlatformTrader.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add import
const importTarget = "import DemoAccountBar from '../components/platform-trader/DemoAccountBar.jsx';";
const newImport = `import DemoAccountBar from '../components/platform-trader/DemoAccountBar.jsx';
import TradingAccountCenterModal from '../components/platform-trader/TradingAccountCenterModal.jsx';`;

if (!code.includes("import TradingAccountCenterModal")) {
  code = code.replace(importTarget, newImport);
  console.log('Import TradingAccountCenterModal added.');
}

// 2. Add state
const stateTarget = "  const [confirmModalOpen, setConfirmModalOpen] = useState(false);";
const newState = `  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [accountCenterOpen, setAccountCenterOpen] = useState(false);
  const [depositBalanceIdr, setDepositBalanceIdr] = useState(0);

  // Sync Deposit IDR Wallet balance
  useEffect(() => {
    fetch(RouterConfig.api('/api/payment/wallet?userId=user-default'))
      .then(r => r.json())
      .then(d => {
        if (d.success && d.wallet) {
          setDepositBalanceIdr(d.wallet.depositBalanceIdr || 0);
        }
      })
      .catch(() => {});
  }, [accountCenterOpen]);`;

if (!code.includes("const [accountCenterOpen, setAccountCenterOpen] = useState(false);")) {
  code = code.replace(stateTarget, newState);
  console.log('Account Center states added.');
}

// 3. Update DemoAccountBar props
const demoBarTarget = `        <DemoAccountBar
          tradingMode={tradingMode}
          onToggleMode={setTradingMode}
          demoState={demoState}
          onResetDemo={() => {
            demoTradingEngineInstance.resetAccount();
          }}
        />`;

const newDemoBar = `        <DemoAccountBar
          tradingMode={tradingMode}
          onToggleMode={setTradingMode}
          demoState={demoState}
          onResetDemo={() => {
            demoTradingEngineInstance.resetAccount();
          }}
          onOpenAccountCenter={() => setAccountCenterOpen(true)}
          depositBalanceIdr={depositBalanceIdr}
        />`;

if (code.includes(demoBarTarget)) {
  code = code.replace(demoBarTarget, newDemoBar);
  console.log('DemoAccountBar props updated.');
}

// 4. Render TradingAccountCenterModal
const modalTarget = `      {/* Trading Studio Modal Overlay */}`;
const newModal = `      {/* Trading Account Center Modal (DANA / OVO / GoPay Deposit) */}
      <TradingAccountCenterModal
        isOpen={accountCenterOpen}
        onClose={() => setAccountCenterOpen(false)}
        demoBalance={demoState.balance}
        xmBalance={0}
        userId="user-default"
      />

      {/* Trading Studio Modal Overlay */}`;

if (!code.includes("<TradingAccountCenterModal")) {
  code = code.replace(modalTarget, newModal);
  console.log('TradingAccountCenterModal rendered.');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('PlatformTrader.jsx successfully updated.');


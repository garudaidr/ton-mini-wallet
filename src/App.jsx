import React, { useState, useEffect } from 'react';
import TonWeb from 'tonweb';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer/';

// Make Buffer available globally
globalThis.Buffer = Buffer;

function App() {
  // State for mnemonic, keys, wallet, etc.
  const [mnemonic, setMnemonic] = useState('');
  const [keyPair, setKeyPair] = useState(null); // { publicKey, secretKey }
  const [walletAddress, setWalletAddress] = useState('');
  const [tonweb, setTonweb] = useState(null);

  // Transfer-related states
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState('');

  // Initialize wallet from mnemonic
  const initializeWallet = async (mnemonic) => {
    try {
      // 2) Convert mnemonic to seed
      const seed = await bip39.mnemonicToSeed(mnemonic);

      // 3) Get first 32 bytes for key derivation
      const seedBytes = new Uint8Array(seed).slice(0, 32);

      // 4) Derive keyPair using TonWeb utility
      const derivedKeyPair = TonWeb.utils.keyPairFromSeed(seedBytes);
      setKeyPair(derivedKeyPair);

      // 5) Create tonweb instance pointing to testnet
      const tw = new TonWeb(
        new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC')
      );
      setTonweb(tw);

      // 6) Create wallet class (v3R2) with derived publicKey
      const WalletClass = tw.wallet.all.v3R2;
      const wallet = new WalletClass(tw.provider, {
        publicKey: derivedKeyPair.publicKey,
        wc: 0
      });

      // 7) Fetch the wallet address
      const address = await wallet.getAddress();
      setWalletAddress(address.toString(true, true, true));
    } catch (error) {
      console.error('Error initializing wallet:', error);
    }
  };

  // On first mount, load mnemonic from localStorage if exists
  useEffect(() => {
    const storedMnemonic = localStorage.getItem('wallet_mnemonic');
    if (storedMnemonic) {
      setMnemonic(storedMnemonic);
      initializeWallet(storedMnemonic);
    }
  }, []);

  // Generate new mnemonic and initialize wallet
  const handleGenerateMnemonic = async () => {
    const generatedMnemonic = bip39.generateMnemonic();
    setMnemonic(generatedMnemonic);
    localStorage.setItem('wallet_mnemonic', generatedMnemonic);
    await initializeWallet(generatedMnemonic);
  };

  // Copy address to clipboard
  const handleCopyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    alert('Address copied to clipboard!');
  };

  // Perform a transfer from this wallet to another address
  const handleTransfer = async () => {
    if (!tonweb || !keyPair || !walletAddress || !toAddress || !amount) {
      alert('Missing required data for transfer.');
      return;
    }

    try {
      setTransferStatus('Transferring... Please wait.');

      // Recreate the same wallet object
      const WalletClass = tonweb.wallet.all.v3R2;
      const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
        wc: 0
      });

      // Need to get the current seqno
      const seqno = await wallet.methods.seqno().call();

      // Convert user-entered amount to nanoTON
      const nanoAmount = TonWeb.utils.toNano(amount.toString());

      // Send the transaction
      await wallet.methods
        .transfer({
          secretKey: keyPair.secretKey,
          toAddress: toAddress,
          amount: nanoAmount,
          seqno: seqno,
          payload: 'Sent from minimal TON React wallet',
          stateInit: null
        })
        .send();

      setTransferStatus(`Transfer successful! Sent ${amount} TON to ${toAddress}`);
    } catch (error) {
      console.error('Transfer error:', error);
      setTransferStatus('Transfer failed. Check console for details.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Minimal TON Wallet</h1>

      {/* Mnemonic Display */}
      <div style={{ marginBottom: '20px' }}>
        <h2>1. Your Mnemonic (Seed Phrase)</h2>
        {mnemonic ? (
          <p style={{ background: '#eee', padding: '8px' }}>
            {mnemonic}
          </p>
        ) : (
          <button 
            onClick={handleGenerateMnemonic}
            style={{ 
              padding: '10px 20px',
              fontSize: '16px',
              marginBottom: '10px'
            }}
          >
            Generate New Wallet
          </button>
        )}
        <p style={{ fontSize: '14px', color: 'red' }}>
          ** Store this somewhere safe! In a real app, do NOT show it in plain text. **
        </p>
      </div>

      {/* Wallet Address Display & Copy */}
      <div style={{ marginBottom: '20px' }}>
        <h2>2. Your TON Wallet Address</h2>
        <p style={{ background: '#eee', padding: '8px' }}>
          {walletAddress || 'Loading address...'}
        </p>
        <button onClick={handleCopyAddress} disabled={!walletAddress}>
          Copy Address
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>
          <strong>Deposit:</strong> You can send testnet TON to the above address
          (e.g., from a testnet faucet or another testnet wallet).
        </p>
      </div>

      {/* Transfer Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2>3. Transfer from This Wallet</h2>
        <label>
          Recipient Address:
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            style={{ width: '100%', margin: '5px 0' }}
            placeholder="Enter TON address to send to"
          />
        </label>
        <br />
        <label>
          Amount (TON):
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: '100%', margin: '5px 0' }}
            placeholder="E.g. 0.5"
          />
        </label>
        <br />
        <button onClick={handleTransfer}>
          Send
        </button>
        {transferStatus && (
          <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{transferStatus}</p>
        )}
      </div>
    </div>
  );
}

export default App;

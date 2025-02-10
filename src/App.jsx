import React, { useState, useEffect } from 'react';
import TonWeb from 'tonweb';
import * as bip39 from 'bip39';
import { Buffer } from 'buffer/';

// Make Buffer available globally
globalThis.Buffer = Buffer;

function App() {
  // State for mnemonic, keys, wallet, etc.
  const [mnemonic, setMnemonic] = useState('');
  const [keyPair, setKeyPair] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [tonweb, setTonweb] = useState(null);
  const [keypairs, setKeypairs] = useState([]);
  const [showPassphraseIndex, setShowPassphraseIndex] = useState(null);

  // Transfer-related states
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState('');

  // Initialize wallet from mnemonic
  const initializeWallet = async (mnemonic) => {
    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const seedBytes = new Uint8Array(seed).slice(0, 32);
      const derivedKeyPair = TonWeb.utils.keyPairFromSeed(seedBytes);
      setKeyPair(derivedKeyPair);

      const tw = new TonWeb(
        new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC')
      );
      setTonweb(tw);

      const WalletClass = tw.wallet.all.v3R2;
      const wallet = new WalletClass(tw.provider, {
        publicKey: derivedKeyPair.publicKey,
        wc: 0
      });

      const address = await wallet.getAddress();
      setWalletAddress(address.toString(true, true, true));
      
      return {
        mnemonic,
        address: address.toString(true, true, true),
      };
    } catch (error) {
      console.error('Error initializing wallet:', error);
      return null;
    }
  };

  // Load existing keypairs from localStorage on mount
  useEffect(() => {
    const storedKeypairs = localStorage.getItem('wallet_keypairs');
    if (storedKeypairs) {
      setKeypairs(JSON.parse(storedKeypairs));
    }

    const storedMnemonic = localStorage.getItem('wallet_mnemonic');
    if (storedMnemonic) {
      setMnemonic(storedMnemonic);
      initializeWallet(storedMnemonic);
    }
  }, []);

  // Generate new keypair
  const handleGenerateKeypair = async () => {
    const generatedMnemonic = bip39.generateMnemonic();
    const walletData = await initializeWallet(generatedMnemonic);
    
    if (walletData) {
      const newKeypairs = [...keypairs, walletData];
      setKeypairs(newKeypairs);
      localStorage.setItem('wallet_keypairs', JSON.stringify(newKeypairs));
      setMnemonic(generatedMnemonic);
      localStorage.setItem('wallet_mnemonic', generatedMnemonic);
    }
  };

  // Toggle passphrase visibility
  const togglePassphrase = (index) => {
    setShowPassphraseIndex(showPassphraseIndex === index ? null : index);
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

      const WalletClass = tonweb.wallet.all.v3R2;
      const wallet = new WalletClass(tonweb.provider, {
        publicKey: keyPair.publicKey,
        wc: 0
      });

      const seqno = await wallet.methods.seqno().call();
      const nanoAmount = TonWeb.utils.toNano(amount.toString());

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
    <div style={{ padding: '20px', fontFamily: 'Arial', color: 'white', background: '#333' }}>
      <h1>Minimal TON Wallet</h1>

      {/* Mnemonic Display */}
      <div style={{ marginBottom: '20px' }}>
        <h2>1. Your Mnemonic (Seed Phrase)</h2>
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={handleGenerateKeypair}
            style={{ 
              padding: '10px 20px',
              fontSize: '16px',
              marginBottom: '10px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Generate
          </button>
        </div>
        {mnemonic && (
          <p style={{ background: '#444', padding: '8px', borderRadius: '4px' }}>
            {mnemonic}
          </p>
        )}
        <p style={{ fontSize: '14px', color: '#ff6b6b' }}>
          ** Store this somewhere safe! In a real app, do NOT show it in plain text. **
        </p>
      </div>

      {/* Wallet Address Display & Copy */}
      <div style={{ marginBottom: '20px' }}>
        <h2>2. Your TON Wallet Address</h2>
        <p style={{ background: '#444', padding: '8px', borderRadius: '4px', fontFamily: 'monospace' }}>
          {walletAddress || 'Loading address...'}
        </p>
        <button 
          onClick={handleCopyAddress} 
          disabled={!walletAddress}
          style={{
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: walletAddress ? 'pointer' : 'not-allowed',
            opacity: walletAddress ? 1 : 0.7
          }}
        >
          Copy Address
        </button>
      </div>

      {/* Keypairs List */}
      <div style={{ marginBottom: '20px' }}>
        <h2>3. Saved Keypairs</h2>
        {keypairs.map((keypair, index) => (
          <div key={index} style={{ 
            border: '1px solid #555',
            padding: '15px',
            marginBottom: '10px',
            borderRadius: '4px',
            background: '#444'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px'
            }}>
              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {keypair.address}
              </div>
              <button
                onClick={() => togglePassphrase(index)}
                style={{ 
                  padding: '8px 16px',
                  background: '#607D8B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
              >
                {showPassphraseIndex === index ? 'Hide' : 'Show'} Passphrase
              </button>
            </div>
            {showPassphraseIndex === index && (
              <div style={{ 
                marginTop: '10px',
                padding: '8px',
                background: '#555',
                fontFamily: 'monospace',
                borderRadius: '4px',
                wordBreak: 'break-all'
              }}>
                {keypair.mnemonic}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Transfer Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2>4. Transfer from This Wallet</h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Recipient Address:
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              style={{ 
                width: '100%', 
                margin: '5px 0',
                padding: '8px',
                background: '#444',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white'
              }}
              placeholder="Enter TON address to send to"
            />
          </label>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Amount (TON):
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ 
                width: '100%', 
                margin: '5px 0',
                padding: '8px',
                background: '#444',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white'
              }}
              placeholder="E.g. 0.5"
            />
          </label>
        </div>
        <button 
          onClick={handleTransfer}
          style={{
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
        {transferStatus && (
          <p style={{ 
            marginTop: '10px', 
            fontWeight: 'bold',
            color: transferStatus.includes('failed') ? '#ff6b6b' : '#4CAF50'
          }}>
            {transferStatus}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;

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
  const [tonweb, setTonweb] = useState(null);
  const [keypairs, setKeypairs] = useState([]);
  const [showPassphraseIndex, setShowPassphraseIndex] = useState(null);
  const [balances, setBalances] = useState({});
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  // Transfer-related states
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState('');

  // Faucet-related state
  const [faucetAddress, setFaucetAddress] = useState('');
  const [faucetStatus, setFaucetStatus] = useState('');

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
      
      return {
        mnemonic,
        address: address.toString(true, true, true),
      };
    } catch (error) {
      console.error('Error initializing wallet:', error);
      return null;
    }
  };

  // Get balance for a specific address
  const getBalance = async (address) => {
    if (!tonweb) return;
    try {
      const balance = await tonweb.getBalance(address);
      return TonWeb.utils.fromNano(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  };

  // Refresh balances for all addresses
  const refreshBalances = async () => {
    if (!tonweb || refreshingBalances) return;
    
    setRefreshingBalances(true);
    try {
      const newBalances = {};
      for (const keypair of keypairs) {
        newBalances[keypair.address] = await getBalance(keypair.address);
      }
      setBalances(newBalances);
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      setRefreshingBalances(false);
    }
  };

  // Load existing keypairs from localStorage on mount
  useEffect(() => {
    const storedKeypairs = localStorage.getItem('wallet_keypairs');
    if (storedKeypairs) {
      const parsedKeypairs = JSON.parse(storedKeypairs);
      setKeypairs(parsedKeypairs);
    }

    const storedMnemonic = localStorage.getItem('wallet_mnemonic');
    if (storedMnemonic) {
      setMnemonic(storedMnemonic);
      initializeWallet(storedMnemonic).then(() => {
        // Refresh balances after wallet is initialized
        refreshBalances();
      });
    }
  }, []);

  // Auto-refresh balances when keypairs change
  useEffect(() => {
    if (tonweb && keypairs.length > 0) {
      refreshBalances();
    }
  }, [keypairs, tonweb]);

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
  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address);
    alert('Address copied to clipboard!');
  };

  // Perform a transfer from this wallet to another address
  const handleTransfer = async () => {
    if (!tonweb || !keyPair || !keypairs[0] || !toAddress || !amount) {
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

  // Request TON from faucet
  const requestFaucet = async (e) => {
    e.preventDefault();
    if (!faucetAddress) {
      alert('Please enter a wallet address.');
      return;
    }

    setFaucetStatus('Requesting TON from faucet...');
    try {
      const response = await fetch('https://tonhubapi.com/faucet/api/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          address: faucetAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request from faucet');
      }

      const data = await response.json();
      setFaucetStatus('Successfully requested TON from faucet! It may take a few minutes to arrive.');
      setFaucetAddress(''); // Clear the input after successful request
    } catch (error) {
      console.error('Faucet request error:', error);
      setFaucetStatus(`Failed to request TON: ${error.message}`);
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

      {/* Faucet Request Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2>2. Request Test TON</h2>
        <p style={{ fontSize: '14px', marginBottom: '10px', color: '#4CAF50' }}>
          To get test TON tokens, please use the official TON Testnet Faucet Bot on Telegram:
        </p>
        <ol style={{ fontSize: '14px', marginBottom: '10px', paddingLeft: '20px' }}>
          <li>Open Telegram and search for @testgiver_ton_bot</li>
          <li>Start a chat with the bot</li>
          <li>Send your wallet address to receive test TON tokens</li>
        </ol>
        <a 
          href="https://t.me/testgiver_ton_bot" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'inline-block',
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginTop: '10px'
          }}
        >
          Open Telegram Bot
        </a>
        <p style={{ fontSize: '12px', marginTop: '10px', color: '#aaa' }}>
          Note: This is the official way to get testnet TON tokens. The bot may have rate limits and distribution rules.
        </p>
      </div>

      {/* Saved TON Wallet Addresses */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <h2>3. Saved TON Wallet Address</h2>
          <button
            onClick={refreshBalances}
            disabled={refreshingBalances}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: refreshingBalances ? 'not-allowed' : 'pointer',
              opacity: refreshingBalances ? 0.7 : 1
            }}
          >
            {refreshingBalances ? 'Refreshing...' : 'Refresh Balances'}
          </button>
        </div>
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
          Generate New Address
        </button>
        {keypairs.map((keypair, index) => (
          <div
            key={keypair.address}
            style={{
              background: '#444',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <code style={{ wordBreak: 'break-all' }}>{keypair.address}</code>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleCopyAddress(keypair.address)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    background: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Copy Address
                </button>
                <button
                  onClick={() => togglePassphrase(index)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    background: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {showPassphraseIndex === index ? 'Hide Passphrase' : 'Show Passphrase'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                Balance: {balances[keypair.address] || '0'} TON
              </div>
              {showPassphraseIndex === index && (
                <div style={{ marginTop: '10px', color: '#aaa' }}>
                  Passphrase: {keypair.mnemonic}
                </div>
              )}
            </div>
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

import React, { useState, useEffect } from 'react';
import TonWeb from 'tonweb';
import { Buffer } from 'buffer/';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

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
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [mnemonicInput, setMnemonicInput] = useState('');

  // Transfer-related states
  const [toAddress, setToAddress] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState('');

  useEffect(() => {
    // Setup TonWeb instance (Testnet)
    const tw = new TonWeb(
      new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC')
    );
    setTonweb(tw);
  }, []);

  // Convert address to user-friendly format
  const toUserFriendly = (address, { bounceable, testOnly }) => {
    return address.toString({
      urlSafe: true,
      bounceable,
      testOnly,
    });
  };

  // Initialize wallet from a mnemonic array (24 words is typical)
  const initializeWallet = async (mnemonicArray) => {
    try {
      // Convert mnemonic to keypair
      const key = await mnemonicToWalletKey(mnemonicArray);
      const derivedKeyPair = {
        publicKey: key.publicKey,
        secretKey: key.secretKey,
      };
      setKeyPair(derivedKeyPair);

      // Create a V4 wallet contract
      const wallet = WalletContractV4.create({
        publicKey: derivedKeyPair.publicKey,
        workchain: 0,
      });

      // Get address in different formats
      const address = wallet.address;
      const testnetBounceable = toUserFriendly(address, {
        bounceable: true,
        testOnly: true,
      });
      const testnetNonBounceable = toUserFriendly(address, {
        bounceable: false,
        testOnly: true,
      });

      return {
        mnemonic: mnemonicArray.join(" "),
        address: testnetNonBounceable, // Using non-bounceable for safety
        addressBounceable: testnetBounceable
      };
    } catch (error) {
      console.error("Error initializing wallet:", error);
      return null;
    }
  };

  // Get balance for a specific address
  const getBalance = async (address) => {
    if (!tonweb) return '0';
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
      // storedMnemonic is a single string of 12 or 24 words joined by spaces
      const mnemonicArray = storedMnemonic.split(' ');
      setMnemonic(storedMnemonic);
      initializeWallet(mnemonicArray).then(() => {
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

  // Generate new keypair using TON's official mnemonic
  const handleGenerateKeypair = async () => {
    try {
      // Typically 24 words is recommended by TON, but 12 also works
      const generatedMnemonicArray = await mnemonicNew(24);

      // Initialize wallet from that mnemonic array
      const walletData = await initializeWallet(generatedMnemonicArray);

      if (walletData) {
        const newKeypairs = [...keypairs, walletData];
        setKeypairs(newKeypairs);
        localStorage.setItem('wallet_keypairs', JSON.stringify(newKeypairs));

        // Store in localStorage as a single string
        const mnemonicString = generatedMnemonicArray.join(' ');
        setMnemonic(mnemonicString);
        localStorage.setItem('wallet_mnemonic', mnemonicString);
      }
    } catch (error) {
      console.error('Error generating keypair:', error);
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
    if (!tonweb || !fromAddress || !toAddress || !amount) {
      alert('Missing required data for transfer.');
      return;
    }

    // Find the selected wallet's data
    const selectedWallet = keypairs.find(kp => kp.address === fromAddress);
    if (!selectedWallet) {
      alert('Selected wallet not found.');
      return;
    }

    try {
      setTransferStatus('Transferring... Please wait.');

      // Convert stored mnemonic to key
      const mnemonicArray = selectedWallet.mnemonic.split(' ');
      const key = await mnemonicToWalletKey(mnemonicArray);

      // Create v4R2 wallet for the transfer
      const WalletClass = tonweb.wallet.all.v4R2;
      const wallet = new WalletClass(tonweb.provider, {
        publicKey: key.publicKey,
        wc: 0,
      });

      try {
        // Get wallet address and ensure it's properly formatted
        const walletAddress = await wallet.getAddress();
        const formattedWalletAddress = walletAddress.toString(true, true, true);
        console.log('Wallet address:', formattedWalletAddress);

        // Validate destination address
        try {
          const destinationAddress = new TonWeb.utils.Address(toAddress);
          console.log('Destination address:', destinationAddress.toString(true, true, true));
        } catch (error) {
          throw new Error(`Invalid destination address: ${error.message}`);
        }

        let seqno = 0;
        try {
          // Try to get seqno, default to 0 if fails
          const seqnoResult = await wallet.methods.seqno().call();
          if (seqnoResult !== null && seqnoResult !== undefined) {
            seqno = seqnoResult;
          }
          console.log('Current seqno:', seqno);
        } catch (error) {
          console.log('Error getting seqno, using 0:', error.message);
        }

        const nanoAmount = TonWeb.utils.toNano(amount.toString());
        console.log('Transfer amount in nano:', nanoAmount.toString());

        // Prepare transfer parameters
        const transferParams = {
          secretKey: key.secretKey,
          toAddress: toAddress,
          amount: nanoAmount,
          seqno: seqno,
          payload: 'Sent from minimal TON React wallet',
          stateInit: null // We'll let the wallet handle deployment automatically
        };

        console.log('Attempting transfer with params:', {
          ...transferParams,
          secretKey: '[hidden]',
          amount: transferParams.amount.toString()
        });

        await wallet.methods
          .transfer(transferParams)
          .send();

        setTransferStatus(`Transfer successful! Sent ${amount} TON to ${toAddress}`);
      } catch (error) {
        console.error('Transfer error details:', error);
        
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('416')) {
          errorMessage = 'Error connecting to TON network. Please try again.';
        } else if (error.message.includes('address')) {
          errorMessage = 'Invalid wallet address. Please check the destination address.';
        }
        
        setTransferStatus(`Transfer failed: ${errorMessage}`);
        throw error;
      }
    } catch (error) {
      console.error('Transfer error:', error);
      setTransferStatus('Transfer failed. Check console for details.');
    }

    // Refresh balances after transfer
    setTimeout(refreshBalances, 5000);
  };

  // Handle delete address
  const handleDeleteAddress = (address) => {
    setAddressToDelete(address);
  };

  const confirmDelete = () => {
    if (addressToDelete) {
      const newKeypairs = keypairs.filter(kp => kp.address !== addressToDelete);
      setKeypairs(newKeypairs);
      localStorage.setItem('wallet_keypairs', JSON.stringify(newKeypairs));
      setAddressToDelete(null);
    }
  };

  const cancelDelete = () => {
    setAddressToDelete(null);
  };

  // Handle restore wallet from mnemonic
  const handleRestoreWallet = async () => {
    try {
      // Convert mnemonic string to array
      const mnemonicArray = mnemonicInput.trim().split(' ');
      
      // Check if we have exactly 24 words
      if (mnemonicArray.length !== 24) {
        alert('Please enter a valid 24-word mnemonic phrase');
        return;
      }

      const walletData = await initializeWallet(mnemonicArray);
      if (walletData) {
        // Add to keypairs if not already exists
        const exists = keypairs.some(kp => kp.address === walletData.address);
        if (!exists) {
          const newKeypairs = [...keypairs, walletData];
          setKeypairs(newKeypairs);
          localStorage.setItem('wallet_keypairs', JSON.stringify(newKeypairs));
        } else {
          alert('This wallet has already been added');
        }
      }
    } catch (error) {
      console.error('Error restoring wallet:', error);
      alert('Error restoring wallet. Please check your mnemonic phrase.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', color: 'white', background: '#333' }}>
      <h1>Minimal TON Wallet (v4R2)</h1>

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

        {/* Restore Wallet Section */}
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <h3>Restore Wallet</h3>
          <p style={{ fontSize: '14px', marginBottom: '10px' }}>
            Enter your 24-word mnemonic phrase (separated by spaces):
          </p>
          <textarea
            value={mnemonicInput}
            onChange={(e) => setMnemonicInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              minHeight: '100px'
            }}
            placeholder="Enter your 24-word mnemonic phrase here..."
          />
          <button
            onClick={handleRestoreWallet}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              marginBottom: '10px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Restore Wallet
          </button>
        </div>
      </div>

      {/* Informational: Test Giver Bot */}
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
          Note: This is the official way to get testnet TON tokens.
        </p>
      </div>

      {/* Saved TON Wallet Addresses */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <h2>3. Saved TON Wallets</h2>
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
                <button
                  onClick={() => handleDeleteAddress(keypair.address)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
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

      {/* Confirmation Dialog */}
      {addressToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#444',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Delete</h3>
            <p>Are you sure you want to delete this address?</p>
            <code style={{ display: 'block', marginBottom: '15px', wordBreak: 'break-all' }}>
              {addressToDelete}
            </code>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDelete}
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
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Section */}
      <div style={{ marginBottom: '20px' }}>
        <h2>4. Transfer from This Wallet</h2>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            From Address:
            <select
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              style={{
                width: '100%',
                margin: '5px 0',
                padding: '8px',
                background: '#444',
                border: '1px solid #555',
                borderRadius: '4px',
                color: 'white'
              }}
            >
              <option value="">Select wallet address</option>
              {keypairs.map((keypair) => (
                <option key={keypair.address} value={keypair.address}>
                  {keypair.address} ({balances[keypair.address] || '0'} TON)
                </option>
              ))}
            </select>
          </label>
        </div>
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
            fontSize: '16px',
            marginBottom: '10px',
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

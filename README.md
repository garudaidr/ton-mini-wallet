# TON Mini Wallet

A lightweight, user-friendly wallet application for managing TON (The Open Network) cryptocurrency on the testnet. This application is built using React and TonWeb, providing essential wallet functionality in a secure and intuitive interface.

## Features

- **Wallet Generation**: Create new TON wallets with secure mnemonic phrase generation
- **Multiple Wallets**: Support for managing multiple wallet keypairs
- **Secure Storage**: Local storage of encrypted wallet data
- **Transfer Functionality**: Send TON coins to other addresses
- **Testnet Support**: Built on TON testnet for safe testing and development

## Tech Stack

- React (^19.0.0)
- TonWeb (^0.0.66)
- Vite
- BIP39 for mnemonic generation
- Various crypto libraries for secure operations

## Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Run the development server:
```bash
npm run dev
```

## Security Features

- Secure mnemonic phrase generation using BIP39
- Client-side key generation and transaction signing
- Optional passphrase visibility toggle
- No private keys are transmitted over the network

## Development

The application is built using Vite for optimal development experience. To contribute:

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is open source and available under the MIT license.

## Disclaimer

This wallet is connected to the TON testnet and should not be used with real TON coins. It is intended for development and testing purposes only.

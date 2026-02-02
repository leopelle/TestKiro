# Password Manager App

A secure, local-first password manager with end-to-end encryption built in TypeScript.

## Features

- **Local-First Security**: All data encrypted locally, never transmitted to external servers
- **AES-256 Encryption**: Military-grade encryption for all sensitive data
- **Cross-Platform**: Works on mobile and web platforms
- **Property-Based Testing**: Comprehensive testing using fast-check for correctness guarantees
- **Secure Memory Management**: Automatic wiping of sensitive data from memory

## Security Architecture

- **Zero-Knowledge**: No sensitive data ever leaves your device
- **PIN-Based Authentication**: 4-8 digit PIN with lockout protection
- **PBKDF2 Key Derivation**: 100,000 iterations for strong key derivation
- **Secure Memory**: Automatic wiping of cryptographic keys and sensitive data
- **Constant-Time Operations**: Protection against timing attacks

## Development

### Prerequisites

- Node.js 18+ 
- TypeScript 5+
- Jest for testing

### Setup

```bash
npm install
npm run build
npm test
```

### Testing

The project uses a dual testing approach:

- **Unit Tests**: Specific examples and edge cases
- **Property-Based Tests**: Universal properties verified across all inputs

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Security Testing

Property-based tests validate critical security properties:

- Cryptographic round-trip integrity
- Key derivation correctness
- Memory wiping effectiveness
- Timing attack resistance

## Architecture

```
src/
├── types/           # Type definitions and interfaces
├── utils/           # Utility functions (secure memory, crypto helpers)
├── crypto/          # Cryptographic engine
├── auth/            # Authentication service
├── vault/           # Vault management
├── storage/         # Local storage layer
├── ui/              # User interface components
└── tests/           # Test utilities and fixtures
```

## License

MIT License - see LICENSE file for details.

## Security Notice

This software handles sensitive data. Please review the code and security practices before using in production environments.
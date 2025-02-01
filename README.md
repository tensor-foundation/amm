# Tensor AMM Program

## Overview

The Tensor Foundation AMM program allows creating liquidity pools and swapping tokens in a permissionless and decentralized manner.
Fees are split between the Tensor Protocol and brokers facilitating the transactions 50/50.

## Status

The new AMM program is currently deployed to devnet and mainnet.

| Devnet | Mainnet |
| ------ | ------- |
| v1.0.0 | v1.0.0  |

## Programs

This project contains the following programs:

- [Amm](./programs/amm/README.md) `TAMM6ub33ij1mbetoMyVBLeKY5iP41i4UPUJQGkhfsg`

You will need a Rust version compatible with BPF to compile the program, currently we recommend using Rust 1.78.0.

## Clients

This project contains the following clients:

- [JavaScript](./clients/js/README.md)
- [Rust](./clients/rust/README.md)

## Contributing

Check out the [Contributing Guide](./CONTRIBUTING.md) the learn more about how to contribute to this project.

## Build

### Prerequisites

You need the following tools installed to build the project:

- pnpm v9+
- rust v1.78.0
- node v18+
- solana v1.17.23
- anchor v0.29.0

### Steps

Install JavaScript dependencies:

```bash
pnpm install
```

Build the program and generate the clients:

```bash
pnpm programs:build
pnpm generate
```

Run JS and Rust tests:

```bash
pnpm clients:js:test
pnpm clients:rust:test
```

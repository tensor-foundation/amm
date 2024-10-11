# Amm

Version 2 of the Tensor AMM program.

## Status

The new AMM program is currently deployed to devnet.

| Devnet | Mainnet |
| ------ | ------- |
| v0.3.1 | -       |

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

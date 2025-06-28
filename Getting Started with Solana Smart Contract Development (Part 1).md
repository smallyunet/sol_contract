---
title: Getting Started with Solana Smart Contract Development (Part 1)
tags:
  - Smart Contract
  - Tutorial
date: 2025-06-24 21:51:06
draft_date: 2025-06-24 18:36:25
---

> This is a zero-to-one tutorial series that will teach you how to develop Solana smart contracts from the very basics.  
> 
> - **[Part 1](./Getting%20Started%20with%20Solana%20Smart%20Contract%20Development%20(Part%201).md)**: setting up the environment, deploying the HelloWorld contract, and calling the on-chain program  
> - **[Part 2](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20(Part%202).md)**: implementing a minimal USDT-like contract with custom data structures and methods  
> - **[Part 3](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20(Part%203).md)**: reusing the official SPL libraries to issue a standards-compliant token

We will start with the most fundamental operations to learn Solana smart-contract development. A general programming background and understanding of object-oriented concepts is enough—you do **not** need prior experience with smart contracts on other networks, nor with Rust itself.

### 1. Installing the toolchain

Follow the official Solana installation guide: <https://solana.com/docs/intro/installation>

The documentation provides both a one-liner to install all dependencies and step-by-step instructions. Note that **Solana CLI** requires an update to your shell’s environment variables. After everything is installed, the `solana` command should be available:

```bash
solana --help
```

### 2. Initialising the project

Use the `anchor` command to scaffold a smart-contract project. The tool was installed in the previous step. Don’t worry yet about the generated folder structure:

```bash
anchor init hello_sol
cd hello_sol
```

### 3. Writing the contract code

Inside `programs/hello_sol/src` you will find a `lib.rs` file. The `.rs` extension means this is a Rust source file. Copy the following code into it. **Important**: the value inside `declare_id!` is generated automatically when you initialise your own project—do not copy the string below verbatim.

```rust
use anchor_lang::prelude::*;

declare_id!("3Zbdw1oWu1CiMiQr3moQeT4XzMgeqmCvjH5R5wroDWQH");

#[program]
pub mod hello_sol {
    use super::*;

    pub fn say_hello(ctx: Context<Hello>) -> Result<()> {
        msg!("Hello, world!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hello {}
```

### 4. Compiling the smart contract

Compile the contract you just wrote with the `anchor` command. If compilation succeeds there should be **no errors**. Rust is very strict and may emit long warnings—those are fine.

```bash
anchor build
```

### 5. Selecting the default network

Point the local `solana` CLI to **devnet**, which is intended for developers and allows you to test without paying real SOL:

```bash
solana config set --url https://api.devnet.solana.com
```

### 6. Creating a local keypair

Generate a Solana account that will pay deployment fees:

```bash
solana-keygen new -o ~/.config/solana/id.json
```

The command outputs a line starting with `pubkey:`—that is your local account address. Because you already set devnet as the default cluster, you can check the balance directly:

```bash
solana balance
```

You can also open the devnet [explorer](https://explorer.solana.com/?cluster=devnet) and search for your address. The resulting URL looks like:

<https://explorer.solana.com/address/75sFifxBt7zw1YrDfCdPjDCGDyKEqLWrBarPCLg6PHwb?cluster=devnet>

You will, of course, see a balance of **`0 SOL`**.

### 7. Requesting an airdrop on devnet

Airdrop yourself 2 SOL (the maximum per request):

```bash
solana airdrop 2
```

### 8. Deploying the contract to devnet

With the code compiled and your account funded, deploy the program:

```bash
anchor deploy --provider.cluster devnet
```

On success you’ll see **`Deploy success`**. Note the `Program Id:` in the output—that is the on-chain address of your contract, e.g.:

<https://explorer.solana.com/address/3Zbdw1oWu1CiMiQr3moQeT4XzMgeqmCvjH5R5wroDWQH?cluster=devnet>

### 9. Calling the on-chain program

In `hello_sol/app`, create a file named `app.js` and paste the following code. In short, the script loads your local keypair and sends a transaction that invokes the `say_hello` method once per run.

```javascript
const anchor = require('@coral-xyz/anchor');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { Keypair, Connection } = anchor.web3;

const RPC_URL    = process.env.RPC_URL;
const connection = new Connection(RPC_URL, { commitment: 'confirmed' });

const secretKey = Uint8Array.from(
  JSON.parse(
    fs.readFileSync(
      path.join(os.homedir(), '.config/solana/id.json'),
      'utf8',
    ),
  ),
);

const wallet   = new anchor.Wallet(Keypair.fromSecretKey(secretKey));
const provider = new anchor.AnchorProvider(connection, wallet, {
  preflightCommitment: 'confirmed',
});
anchor.setProvider(provider);

const idlPath = path.resolve(__dirname, '../target/idl/hello_sol.json');
const idl     = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const program = new anchor.Program(idl, provider);

(async () => {
  try {
    const sig = await program.methods.sayHello().rpc();
    console.log('✅ tx', sig);
    console.log(`🌐 https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err) {
    console.error('❌', err);
  }
})();
```

Back in the project root, install the Node.js dependencies:

```bash
npm init -y
npm install @coral-xyz/anchor
```

Now run the script (still from the root folder). It will invoke your deployed program on devnet:

```bash
export RPC_URL=https://api.devnet.solana.com
node app/app.js
```

Because Node.js does not honour system proxies by default, you may need a faster RPC endpoint in regions with limited connectivity. Services like [Helius](https://www.helius.dev/) offer free accounts. If you encounter an error like the following, it is almost certainly a network issue—change to a more reliable RPC URL:

```javascript
❌ Error: failed to get recent blockhash: TypeError: fetch failed
    at Connection.getLatestBlockhash (/Users/smallyu/work/github/hello_sol/node_modules/@solana/web3.js/lib/index.cjs.js:7236:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async AnchorProvider.sendAndConfirm (/Users/smallyu/work/github/hello_sol/node_modules/@coral-xyz/anchor/dist/cjs/provider.js:89:35)
    at async MethodsBuilder.rpc [as _rpcFn] (/Users/smallyu/work/github/hello_sol/node_modules/@coral-xyz/anchor/dist/cjs/program/namespace/rpc.js:15:24)
    at async /Users/smallyu/work/github/hello_sol/app/app.js:40:17
```

You might wonder why the contract address was never specified. Look at the `idlPath` variable: `target/idl/hello_sol.json` contains the program’s **IDL**, which in turn includes the program ID. The address is generated offline during compilation—it doesn’t need to be on-chain to exist.

If the script runs without errors, your terminal will print the transaction hash and a clickable URL, e.g.:

<https://explorer.solana.com/tx/2fnPgKkv3tGKKq72hhRxmW6WFSXuofMzXfY2UYoFZXTdJi37btdESy9NzS2gjpWzXX4CL5F7QfxugpctBVaMcBFY?cluster=devnet>

At the bottom of that explorer page you can see the log line `Program logged: "Hello, world!"`, which comes straight from the `msg!` call in your contract.

### 10. Troubleshooting

If you encounter errors, the most common cause is version mismatch. Blockchain tooling evolves rapidly, and incompatibilities appear often. My local environment is:

```text
rustup: rustup 1.28.2 (e4f3ad6f8 2025-04-28)
rustc:  rustc 1.90.0-nightly (706f244db 2025-06-23)
solana: solana-cli 2.2.18 (src:8392f753; feat:3073396398, client:Agave)
anchor: anchor-cli 0.31.1
node:   v24.2.0
@coral-xyz/anchor (npm): ^0.31.1
```

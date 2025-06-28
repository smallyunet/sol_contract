---
title: Getting Started with Solana Smart-Contract Development (Part 3)
date: 2025-06-28 00:01:01
tags:
  - Smart Contract
  - Tutorial
---

> This is a zero-to-one tutorial series that teaches you Solana smart-contract development from the very basics.  
> 
> - **[Part 1](./Getting%20Started%20with%20Solana%20Smart%20Contract%20Development%20(Part%201).md)**: setting up the environment, deploying the HelloWorld contract, and calling the on-chain program  
> - **[Part 2](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20(Part%202).md)**: implementing a minimal USDT-like contract with custom data structures and methods  
> - **[Part 3](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20(Part%203).md)**: reusing the official SPL libraries to issue a standards-compliant token

While writing smart contracts, the program logic itself is relatively lightweight; the complex part is often the various `#[account]` macros and their parameters—whether an account may be auto-created, how many bytes of rent-exempt space to reserve, and so on. Because every Solana account’s data must be loaded into a validator’s RAM (a costly resource), developers must be precise about space usage. Solana’s account model therefore takes a bit of getting used to.

### 1. Issuing a token with CLI tools

For classic scenarios like issuing USDT, Solana already ships pre-built contract logic that can be called directly—or even used via a CLI—so you don’t need to write any code at all. All such tokens are called **SPL Tokens**. To create a 6-decimal SPL token:

```bash
spl-token create-token --decimals 6
```

The command prints an `Address`, e.g. `E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV`; you can look it up on the [explorer](https://explorer.solana.com/address/E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV?cluster=devnet).

Next you must **create an associated token account (ATA)** for your wallet. Think of this as instantiating a record inside the token program—a mapping whose key is your wallet address and whose value stores your USDT balance. Without that record the program can’t find you.

Why this extra step? Because Solana storage is expensive: each ATA reserves 165 bytes. Run `solana rent 165` and you’ll see e.g. `0.00203928 SOL`, which is charged (in addition to TX fees) when the ATA is created.

Create the ATA:

```bash
spl-token create-account E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV
```

The output shows `Creating account` followed by the ATA address, say `E5XmcEJhhGUri8itThLGk8QfPzY1acFid8JmVyo5DWUo`; you can also view it on the explorer.

Wallet and ATA are different addresses. All future USDT transfers go through the **ATA**, not your wallet directly. You can check the link between them:

```bash
spl-token address --verbose --token E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV
```

```text
Wallet address: 75sFifxBt7zw1YrDfCdPjDCGDyKEqLWrBarPCLg6PHwb
Associated token address: E5XmcEJhhGUri8itThLGk8QfPzY1acFid8JmVyo5DWUo
```

Query your USDT balance (parameter is **token mint**, not ATA):

```bash
spl-token balance E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV
```

It is of course 0. Mint yourself some USDT:

```bash
spl-token mint E75GMXAfJ91XuRboSpjwkDmta45Etgt3F3Gf5WLZvLbV 5 E5XmcEJhhGUri8itThLGk8QfPzY1acFid8JmVyo5DWUo
```

Now the balance shows up. To transfer:

```bash
spl-token transfer <MINT> 1 <ATA>
```

For convenience you may supply a **wallet** instead of an ATA as the last argument:

```bash
spl-token transfer <MINT> 1 <RECIPIENT_WALLET>
```

### 2. Writing a contract with the SPL standard library

Let’s call the SPL library inside our own contract. Official, audited code is safer than hand-rolled logic, so we can focus on custom business requirements instead of low-level details like fixed-point arithmetic.

Create a new project:

```bash
anchor init usdt_spl
```

Add the `anchor-spl` dependency; afterward `programs/usdt_spl/Cargo.toml` shows `anchor-spl = "0.31.1"` under `[dependencies]`:

```bash
cargo add anchor-spl
```

At the top of `lib.rs` import the SPL types. We’ve used `Account` and `Signer` before; SPL adds `TokenAccount`, `Mint`, etc.:

```rust
use anchor_spl::token::{self, MintTo, Token, TokenAccount, Mint};
```

Define the account-constraint struct for minting:

```rust
#[derive(Accounts)]
pub struct MintToCtx<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>, 

    #[account(mut)]
    pub to:   Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
```

Note the new `Mint` and `TokenAccount` types come from SPL—we didn’t have to declare them ourselves.

But we still need a helper to convert our context into CPI (cross-program invocation) format:

```rust
impl<'info> From<&MintToCtx<'info>> for CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
    fn from(accts: &MintToCtx<'info>) -> Self {
        let cpi_accounts = MintTo {
            mint:      accts.mint.to_account_info(),
            to:        accts.to.to_account_info(),
            authority: accts.authority.to_account_info(),
        };
        CpiContext::new(accts.token_program.to_account_info(), cpi_accounts)
    }
}
```

SPL tokens live as already-deployed programs on Solana. When you link `anchor-spl` you’re making CPI calls to that shared program.

Add the function in the `#[program]` block:

```rust
pub fn mint_to(ctx: Context<MintToCtx>, amount: u64) -> Result<()> {
    token::mint_to((&*ctx.accounts).into(), amount)
}
```

### 3. Compiling the contract

Compilation will fail unless you enable SPL features in `Cargo.toml`:

```rust
[features]
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-spl = { version = "0.31.1", features = ["token", "idl-build"] }
```

Now it builds:

```bash
anchor build
```

### 4. Writing unit tests

Install the Node dependencies (tests are in TypeScript):

```bash
npm i @coral-xyz/anchor@^0.31 @solana/spl-token chai
```

Put the following in `tests/usdt_spl.ts`:

```ts
import anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createMint,
  createAssociatedTokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const { AnchorProvider, BN } = anchor;

describe("usdt_spl / mint_to", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.UsdtSpl as Program;

  let mintPubkey: anchor.web3.PublicKey;
  let ata: anchor.web3.PublicKey;

  it("creates mint, mints 1 USDT into ATA", async () => {
    mintPubkey = await createMint(
      provider.connection,
      provider.wallet.payer,     // fee-payer
      provider.wallet.publicKey, // mint authority
      null,                      // freeze authority
      6                          // decimals
    );

    ata = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,     // fee-payer
      mintPubkey,
      provider.wallet.publicKey  // owner
    );

    await program.methods
      .mintTo(new BN(1_000_000)) // 1 USDT
      .accounts({
        mint: mintPubkey,
        to: ata,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const accInfo = await getAccount(provider.connection, ata);
    assert.equal(accInfo.amount.toString(), "1000000");
  });
});
```

Run the tests:

```bash
anchor test
```

You should see success output.

### 5. Deploying to devnet

Ensure your wallet has enough SOL, then:

```bash
anchor deploy --provider.cluster devnet
```

If you hit `Operation timed out`, supply a faster RPC:

```bash
anchor deploy --provider.cluster "<your-rpc-url>"
```

To bypass other state-sync issues you can call `solana program deploy` directly:

```bash
solana program deploy \
  target/deploy/usdt_spl.so \
  --program-id target/deploy/usdt_spl-keypair.json \
  --url "<your-rpc-url>"
```

Once deployed you can inspect the address on the explorer.

### 6. Calling the on-chain program via SDK

Reviewing the SDK usage, add `app/app.js`:

```ts
// scripts/mint_to.js  (CommonJS)
const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  createAssociatedTokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const { Keypair, Connection } = anchor.web3;

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, { commitment: "confirmed" });

const secret = Uint8Array.from(
  JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json")))
);
const wallet = new anchor.Wallet(Keypair.fromSecretKey(secret));
const provider = new anchor.AnchorProvider(connection, wallet, {
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);

const idl  = JSON.parse(fs.readFileSync(path.resolve("target/idl/usdt_spl.json")));
const prog = new anchor.Program(idl, provider);

(async () => {
  const mint = await createMint(connection, wallet.payer, wallet.publicKey, null, 6);
  const ata  = await createAssociatedTokenAccount(connection, wallet.payer, mint, wallet.publicKey);

  const sig = await prog.methods
    .mintTo(new anchor.BN(1_000_000))
    .accounts({ mint, to: ata, authority: wallet.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();

  console.log("tx:", sig);
  console.log(`explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  const bal = await getAccount(connection, ata);
  console.log("balance:", bal.amount.toString());
})();
```

A successful run looks like:

```text
tx: 3MgHxsfnJp68mrrABvCh9iwNm6MSXp1SEvk7vDYHoW7KhTEHfVNyMWsbfbEAXTC9gLzcmWu5xbkzia8hgZrcZ18i  
explorer: https://explorer.solana.com/tx/3MgHxsfnJp68mrrABvCh9iwNm6MSXp1SEvk7vDYHoW7KhTEHfVNyMWsbfbEAXTC9gLzcmWu5xbkzia8hgZrcZ18i?cluster=devnet  
balance: 1000000
```

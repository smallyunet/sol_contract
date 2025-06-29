---
title: Getting Started with Solana Smart-Contract Development (Part 2)
date: 2025-06-26 13:56:54
tags:
  - Smart Contract
  - Tutorial
---

> This is a zero-to-one tutorial series that will teach you how to develop Solana smart contracts from the ground up.  
> 
> - **[Part 1](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20Part%201.md)**: setting up the environment, deploying the HelloWorld contract, and calling the on-chain program  
> - **[Part 2](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20Part%202.md)**: implementing a minimal USDT-like contract with custom data structures and methods  
> - **[Part 3](./Getting%20Started%20with%20Solana%20Smart-Contract%20Development%20Part%203.md)**: reusing the official SPL libraries to issue a standards-compliant token

We already know how to create a smart-contract project, deploy it, and invoke it on-chain. Let’s now dive deeper into contract programming itself—how to write the logic you really want. We’ll take a simple USDT-style token contract as an example, analyse the code, and understand Solana contract patterns.

### 1. Create the project

Use the command we learned earlier to scaffold a new project:

```bash
anchor init usdt_clone
```

### 2. The configuration file

Notice the file at `programs/usdt_clone/Cargo.toml`. Cargo is Rust’s package manager, and `Cargo.toml` lists the dependencies and their versions. Two lines are generated for us:

```Rsut
[dependencies]  
anchor-lang = "0.31.1"
```

Anchor’s macros—`#[program]`, `#[account]`, and so on—are the key to Solana contracts. They tell the SVM where the program starts, where data structures are defined, etc. Without the **anchor-lang** dependency the project would be plain Rust, and Solana wouldn’t understand it. That explains how Solana leverages Rust to implement smart contracts.

### 3. The program ID

Open `usdt_clone/programs/usdt_clone/src/lib.rs`. The first line imports Anchor’s prelude—no change needed:

```Rsut
use anchor_lang::prelude::*;
```

The next line calls `declare_id`, which sets this program’s **Program ID**—its on-chain address. As mentioned earlier, Solana program addresses can be generated offline:

```Rsut
declare_id!("CFmGdHuqDymqJYBX44fyNjrFoJx6wRkZPkYgZqfkAQvT");
```

The address is random but must be a valid Ed25519 public key. Change the last **T** to **t** and it becomes invalid. The matching private key was generated during project initialisation and stored in `target/deploy/usdt_clone-keypair.json`.

### 4. Persistent data structures

Add the following code right below `declare_id`:

```Rsut
#[account]
pub struct Mint {
    pub decimals: u8,
    pub mint_authority: Pubkey,
}
```

Think of `#[account]` as declaring an on-chain data structure. Anchor’s black magic lets us read and write it on chain. Here we define a `Mint` struct with two fields: `decimals` (token precision) and `mint_authority` (who can mint).

Define a second struct to hold each user’s balance:

```Rsut
#[account]
pub struct TokenAccount {
    pub owner: Pubkey,
    pub balance: u64,
}
```

### 5. Account-constraint structs

At the bottom of the file you’ll see an auto-generated snippet starting with `#[derive(Accounts)]`. This macro lets you specify constraints for the accounts a method requires. Delete the stub:

```Rsut
#[derive(Accounts)]
pub struct Initialize {}    // delete this
```

…then insert our own constraints:

```Rust
#[derive(Accounts)]
pub struct InitMint<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 1 + 32
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

* `init` creates the account if it doesn’t exist.  
* `payer` says who pays the fee.  
* `space` reserves 8 bytes of Anchor metadata plus 1 byte for `u8` and 32 bytes for `Pubkey`.  
* `mint` is an `Account<Mint>`—it stores a `Mint` struct on chain.  
* `authority` must be mutable (`mut`) and must sign the transaction.  
* `system_program` is boilerplate whenever SOL transfers may occur.

### 6. Contract initialisation

Now edit the `#[program]` block. Remove Anchor’s default `initialize` function and add ours:

```Rust
#[program]
pub mod usdt_clone {
    use super::*;

    pub fn init_mint(ctx: Context<InitMint>, decimals: u8) -> Result<()> {
        let mint = &mut ctx.accounts.mint;
        mint.decimals = decimals;
        mint.mint_authority = ctx.accounts.authority.key();
        Ok(())
    }
}
```

`Context<InitMint>` bundles all the validated accounts. We store the supplied precision and the caller’s key into `mint`, which is automatically persisted on chain.

### 7. Unit tests

Compile first to ensure everything is typed correctly; warnings are fine:

```bash
anchor build
```

Replace `usdt_clone/tests/usdt_clone.ts` with:

```ts
import anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";

const { AnchorProvider, BN } = anchor;

describe("usdt_clone / init_mint", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.UsdtClone as Program;

  const mintKey = Keypair.generate();

  it("creates a Mint with correct metadata", async () => {
    const txSig = await program.methods
      .initMint(new BN(6))
      .accounts({
        mint: mintKey.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintKey])
      .rpc();

    console.log("tx:", txSig);

    const mintAccount = await program.account.mint.fetch(mintKey.publicKey);

    assert.equal(mintAccount.decimals, 6);
    assert.equal(
      mintAccount.mintAuthority.toBase58(),
      provider.wallet.publicKey.toBase58()
    );
  });
});
```

Run the tests:

```bash
anchor test
```

You should see `1 passing (460ms)`.

### 8. Opening accounts & transferring tokens

Add two more account-constraint structs and an error enum:

```rust
#[derive(Accounts)]
pub struct InitTokenAccount<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 8)]
    pub token: Account<'info, TokenAccount>,
    #[account(mut, signer)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut, has_one = owner)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(signer)]
    pub owner: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    InsufficientFunds,
    ArithmeticOverflow,
}
```

Then add two methods—one to open a token account (with an initial balance of 1000 for convenience) and one to transfer tokens:

```Rust
pub fn init_token_account(ctx: Context<InitTokenAccount>) -> Result<()> {
    let token = &mut ctx.accounts.token;
    token.owner = ctx.accounts.owner.key();
    token.balance = 1000;
    Ok(())
}

pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    let from = &mut ctx.accounts.from;
    let to   = &mut ctx.accounts.to;

    require!(from.balance >= amount, ErrorCode::InsufficientFunds);

    from.balance -= amount;
    to.balance = to
        .balance
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(())
}
```

Add unit tests for these new features:

```ts
const tokenA = Keypair.generate();
const tokenB = Keypair.generate();

it("initialises tokenA & tokenB, each with balance 1000", async () => {
  for (const tok of [tokenA, tokenB]) {
    await program.methods
      .initTokenAccount()
      .accounts({
        token: tok.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([tok])
      .rpc();

    const acc = await program.account.tokenAccount.fetch(tok.publicKey);
    assert.equal(
      acc.owner.toBase58(),
      provider.wallet.publicKey.toBase58()
    );
    assert.equal(acc.balance.toNumber(), 1000);
  }
});

it("transfers 250 from A to B (balances 750 / 1250)", async () => {
  await program.methods
    .transfer(new BN(250))
    .accounts({
      from:  tokenA.publicKey,
      to:    tokenB.publicKey,
      owner: provider.wallet.publicKey,
    })
    .rpc();

  const a = await program.account.tokenAccount.fetch(tokenA.publicKey);
  const b = await program.account.tokenAccount.fetch(tokenB.publicKey);

  assert.equal(a.balance.toNumber(), 750);
  assert.equal(b.balance.toNumber(), 1250);
});
```

If you like, deploy this contract to devnet and call it via the SDK to see everything live on chain.

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

  const tokenA = Keypair.generate();
  const tokenB = Keypair.generate();

  it("initializes tokenA & tokenB, each with balance 1000", async () => {
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
});

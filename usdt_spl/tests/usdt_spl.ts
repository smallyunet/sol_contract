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
      provider.wallet.payer,          // fee-payer
      provider.wallet.publicKey,      // mint authority
      null,                           // freeze authority
      6                               // decimals
    );

    ata = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,          // fee-payer
      mintPubkey,
      provider.wallet.publicKey       // owner
    );

    await program.methods
      .mintTo(new BN(1_000_000))      // 1 USDT
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

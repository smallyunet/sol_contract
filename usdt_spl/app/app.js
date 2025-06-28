// scripts/mint_to.js   (CommonJS)
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
const { Keypair, Connection, PublicKey } = anchor.web3;

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, { commitment: "confirmed" });

const secret = Uint8Array.from(
  JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json")))
);
const wallet = new anchor.Wallet(Keypair.fromSecretKey(secret));
const provider = new anchor.AnchorProvider(connection, wallet, {
  preflightCommitment: 'confirmed',
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

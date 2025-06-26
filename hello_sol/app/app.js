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

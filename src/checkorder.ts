
const walletPath = process.env.SAFE_WALLET;
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SAFE,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  AccountInfo
} from '@safecoin/web3.js';

import { BN, Wallet } from "@project-serum/anchor";
import { transfer, WRAPPED_SAFE_MINT } from '@project-serum/serum/lib/token-instructions';
import { Market, OrderParams, OpenOrders } from './lib/market';
import { Key } from 'mz/readline';
import { getAccountKeys, path2Keypair } from './lib/util';
import { sign } from 'mz/crypto';
import { sendTransaction } from './lib/send';

interface TokenAccount {
  pubkey: PublicKey;
  account: AccountInfo<Buffer> | null;
  effectiveMint: PublicKey
}

const money = Wallet.fromPath("./worker.json");
//const wallet = Wallet.fromPath(process.env.HOME + "/xxx/SAFE/CONFIG/mykey");
const MARKET = new PublicKey("FBDnuwp1bjzwYmAnd5n3DHLhLpHWf67hKcPRV2dJkVUa"); // USDC / ETH
const JSON2 = "./worker4.json";
const wallet = Wallet.fromPath(JSON2);

const prog = path2Keypair("PROGS/SERUM-2.json");
console.log(prog.publicKey.toBase58());
const w4 = path2Keypair(JSON2);
console.log(w4.publicKey.toBase58());



(async () => {
  const connection = new Connection("https://api.devnet.safecoin.org");

  const market = await Market.load(connection, MARKET, {}, prog.publicKey);

  console.log("market ok");

  const askBook = await market.loadAsks(connection);
  for (const o of askBook.items()){
    console.log(o);
  }
  const bidBook = await market.loadBids(connection);
  for (const o of bidBook.items()){
    console.log(o);
  }
})()



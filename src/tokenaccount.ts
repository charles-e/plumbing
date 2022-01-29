
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
import * as BufferLayout from 'buffer-layout';
import base64js from 'base64-js';

import { BN, Wallet } from "@project-serum/anchor";
import { transfer, WRAPPED_SAFE_MINT } from '@project-serum/serum/lib/token-instructions';
import { Market } from './lib/market';
import { path2Keypair, getTokenAccountInfo, parseTokenAccountData } from './lib/util';

interface TokenAccount {
  pubkey: PublicKey;
  account: AccountInfo<Buffer> | null;
  effectiveMint: PublicKey
}
const MARKET= new PublicKey("D2jwd21fpUswRv2kX7BahCJcRY1u76i6PGjQxDhXhv3y"); // SOL / BTC
const progId = path2Keypair("PROGS/SERUM-2.json");


const money = Wallet.fromPath("./worker.json");

(async () => {
  const connection = new Connection("https://api.testnet.safecoin.org");
  const balance = await connection.getBalance(money.publicKey, 'finalized') / LAMPORTS_PER_SAFE;

  console.log("balance : ", balance);
  const res2 = await getTokenAccountInfo(connection, money.publicKey);
  console.log(res2);
//   res2.map((n) => {
//     console.log("eMint : ", n.effectiveMint.toBase58());
//   });

//   res2.map((n) => {
//     const data = n?.account?.data;
//     if (data) {
//       const buffer = Buffer.from(data);
//       console.log(buffer.length)
//       if (buffer && buffer.length == 165) {
//         try{
//         let parsed = parseTokenAccountData(buffer);
//         console.log({ "amount": parsed.amount, "mint": parsed.mint.toBase58(), "owner": parsed.owner.toBase58() });
//         } catch (e){
//           console.log((e as Error).message);
//         }
//       } else {
//         console.log("native");
//       }
//     }
//   });
})();
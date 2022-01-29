
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
  } from '@safecoin/web3.js';
  import fs from 'mz/fs';
  import path from 'path';
  import * as borsh from 'borsh';
  import { Wallet } from "@project-serum/anchor";

console.log(walletPath);

const money = Wallet.fromPath("/Users/cme/xxx/SAFE/CONFIG/mykey");

(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");
    const balance = await connection.getBalance(money.publicKey,'finalized');
    console.log("balance for ",money.publicKey.toBase58(), " is ", (balance/LAMPORTS_PER_SAFE));

})()
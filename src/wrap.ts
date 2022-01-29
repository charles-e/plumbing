
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
  import {WRAPPED_SAFE_MINT} from '@project-serum/serum/lib/token-instructions';
import { Market , OrderParams } from './market';
import { Key } from 'mz/readline';

interface TokenAccount {
    pubkey: PublicKey;
    account: AccountInfo<Buffer> | null;
    effectiveMint: PublicKey
}

const money = Wallet.fromPath("./worker.json");
const me_money = Wallet.fromPath(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");
const MARKET= new PublicKey("RNvwovSsjLoE5qhShdLcg1vRqaWW8YVxyvjwgwSohMM"); // Dai / SAF
const JSON1="./worker.json";
const JSON2="./worker2.json";
const prog = path2Keypair("PROGS/SERUM-2.json");
const w1=path2Keypair(JSON1);
const w2=path2Keypair(JSON2);

function path2Keypair(path :string): Keypair {
    const payer = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          require("fs").readFileSync(path, {
            encoding: "utf-8",
          })
        )
      )
    );
    return payer
  }


(async() => {
    let wrap_mint = new PublicKey("Safe111111111111111111111111111111111111112");
    console.log(wrap_mint);
    let rando = new PublicKey('CZjdmef7UgwW1PEM5BEgoxHQFSo8U6f8amLK8YVrxwNS');
    const connection = new Connection("https://api.testnet.safecoin.org");
    const accounts = await connection.getTokenAccountsByOwner(rando,{ mint : wrap_mint});
    console.log(accounts);
})()


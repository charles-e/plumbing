
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


interface TokenAccount {
    pubkey: PublicKey;
    account: AccountInfo<Buffer> | null;
    effectiveMint: PublicKey
}

const money = Wallet.fromPath("./worker.json");

(async() => {
     const TOKEN_PROGRAM_ID = new PublicKey(
        'ToKLx75MGim1d1jRusuVX8xvdvvbSDESVaNXpRA9PHN',
      );
      
    const connection = new Connection("https://api.testnet.safecoin.org");
    const balance = await connection.getBalance(money.publicKey,'finalized');
    console.log("balance for ",money.publicKey.toBase58(), " is ", (balance/LAMPORTS_PER_SAFE));
    const res = await connection.getParsedTokenAccountsByOwner(money.publicKey,{"programId" : TOKEN_PROGRAM_ID});

    console.log(res);
    console.log(res.value);
    res.value.map((n) => {
        const data = n?.account?.data;
        console.log(data);
        console.log("tokenAmount: ",data?.parsed?.info?.tokenAmount);
      });
    
    
    //const res2 = await getTokenAccountInfo(connection,money.publicKey);
    //console.log(res2);

})()

export const ACCOUNT_LAYOUT = BufferLayout.struct([
    BufferLayout.blob(32, 'mint'),
    BufferLayout.blob(32, 'owner'),
    BufferLayout.nu64('amount'),
    BufferLayout.blob(101)
  ]);
  
  
  export const MINT_LAYOUT = BufferLayout.struct([
    BufferLayout.blob(44),
    BufferLayout.u8('decimals'),
    BufferLayout.u8('initialized'),
    BufferLayout.blob(36),
  ]);
  
  export function parseTokenAccountData(
    data: Buffer
  ): { mint: PublicKey; owner: PublicKey; amount: BN } {
    let { mint, owner } = ACCOUNT_LAYOUT.decode(data);
    let tempB =  Buffer.from(data);
    let amountBE = tempB.readUIntLE(64,4);
    let amountLE = tempB.readUIntLE(68,4);

        //let amountBE = tempB.readUIntLE(64,8);
   // let amount2 = tempB.readUInt32LE(68);
   let amount : BN  = new BN(amountBE) ;
    amount = amount.shln(32);
    amount.add(new BN(amountLE));

    return {
      mint: new PublicKey(mint),
      owner: new PublicKey(owner),
      amount: amount
    };
  }
  
  export function parseTokenMintData(data: Buffer) {
    let { decimals, initialized } = MINT_LAYOUT.decode(data);
    console.log("got decimals ",decimals, "initialized ", initialized);
    return { decimals, initialized };
  }
  
  export function getOwnedAccountsFilters(publicKey: PublicKey) {
    return [
      {
        memcmp: {
          offset: ACCOUNT_LAYOUT.offsetOf('owner'),
          bytes: publicKey.toBase58(),
        },
      },
      {
        dataSize: ACCOUNT_LAYOUT.span,
      },
    ];
  }

 
  
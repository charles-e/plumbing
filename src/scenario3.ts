
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
import { Market , OrderParams } from './lib/market';
import { Key } from 'mz/readline';
import { getAccountKeys, path2Keypair } from './lib/util';

interface TokenAccount {
    pubkey: PublicKey;
    account: AccountInfo<Buffer> | null;
    effectiveMint: PublicKey
}

const money = Wallet.fromPath("./worker.json");
const me_money = Wallet.fromPath(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");
const MARKET= new PublicKey("D2jwd21fpUswRv2kX7BahCJcRY1u76i6PGjQxDhXhv3y"); // SOL / BTC
const JSON1="./worker3.json";
const JSON2="./worker4.json";
const prog = path2Keypair("PROGS/SERUM-2.json");
const w3=path2Keypair(JSON1);
const w4=path2Keypair(JSON2);


(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");

    const market = await Market.load(connection,MARKET,{},prog.publicKey);

    console.log("market ok");
    const w3_info = await getAccountKeys(market,connection,w3);
    const w4_info = await getAccountKeys(market,connection,w4);

  //   console.log("w3 : ",w3.publicKey.toBase58());
  //   console.log("payer : ",me_money.publicKey.toBase58());
  //   let order : OrderParams = {
  //       owner: w3,
  //       payer:w3_info.base,
  //       side:('sell' as any),
  //       price:1,
  //       size: 1,
  //       orderType :('limit' as any),
  //       clientId:new BN(1),
  //     } ;
  //   const res1 = await market.placeOrder(connection,order);

  //   let order2 : OrderParams = {
  //     owner: w4,
  //     payer:w4_info.quote,
  //     side:('buy' as any),
  //     price:1.000001,
  //     size: 1,
  //     orderType :('limit' as any),
  //     clientId:new BN(1),
  //   } ;

  // const res2 = await market.placeOrder(connection,order2);



  // const res3 = await market.consumeEvents(connection,w3);
  // console.log('consumeEvents w3 = ',res3);
  // const res4 = await market.consumeEvents(connection,w4);
  // console.log('consumeEvents w4 = ',res4);


  // const res5 = await market.settleFunds(connection,w3,w3_info.base,w3_info.quote);
  // console.log('settleFunds w3 = ',res5);

  const res6 = await market.settleFunds(connection,w4,w4_info.base,w4_info.quote);
  console.log('settleFunds w4 = ',res6);



})()


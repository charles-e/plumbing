
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
const MARKET= new PublicKey("9RoXwpmKt5YEBuoPCdYmURyFbfJmZuJersywTkqY3MBu"); // Dai / SAF
const JSON1="./worker.json";
const JSON2="./worker2.json";
const prog = path2Keypair("PROGS/SERUM-2.json");
const w1=path2Keypair(JSON1);
const w2=path2Keypair(JSON2);


(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");
    const balance = await connection.getBalance(money.publicKey,'finalized');
    const ai2 = await connection.getAccountInfo(me_money.publicKey);
    const market = await Market.load(connection,MARKET,{},prog.publicKey);

    console.log("market ok");
    const w1_info = await getAccountKeys(market,connection,w1);
    const w2_info = await getAccountKeys(market,connection,w2);

    console.log("w1 : ",w1.publicKey.toBase58());
    console.log("payer : ",me_money.publicKey.toBase58());
    let order : OrderParams = {
        owner: w1,
        payer:w1_info.base,
        side:('sell' as any),
        price:1,
        size: 1,
        orderType :('limit' as any),
        clientId:new BN(1),
      } ;
    const res1 = await market.placeOrder(connection,order);

    let order2 : OrderParams = {
      owner: w2,
      payer:w2_info.quote,
      side:('buy' as any),
      price:1.000001,
      size: 1,
      orderType :('limit' as any),
      clientId:new BN(1),
    } ;

  const res2 = await market.placeOrder(connection,order2);



  const res3 = await market.consumeEvents(connection,w1);
  const res4 = await market.consumeEvents(connection,w2);

  const res5 = await market.settleFunds(connection,w1,w1_info.base,w1_info.quote);
  const res6 = await market.settleFunds(connection,w2,w2_info.base,w2_info.quote);

//   const w1_orders = await market.findOpenOrdersAccountsForOwner(connection,w1.publicKey,100);
//   const res4 = await market.settleFunds(connection,w1,w1_orders[0],w1_info.base,w1_info.quote);

//   const w2_orders = await market.findOpenOrdersAccountsForOwner(connection,w2.publicKey,100);
//   const res5 = await market.settleFunds(connection,w2,w2_orders[0],w2_info.base,w2_info.quote);
})()



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

import { Market , OrderParams } from './lib/market';
import { path2Keypair, getAccountKeys } from './lib/util';
import { BN, Wallet } from "@project-serum/anchor";


const me_money = Wallet.fromPath(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");
const JSON1="./worker.json";
const JSON2="./worker2.json";
const MARKET="RNvwovSsjLoE5qhShdLcg1vRqaWW8YVxyvjwgwSohMM"; // Dai / SAF
const marketKey = new PublicKey(MARKET)
const money = Wallet.fromPath("/Users/cme/xxx/SAFE/CONFIG/mykey");
const progId = path2Keypair("PROGS/SERUM-2.json");
const w1=path2Keypair(JSON1);
const w2=path2Keypair(JSON2);

(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");
    const balance = await connection.getBalance(money.publicKey,'finalized');
    const market = await Market.load(connection,marketKey,{},progId.publicKey);

        // get the open orders for each user

        const w2_info = await getAccountKeys(market,connection,w2);
        console.log (w2_info.orders.toBase58());


        let order2 : OrderParams = {
          owner: w2,
          payer:w2_info.quote,
          side:('buy' as any),
          price:1.000001,
          size: 1,
          orderType :('limit' as any),
          clientId:new BN(1),
          openOrdersAddressKey: w2_info.orders
        } ;

      const res2 = await market.placeOrder2(connection,order2);

})()
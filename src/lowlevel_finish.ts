
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


const me_money = path2Keypair(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");
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

    const w1_info = await getAccountKeys(market,connection,w1);
    const w2_info = await getAccountKeys(market,connection,w2);

        // crank

      const res = await market.consumeEvents(connection,[w1_info.orders,w2_info.orders],me_money);

      const w1_orders = await market.findOpenOrdersAccountsForOwner(connection,w1.publicKey,100);
      const res2 = await market.settleFunds(connection,w1,w1_orders[0],w1_info.base,w1_info.quote);

      const w2_orders = await market.findOpenOrdersAccountsForOwner(connection,w2.publicKey,100);
      const res3 = await market.settleFunds(connection,w2,w2_orders[0],w2_info.base,w2_info.quote);

})()
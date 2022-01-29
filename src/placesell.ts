
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
  let w4_info = await getAccountKeys(market, connection, w4);
  console.log(w4_info);
  let ooAccountAddr : PublicKey;
  let signers : Keypair[] = [];
  let ooAccounts = await market.findOpenOrdersAccountsForOwner(connection, wallet.publicKey, 200);
  let txn;
  if (ooAccounts.length == 0) {
    console.log("will create Open Orders");
     const ooAccount = new Keypair();
      txn = await OpenOrders.makeCreateOOAccountTransaction(connection, market.address, wallet.publicKey, prog.publicKey, ooAccount.publicKey);
      signers.push(ooAccount);
      ooAccountAddr = ooAccount.publicKey;
}
  else {
    txn = new Transaction();
    ooAccountAddr = ooAccounts[0].address;
  }

  console.log("feePayer = ", wallet.publicKey.toBase58());

  let order: OrderParams = {
    owner: wallet.publicKey,
    payer: w4_info.base,
    side: ('sell' as any),
    price: 1,
    size: 0.001,
    orderType: ('limit' as any),
    clientId: new BN(1),
    openOrdersAddressKey: ooAccountAddr
  };
  const order_ix = await market.makePlaceOrderInstruction(connection, order);

  const con_ix = await market.makeConsumeEventsInstruction([ooAccountAddr], 3);
  txn.add(order_ix)
  txn.add(con_ix);

  console.log("about to send");
  await sendTransaction(
    {
      connection: connection,
      transaction: txn,
      wallet: wallet,
      signers: signers,
      sendingMessage: "sending",
      sentMessage: "sent",
      successMessage: "success",
      timeout: 15000,
      sendNotification: true
    });

})()


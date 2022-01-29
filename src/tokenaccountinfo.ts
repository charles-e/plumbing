
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


interface TokenAccount {
  pubkey: PublicKey;
  account: AccountInfo<Buffer> | null;
  effectiveMint: PublicKey
}

const money = Wallet.fromPath("./worker.json");

(async () => {
  const connection = new Connection("https://api.testnet.safecoin.org");
  const balance = await connection.getBalance(money.publicKey, 'finalized');
  console.log("balance : ", balance);
  const res2 = await getTokenAccountInfo(connection, money.publicKey);
  console.log(res2);
  res2.map((n) => {
    console.log("eMint : ", n.effectiveMint.toBase58());
  });
  res2.map((n) => {
    const data = n?.account?.data;
    if (data) {
      const buffer = Buffer.from(data);
      console.log(buffer.length)
      if (buffer && buffer.length == 165) {
        try{
        let parsed = parseTokenAccountData(buffer);
        console.log({ "amount": parsed.amount.toNumber(), "mint": parsed.mint.toBase58(), "owner": parsed.owner.toBase58() });
        } catch (e){
          console.log((e as Error).message);
        }
      } else {
        console.log("native");
      }
    }
  });

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
  let { mint, owner, amount } = ACCOUNT_LAYOUT.decode(data);
  let tempB = Buffer.from(data);
  let amountBE = tempB.readUIntLE(64, 4);
  console.log(amountBE);
  let amountLE = tempB.readUIntLE(68, 4);
  console.log(amountLE);

  //let amountBE = tempB.readUIntLE(64,8);
  // let amount2 = tempB.readUInt32LE(68);
  let amount2: BN = new BN(amountLE);
  amount2 = amount.shln(32);
  amount2.add(new BN(amountBE));
  console.log(amount);
  return {
    mint: new PublicKey(mint),
    owner: new PublicKey(owner),
    amount: amount
  };
}

export function parseTokenMintData(data: Buffer) {
  let { decimals, initialized } = MINT_LAYOUT.decode(data);
  console.log("got decimals ", decimals, "initialized ", initialized);
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

export const TOKEN_PROGRAM_ID = new PublicKey(
  'ToKLx75MGim1d1jRusuVX8xvdvvbSDESVaNXpRA9PHN',
);

export async function getOwnedTokenAccounts(
  connection: Connection, publicKey: PublicKey
): Promise<Array<{ publicKey: PublicKey, accountInfo: AccountInfo<Buffer> }>> {
  let filters = getOwnedAccountsFilters(publicKey);
  // console.log('getting accounts for '+publicKey.toBase58());
  // @ts-ignore
  let resp = await connection._rpcRequest('getProgramAccounts', [
    TOKEN_PROGRAM_ID.toBase58(),
    {
      encoding: "base64",
      commitment: connection.commitment,
      filters,
    },
  ]);
  if (resp.error) {
    throw new Error(
      'failed to get token accounts owned by ' +
      publicKey.toBase58() +
      ': ' +
      resp.error.message,
    );
  }
  console.log(resp.result);
  const ret =  resp.result
    .map(({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data: base64js.toByteArray(data[0]),
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }));
    console.log("returning %d",ret.length);
    return ret;
}

export async function getTokenAccountInfo(connection: Connection, ownerAddress: PublicKey) {
  console.log("here for ",ownerAddress.toBase58());
  let [splAccounts, account] = await Promise.all([
    getOwnedTokenAccounts(connection, ownerAddress),
    connection.getAccountInfo(ownerAddress),
  ]);
  const parsedSplAccounts: TokenAccount[] = splAccounts.map(({ publicKey, accountInfo }) => {
    const buffer = Buffer.from(accountInfo.data);
    console.log(buffer.length);
    if (buffer && buffer.length == 165) {
      console.log("parsing....");
    let parsedAccts = parseTokenAccountData(accountInfo.data);
    
    console.log("parsed amount ", parsedAccts.amount);
    return {
      pubkey: publicKey,
      account: accountInfo,
      effectiveMint: parsedAccts.mint,
    }
    }
    return {
      pubkey: ownerAddress,
      account: account,
      effectiveMint: WRAPPED_SAFE_MINT,
    };
  });
  //  // console.log("parsedSplAccounts");
  //  console.log(parsedSplAccounts.map((a) => ({"pubkey" : a.pubkey.toBase58(),
  // "account": a.account, "mint":a.effectiveMint.toBase58() })));
  return parsedSplAccounts.concat({
    pubkey: ownerAddress,
    account: account,
    effectiveMint: WRAPPED_SAFE_MINT,
  });
}

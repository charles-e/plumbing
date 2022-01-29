import {
  Keypair,
  Connection,
  PublicKey,
  AccountInfo
} from '@safecoin/web3.js';

import { Market } from './market';
import * as BufferLayout from '@solana/buffer-layout';
import base64js from 'base64-js';
import { WRAPPED_SAFE_MINT } from '@project-serum/serum/lib/token-instructions';

export const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function path2Keypair(path: string): Keypair {
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

export async function getAccountKeys(market: Market, connection: Connection, user: Keypair): Promise<{ base: PublicKey; quote: PublicKey; orders: PublicKey;}> {
  const base = await market.findBaseTokenAccountsForOwner(connection, user.publicKey, false);
  const quote = await market.findQuoteTokenAccountsForOwner(connection, user.publicKey, false);
  const accounts = await market.findOpenOrdersAccountsForOwner(connection, user.publicKey, 1000);

  console.log("orders : ", accounts.length);
  let order;
  if (accounts.length > 0) {
    order = accounts[0].address;
  } else {
    let openOrderAcct = new Keypair();
    let orderAcct = await market.createOpenOrders(connection, { owner: user, account: openOrderAcct });
    order = openOrderAcct.publicKey
  }
  console.log( {
    base: base[0].pubkey.toBase58(),
    quote: quote[0].pubkey.toBase58(),
    orders: order.toBase58(),
    count: accounts.length
  });
  return {
    base: base[0].pubkey,
    quote: quote[0].pubkey,
    orders: order,
  };
}

export function getOwnedAccountsFilters(publicKey: PublicKey): ({ memcmp: { offset: number; bytes: string; }; dataSize?: number; } | { dataSize: number; memcmp?: undefined; })[] {
  return [
    {
      memcmp: {
        offset: ACCOUNT_LAYOUT.offsetOf('owner') ?? 0,
        bytes: publicKey.toBase58(),
      },
    },
    {
      dataSize: ACCOUNT_LAYOUT.span,
    },
  ];
}

export interface TokenAccount {
  pubkey: PublicKey;
  account: AccountInfo<Buffer> | null;
  effectiveMint: PublicKey
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
  return resp.result
    .map(({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data: base64js.toByteArray(data[0]),
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }));
}

export const ACCOUNT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(32, 'mint'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.nu64('amount'),
  BufferLayout.blob(93),
]);


export function parseTokenAccountData(
  data: Buffer
): { mint: PublicKey; owner: PublicKey; amount: number } {
  let { mint, owner, amount } = ACCOUNT_LAYOUT.decode(data);
  return {
    mint: new PublicKey(mint),
    owner: new PublicKey(owner),
    amount,
  };
}


export async function getTokenAccountInfo(connection: Connection, ownerAddress: PublicKey) {
  let [splAccounts, account] = await Promise.all([
    getOwnedTokenAccounts(connection, ownerAddress),
    connection.getAccountInfo(ownerAddress),
  ]);
  const parsedSplAccounts: TokenAccount[] = splAccounts.map(({ publicKey, accountInfo }) => {
    return {
      pubkey: publicKey,
      account: accountInfo,
      effectiveMint: parseTokenAccountData(accountInfo.data).mint,
    };
  });
  // console.log("parsedSplAccounts");
  console.log(parsedSplAccounts.map((a) => ({
    "pubkey": a.pubkey.toBase58(),
    "account": a.account, "mint": a.effectiveMint.toBase58()
  })));
  return parsedSplAccounts.concat({
    pubkey: ownerAddress,
    account,
    effectiveMint: WRAPPED_SAFE_MINT,
  });
}


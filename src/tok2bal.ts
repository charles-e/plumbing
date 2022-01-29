
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
const me_money = Wallet.fromPath(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");

(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");
    const balance = await connection.getBalance(money.publicKey,'finalized');
    console.log("balance for ",money.publicKey.toBase58(), " is ", (balance/LAMPORTS_PER_SAFE));
    const ai = await connection.getAccountInfo(money.publicKey);
    console.log("account info", ai);
    const ai2 = await connection.getAccountInfo(me_money.publicKey);
    console.log("my account info", ai2);


    const res2 = await getTokenAccountInfo(connection,me_money.publicKey);
    console.log(res2);
    let splAccounts =  await getOwnedTokenAccounts(connection, money.publicKey);

    const parsedSplAccounts: TokenAccount[] = splAccounts.map(({ publicKey, accountInfo }) => {
      return {
        pubkey: publicKey,
        account: accountInfo,
        effectiveMint: parseTokenAccountData(accountInfo.data).mint,
      };
    });
    console.log("spl accounts : ", parsedSplAccounts);
})()

export const ACCOUNT_LAYOUT = BufferLayout.struct([
    BufferLayout.blob(32, 'mint'),
    BufferLayout.blob(32, 'owner'),
 //   BufferLayout.nu64('amount'),
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
    amount = amount.ushln(32);
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
  
  export const TOKEN_PROGRAM_ID = new PublicKey(
    'ToKLx75MGim1d1jRusuVX8xvdvvbSDESVaNXpRA9PHN',
  );
  
  export async function getOwnedTokenAccounts(
      connection: Connection, publicKey: PublicKey
  ): Promise<Array<{publicKey: PublicKey, accountInfo: AccountInfo<Buffer>}>> {
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
      .map(({ pubkey , account: { data, executable, owner, lamports } }) => ({
        publicKey: new PublicKey(pubkey),
        accountInfo: {
          data: base64js.toByteArray(data[0]),
          executable,
          owner: new PublicKey(owner),
          lamports,
        },
      }));
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

   return "";
//    console.log(parsedSplAccounts.map((a) => ({"pubkey" : a.pubkey.toBase58(),
//   "account": a.account, "mint":a.effectiveMint.toBase58() })));
//     return parsedSplAccounts.concat({
//       pubkey: ownerAddress,
//       account,
//       effectiveMint: WRAPPED_SAFE_MINT,
//     });
  }
  
  
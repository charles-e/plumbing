import { Account, Connection, Keypair, PublicKey, Transaction, SimulatedTransactionResponse,
   RpcResponseAndContext , Commitment, TransactionSignature ,AccountInfo } from '@safecoin/web3.js';
   import  { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@safecoin/safe-token'
import { Market,  parseInstructionErrorResponse } from '@project-serum/serum';
import { struct } from 'superstruct';
import { BN, Wallet } from '@project-serum/anchor';
import assert from 'assert/strict';

let market_info = {
  "address": "8CUzBFYQ67UqMso3pRxASUzCQBSXP2W3EtesUtEF62S8",
  "deprecated": false,
  "name": "SAFD/USDT",
  "programId": "5eRmSCBGTR5tLgZVZkfab55NHWYDRvzMQM9ktoFZE9uJ",
  "owner": "4EbSGt8njxt5TU3fVJhFkQJ8UsRaPxrVzR6KGS8JR1Je"
};
let USDT = {
  "address": "USDtjZJUgS4QW69RxbuDn4e6c1kKMqwKzsVJRbaEBRo",
  "name": "USDT"
};
let SAFD = {
  "address": "SAFdssqXC6pnewMdWGWfL6zTsoLV8Yz4LbvqKjUieoQ",
  "name": "SAFD"
};
let HOME = process.env.HOME;
let WALLET_PATH = HOME + "/xxx/SAFE/CONFIG/mykey";
let marketAddress = new PublicKey(market_info.address);
let connection = new Connection("https://api.testnet.safecoin.org");
let programAddress = new PublicKey(market_info.programId);

let payer_wallet = Wallet.fromPath(WALLET_PATH);
let worker_wallet = Wallet.fromPath("./worker.json");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

let DEFAULT_TIMEOUT = 60000;

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

export function getDecimalCount(value): number {
  if (!isNaN(value) && Math.floor(value) !== value)
    return value.toString().split('.')[1].length || 0;
  return 0;
}

(async () => {

  let market = await Market.load(connection, marketAddress, {}, programAddress);
  console.log("base mint: ",market.baseMintAddress.toBase58());
  console.log("quote mint: ",market.quoteMintAddress.toBase58());
  const order = {
    side: "buy",
    price: 1.99,
    size: 1,
    orderType: "limit",
    market: market,
    connection: connection,
    wallet: worker_wallet,
    baseCurrencyAccount: new PublicKey(SAFD.address),
    quoteCurrencyAccount: new PublicKey(USDT.address)

  };
  const tx = await placeOrder((order as any));

})();

export async function placeOrder({
  side,
  price,
  size,
  orderType,
  market,
  connection,
  wallet,
  baseCurrencyAccount,
  quoteCurrencyAccount,
  feeDiscountPubkey = undefined,
}: {
  side: 'buy' | 'sell';
  price: number;
  size: number;
  orderType: 'ioc' | 'postOnly' | 'limit';
  market: Market | undefined | null;
  connection: Connection;
  wallet: WalletAdapter;
  baseCurrencyAccount: PublicKey | undefined;
  quoteCurrencyAccount: PublicKey | undefined;
  feeDiscountPubkey: PublicKey | undefined;
}) {
  let formattedMinOrderSize =
    market?.minOrderSize?.toFixed(getDecimalCount(market.minOrderSize)) ||
    market?.minOrderSize;
  let formattedTickSize =
    market?.tickSize?.toFixed(getDecimalCount(market.tickSize)) ||
    market?.tickSize;
  const isIncrement = (num, step) =>
    Math.abs((num / step) % 1) < 1e-5 ||
    Math.abs(((num / step) % 1) - 1) < 1e-5;
  if (isNaN(price)) {
    console.log({ message: 'Invalid price', type: 'error' });
    return;
  }
  if (isNaN(size)) {
    console.log({ message: 'Invalid size', type: 'error' });
    return;
  }
  if (!wallet || !wallet.publicKey) {
    console.log({ message: 'Connect wallet', type: 'error' });
    return;
  }
  if (!market) {
    console.log({ message: 'Invalid  market', type: 'error' });
    return;
  }
  if (!isIncrement(size, market.minOrderSize)) {
    console.log({
      message: `Size must be an increment of ${formattedMinOrderSize}`,
      type: 'error',
    });
    return;
  }
  if (size < market.minOrderSize) {
    console.log({ message: 'Size too small', type: 'error' });
    return;
  }
  if (!isIncrement(price, market.tickSize)) {
    console.log({
      message: `Price must be an increment of ${formattedTickSize}`,
      type: 'error',
    });
    return;
  }
  if (price < market.tickSize) {
    console.log({ message: 'Price under tick size', type: 'error' });
    return;
  }
  const owner = wallet.publicKey;
  const transaction = new Transaction();
  const signers: Keypair[] = [];

  if (!baseCurrencyAccount) {
    const {
      transaction: createAccountTransaction,
      newAccountPubkey,
    } = await createTokenAccountTransaction({
      connection,
      wallet,
      mintPublicKey: market.baseMintAddress,
    });
    transaction.add(createAccountTransaction);
    baseCurrencyAccount = newAccountPubkey;
  }
  if (!quoteCurrencyAccount) {
    const {
      transaction: createAccountTransaction,
      newAccountPubkey,
    } = await createTokenAccountTransaction({
      connection,
      wallet,
      mintPublicKey: market.quoteMintAddress,
    });
    transaction.add(createAccountTransaction);
    quoteCurrencyAccount = newAccountPubkey;
  }

  const payer = side === 'sell' ? baseCurrencyAccount : quoteCurrencyAccount;
  if (!payer) {
    console.log({
      message: 'Need an SPL token account for cost currency',
      type: 'error',
    });
    return;
  }
  const params = {
    owner,
    payer,
    side,
    price,
    size,
    orderType,
    feeDiscountPubkey: feeDiscountPubkey || null,
  };
  console.log(params);

  const matchOrderstransaction = market.makeMatchOrdersTransaction(5);
  transaction.add(matchOrderstransaction);
  const startTime = getUnixTs();
  let {
    transaction: placeOrderTx,
    signers: placeOrderSigners,
  } = await market.makePlaceOrderTransaction(
    connection,
    params,
    120_000,
    120_000,
  );
  const endTime = getUnixTs();
  console.log(`Creating order transaction took ${endTime - startTime}`);
  transaction.add(placeOrderTx);
  transaction.add(market.makeMatchOrdersTransaction(5));
  signers.push(...placeOrderSigners);

  return await sendTransaction({
    transaction,
    wallet,
    connection,
    signers,
    sendingMessage: 'Sending order...',
  });
}

export async function createTokenAccountTransaction({
  connection,
  wallet,
  mintPublicKey,
}: {
  connection: Connection;
  wallet: WalletAdapter;
  mintPublicKey: PublicKey;
}): Promise<{
  transaction: Transaction;
  newAccountPubkey: PublicKey;
}> {
  const ata = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mintPublicKey,
    wallet.publicKey,
  );
  const transaction = new Transaction();
  transaction.add(
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPublicKey,
      ata,
      wallet.publicKey,
      wallet.publicKey,
    ),
  );
  return {
    transaction,
    newAccountPubkey: ata,
  };
}

export interface WalletAdapter {
  publicKey: PublicKey;
  autoApprove: boolean;
  connected: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transaction: Transaction[]) => Promise<Transaction[]>;
  connect: () => any;
  disconnect: () => any;
  on<T>(event: string, fn: () => void): this;
}


export async function sendTransaction({
  transaction,
  wallet,
  signers = [],
  connection,
  sendingMessage = 'Sending transaction...',
  sentMessage = 'Transaction sent',
  successMessage = 'Transaction confirmed',
  timeout = DEFAULT_TIMEOUT,
  sendNotification = true,
}: {
  transaction: Transaction;
  wallet: WalletAdapter;
  signers?: Array<Keypair>;
  connection: Connection;
  sendingMessage?: string;
  sentMessage?: string;
  successMessage?: string;
  timeout?: number;
  sendNotification?: boolean;
}) {
  const signedTransaction = await signTransaction({
    transaction,
    wallet,
    signers,
    connection,
  });
  return await sendSignedTransaction({
    signedTransaction,
    connection,
    sendingMessage,
    sentMessage,
    successMessage,
    timeout,
    sendNotification,
  });
}

export async function signTransaction({
  transaction,
  wallet,
  signers = [],
  connection,
}: {
  transaction: Transaction;
  wallet: WalletAdapter;
  signers?: Array<Keypair>;
  connection: Connection;
}) {
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash('max')
  ).blockhash;
  transaction.setSigners(wallet.publicKey, ...signers.map((s) => s.publicKey));
  if (signers.length > 0) {
    transaction.partialSign(...signers);
  }
  return await wallet.signTransaction(transaction);
}

export async function signTransactions({
  transactionsAndSigners,
  wallet,
  connection,
}: {
  transactionsAndSigners: {
    transaction: Transaction;
    signers?: Array<Keypair>;
  }[];
  wallet: WalletAdapter;
  connection: Connection;
}) {
  const blockhash = (await connection.getRecentBlockhash('max')).blockhash;
  transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
    transaction.recentBlockhash = blockhash;
    transaction.setSigners(
      wallet.publicKey,
      ...signers.map((s) => s.publicKey),
    );
    if (signers?.length > 0) {
      transaction.partialSign(...signers);
    }
  });
  return await wallet.signAllTransactions(
    transactionsAndSigners.map(({ transaction }) => transaction),
  );
}

export async function sendSignedTransaction({
  signedTransaction,
  connection,
  sendingMessage = 'Sending transaction...',
  sentMessage = 'Transaction sent',
  successMessage = 'Transaction confirmed',
  timeout = DEFAULT_TIMEOUT,
  sendNotification = true,
}: {
  signedTransaction: Transaction;
  connection: Connection;
  sendingMessage?: string;
  sentMessage?: string;
  successMessage?: string;
  timeout?: number;
  sendNotification?: boolean;
}): Promise<string> {
  const rawTransaction = signedTransaction.serialize();
  const startTime = getUnixTs();
  if (sendNotification) {
    console.log({ message: sendingMessage });
  }
  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
    },
  );
  if (sendNotification) {
    console.log({ message: sentMessage, type: 'success', txid });
  }

  console.log('Started awaiting confirmation for', txid);

  let done = false;
  (async () => {
    while (!done && getUnixTs() - startTime < timeout) {
      connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      await delay(3000);
    }
  })();
  try {
    await awaitTransactionSignatureConfirmation(txid, timeout, connection);
  } catch (err) {
    if ((err as any).timeout) {
      throw new Error('Timed out awaiting confirmation on transaction');
    }
    let simulateResult: SimulatedTransactionResponse | null = null;
    try {
      simulateResult = (
        await simulateTransaction(connection, signedTransaction, 'single')
      ).value;
    } catch (e) { }
    if (simulateResult && simulateResult.err) {
      if (simulateResult.logs) {
        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
          const line = simulateResult.logs[i];
          if (line.startsWith('Program log: ')) {
            throw new Error(
              'Transaction failed: ' + line.slice('Program log: '.length),
            );
          }
        }
      }
      let parsedError;
      if (
        typeof simulateResult.err == 'object' &&
        'InstructionError' in simulateResult.err
      ) {
        const parsedErrorInfo = parseInstructionErrorResponse(
          signedTransaction,
          simulateResult.err['InstructionError'],
        );
        parsedError = parsedErrorInfo.error;
      } else {
        parsedError = JSON.stringify(simulateResult.err);
      }
      throw new Error(parsedError);
    }
    throw new Error('Transaction failed');
  } finally {
    done = true;
  }
  if (sendNotification) {
    console.log({ message: successMessage, type: 'success', txid });
  }

  console.log('Latency', txid, getUnixTs() - startTime);
  return txid;
}

async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature,
  timeout: number,
  connection: Connection,
) {
  let done = false;
  const result = await new Promise((resolve, reject) => {
    (async () => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        console.log('Timed out for txid', txid);
        reject({ timeout: true });
      }, timeout);
      try {
        connection.onSignature(
          txid,
          (result) => {
            console.log('WS confirmed', txid, result);
            done = true;
            if (result.err) {
              reject(result.err);
            } else {
              resolve(result);
            }
          },
          'recent',
        );
        console.log('Set up WS connection', txid);
      } catch (e) {
        done = true;
        console.log('WS error in setup', txid, e);
      }
      while (!done) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            const result = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!result) {
                console.log('REST null result for', txid, result);
              } else if (result.err) {
                console.log('REST error for', txid, result);
                done = true;
                reject(result.err);
              } else if (!result.confirmations) {
                console.log('REST no confirmations for', txid, result);
              } else {
                console.log('REST confirmation for', txid, result);
                done = true;
                resolve(result);
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e);
            }
          }
        })();
        await delay(300);
      }
    })();
  });
  done = true;
  return result;
}

function mergeTransactions(transactions: (Transaction | undefined)[]) {
  const transaction = new Transaction();
  transactions
    .filter((t): t is Transaction => t !== undefined)
    .forEach((t) => {
      transaction.add(t);
    });
  return transaction;
}

function jsonRpcResult(resultDescription: any) {
  const jsonRpcVersion = struct.literal('2.0');
  return struct.union([
    struct({
      jsonrpc: jsonRpcVersion,
      id: 'string',
      error: 'any',
    }),
    struct({
      jsonrpc: jsonRpcVersion,
      id: 'string',
      error: 'null?',
      result: resultDescription,
    }),
  ]);
}

function jsonRpcResultAndContext(resultDescription: any) {
  return jsonRpcResult({
    context: struct({
      slot: 'number',
    }),
    value: resultDescription,
  });
}

const AccountInfoResult = struct({
  executable: 'boolean',
  owner: 'string',
  lamports: 'number',
  data: 'any',
  rentEpoch: 'number?',
});

export const GetMultipleAccountsAndContextRpcResult = jsonRpcResultAndContext(
  struct.array([struct.union(['null', AccountInfoResult])]),
);

export async function getMultipleSolanaAccounts(
  connection: Connection,
  publicKeys: PublicKey[],
): Promise<
  RpcResponseAndContext<{ [key: string]: AccountInfo<Buffer> | null }>
> {
  const args = [publicKeys.map((k) => k.toBase58()), { commitment: 'recent' }];
  // @ts-ignore
  const unsafeRes = await connection._rpcRequest('getMultipleAccounts', args);
  const res = GetMultipleAccountsAndContextRpcResult(unsafeRes);
  if (res.error) {
    throw new Error(
      'failed to get info about accounts ' +
      publicKeys.map((k) => k.toBase58()).join(', ') +
      ': ' +
      res.error.message,
    );
  }
  assert(typeof res.result !== 'undefined');
  const accounts: Array<{
    executable: any;
    owner: PublicKey;
    lamports: any;
    data: Buffer;
  } | null> = [];
  for (const account of res.result.value) {
    let value: {
      executable: any;
      owner: PublicKey;
      lamports: any;
      data: Buffer;
    } | null = null;
    if (res.result.value) {
      const { executable, owner, lamports, data } = account;
      assert(data[1] === 'base64');
      value = {
        executable,
        owner: new PublicKey(owner),
        lamports,
        data: Buffer.from(data[0], 'base64'),
      };
    }
    accounts.push(value);
  }
  return {
    context: {
      slot: res.result.context.slot,
    },
    value: Object.fromEntries(
      accounts.map((account, i) => [publicKeys[i].toBase58(), account]),
    ),
  };
}

/** Copy of Connection.simulateTransaction that takes a commitment parameter. */
async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment,
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  // @ts-ignore
  transaction.recentBlockhash = await connection._recentBlockhash(
    // @ts-ignore
    connection._disableBlockhashCaching,
  );

  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString('base64');
  const config: any = { encoding: 'base64', commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args);
  if (res.error) {
    throw new Error('failed to simulate transaction: ' + res.error.message);
  }
  return res.result;
}

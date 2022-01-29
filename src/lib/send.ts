import {
  Keypair,
  AccountInfo,
  Commitment,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
  Signer,
  RpcResponseAndContext,
  SimulatedTransactionResponse
} from '@safecoin/web3.js';
import {  Wallet } from "@project-serum/anchor";

import { Buffer } from 'buffer';
import { sleep,getUnixTs,assert } from './util';

  const DEFAULT_TIMEOUT = 15000;

  import { struct } from 'superstruct';

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
    wallet: Wallet;
    signers?: Array<Signer>;
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
    console.log("payer ",transaction?.feePayer?.toBase58());
    console.log("me ",wallet.publicKey.toBase58());
    transaction.instructions.map((i)=>{
    console.log(i.data)
    i.keys.map(
    (k)=>{console.log({ signer: k.isSigner, key: k.pubkey.toBase58()});})
      console.log(i.programId.toBase58());
    });
    console.log("transaction signed");
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
    wallet: Wallet;
    signers?: Array<Signer>;
    connection: Connection;
  }) {
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash('max')
    ).blockhash;
    transaction.feePayer = wallet.publicKey;
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
    wallet: Wallet;
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
    console.log(signedTransaction);
    const rawTransaction = signedTransaction.serialize();
    const startTime = getUnixTs();
    if (sendNotification) {
      console.log({ message: sendingMessage });
    }
    // let simulateResult: SimulatedTransactionResponse | null = null;
    // try {
    //   simulateResult = (
    //     await simulateTransaction(connection, signedTransaction, 'single')
    //   ).value;
    //   console.log("simulate got: ",simulateResult);
    //   if (simulateResult.err) {
    //     throw new Error(simulateResult.err as string);
  
    //   }
    // } catch (e) {
    //   console.log(`Error`, e);
    //   //@ts-ignore
    //   throw new Error(e.message);
    // }
  
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
    // (async () => {
    //   while (!done && getUnixTs() - startTime < timeout) {
    //     connection.sendRawTransaction(rawTransaction, {
    //       skipPreflight: true,
    //     });
    //     await sleep(300);
    //   }
    // })();
    try {
      await awaitTransactionSignatureConfirmation(txid, timeout, connection);
    } catch (err) {
      // @ts-ignore
      if (err.timeout) {
        throw new Error('Timed out awaiting confirmation on transaction');
      }
      let simulateResult: SimulatedTransactionResponse | null = null;
      try {
        simulateResult = (
          await simulateTransaction(connection, signedTransaction, 'single')
        ).value;
      } catch (e) {
        console.log(`Error`, e);
        //@ts-ignore
        throw new Error(e.message);
      }
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
    console.log("awaitTransactionSignatureConfirmation");
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
            'processed',
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
          await sleep(300);
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
    assert(typeof res.result !== 'undefined',"oops");
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
        assert(data[1] === 'base64',"should be base64");
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
  
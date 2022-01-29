import {
    Connection,
    PublicKey,

    AccountInfo
  } from '@safecoin/web3.js';

 import { accountFlagsLayout, publicKeyLayout, u128, u64 } from './layout';

  import {   seq, blob, Structure } from 'buffer-layout';
  
  import {  Wallet } from "@project-serum/anchor";

const me_money = Wallet.fromPath(process.env.HOME+"/xxx/SAFE/CONFIG/mykey");

(async() => {
    const connection = new Connection("https://api.testnet.safecoin.org");
    const program_id = new PublicKey("5eRmSCBGTR5tLgZVZkfab55NHWYDRvzMQM9ktoFZE9uJ");
    const market = new PublicKey("8PhZtpPKQ4SErDdMhndsskNrS7u7ofXb17RTrVcESC36");
    let accounts = await findForOwnerMarket(connection,me_money.publicKey,market,program_id);

    console.log(accounts.map((a) => ({"key": a.publicKey.toBase58() })));
})()


function getLayout() : Structure {
  return new Structure([
    blob(5),
  
    accountFlagsLayout('accountFlags'),
  
    publicKeyLayout('market'),
    publicKeyLayout('owner'),
  
    // These are in safe-token (i.e. not lot) units
    u64('baseTokenFree'),
    u64('baseTokenTotal'),
    u64('quoteTokenFree'),
    u64('quoteTokenTotal'),
  
    u128('freeSlotBits'),
    u128('isBidBits'),
  
    seq(u128(), 128, 'orders'),
    seq(u64(), 128, 'clientIds'),
  
    u64('referrerRebatesAccrued'),
  
    blob(7),
  ]);;
}

async function findForOwner(
  connection: Connection,
  ownerAddress: PublicKey,
  programId: PublicKey,
) {
  const acct_layout = getLayout();
  const filters = [
    {
      memcmp: {
        offset: acct_layout.offsetOf('owner'),
        bytes: ownerAddress.toBase58(),
      },
    },
    {
      dataSize: acct_layout.span,
    },
  ];
  const accounts = await getFilteredProgramAccounts(
    connection,
    programId,
    filters,
  );
  return accounts;
}
async function findForOwnerMarket(
  connection: Connection,
  ownerAddress: PublicKey,
  marketAddress: PublicKey,
  programId: PublicKey,
) {
  const acct_layout = getLayout();
  const filters = [
    {
      memcmp: {
        offset: acct_layout.offsetOf('owner'),
        bytes: ownerAddress.toBase58(),
      },
    },
    {
      memcmp: {
        offset: acct_layout.offsetOf('market'),
        bytes: marketAddress.toBase58(),
      },
    },
    {
      dataSize: acct_layout.span,
    },
  ];
  const accounts = await getFilteredProgramAccounts(
    connection,
    programId,
    filters,
  );
  return accounts;
}
async function findForMarket(
  connection: Connection,
  marketAddress: PublicKey,
  programId: PublicKey,
) {
  const acct_layout = getLayout();
  const filters = [
    {
      memcmp: {
        offset: acct_layout.offsetOf('market'),
        bytes: marketAddress.toBase58(),
      },
    },
    {
      dataSize: acct_layout.span,
    },
  ];
  const accounts = await getFilteredProgramAccounts(
    connection,
    programId,
    filters,
  );
  return accounts;
}


async function getFilteredProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  filters,
): Promise<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }[]> {
  // @ts-ignore
  const resp = await connection._rpcRequest('getProgramAccounts', [
    programId.toBase58(),
    {
      commitment: connection.commitment,
      filters,
      encoding: 'base64',
    },
  ]);
  if (resp.error) {
    throw new Error(resp.error.message);
  }
  return resp.result.map(
    ({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data: Buffer.from(data[0], 'base64'),
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }),
  );
}
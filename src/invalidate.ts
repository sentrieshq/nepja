import { tokenManager } from "@cardinal/token-manager/dist/cjs/programs"
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js"
import dotenv from "dotenv"
import {
  CRANK_KEY,
  getRemainingAccountsForKind,
  TokenManagerState,
  TOKEN_MANAGER_ADDRESS,
  TOKEN_MANAGER_IDL,
  TOKEN_MANAGER_PROGRAM,
  withRemainingAccountsForReturn,
} from "@cardinal/token-manager/dist/cjs/programs/tokenManager"
import { Program, Provider, Wallet } from "@project-serum/anchor"
import { withFindOrInitAssociatedTokenAccount } from "@cardinal/token-manager"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import {
  SignerWallet,
  SolanaProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import fs from 'fs'
import { Client, Query } from 'ts-postgres'
import { Pool } from 'generic-pool'

import { truthy } from "@strata-foundation/spl-utils"
const asyncq = require("async-q")

dotenv.config()

const connection = new Connection(process.env.RPC_URL as string, {commitment: 'confirmed' as Commitment});

const updateNftThawed = async(pool: Pool<Client>, mintAddress: string) => {
  const client = await pool.acquire()
  try {
    const query = new Query(
      `UPDATE
        sentries_vest
      SET
        sentry_vest_thawed = TRUE::BOOLEAN,
        sentry_vest_thawed_time = NOW()
      WHERE sentry_address = ${mintAddress}`
    )
    await client.execute(query);
  } catch(e) {
    console.error(`Failed to update ${mintAddress} in database!`, e)
  } finally {
    pool.release(client)
  }
}

const invalidateByMintId = async (mintId: PublicKey) => {
  const transaction = new Transaction();
  const tokenManagerId = await tokenManager.pda.tokenManagerAddressFromMint(
    connection,
    mintId
  );

  const authorityKp = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(process.env.SENTRIES_AUTH_KEY as string)
    )
  );
  const wallet = new Wallet(authorityKp);

  const provider = new Provider(connection, wallet, {});

  const tokenManagerProgram = new Program<TOKEN_MANAGER_PROGRAM>(
    TOKEN_MANAGER_IDL,
    TOKEN_MANAGER_ADDRESS,
    provider
  );

  let parsed;
  try {
    parsed = await tokenManagerProgram.account.tokenManager.fetch(
      tokenManagerId
    );
  } catch (error) {
    return console.log("Couldnt fetch for mint", mintId.toBase58());
  }

  const tokenManagerData = {
    pubkey: tokenManagerId,
    parsed,
  };

  const tokenManagerTokenAccountId = await withFindOrInitAssociatedTokenAccount(
    transaction,
    connection,
    parsed.mint,
    tokenManagerId,
    wallet.publicKey,
    true
  );

  const remainingAccountsForReturn = await withRemainingAccountsForReturn(
    transaction,
    connection,
    wallet,
    // @ts-ignore
    tokenManagerData
  );

  const transferAccounts = await getRemainingAccountsForKind(
    mintId,
    parsed.kind
  );

  transaction.add(
    tokenManagerProgram.instruction.invalidate({
      accounts: {
        tokenManager: tokenManagerId,
        tokenManagerTokenAccount: tokenManagerTokenAccountId,
        mint: mintId,
        recipientTokenAccount: parsed.recipientTokenAccount,
        invalidator: wallet.publicKey,
        collector: CRANK_KEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      },
      remainingAccounts: [
        ...(parsed.state === TokenManagerState.Claimed ? transferAccounts : []),
        ...remainingAccountsForReturn,
      ],
    })
  );

  const txEnvelope = new TransactionEnvelope(
    SolanaProvider.init({
      connection: provider.connection,
      wallet: new SignerWallet(authorityKp),
      opts: provider.opts,
    }),
    [...transaction.instructions]
  );

  const sentTx = await txEnvelope.send();
  console.log("Sent transaction", sentTx.signature);
  await sentTx.confirm({ commitment: "confirmed" });
  console.log("Confirmed transaction for mint", mintId.toBase58());
  return true;
};


const main = async () => {
  const mintAddresses = [
    ""
  ];

  const tasks = mintAddresses.map(function (address) {
    return async function () {
      return invalidateByMintId(new PublicKey(address));
    };
  });
  let result = await asyncq.parallelLimit(tasks, 10);

  const invalidatedCount = result.filter(truthy).length;
  console.log("Total invalidated", invalidatedCount);
};

(async () => {
  try {
    await main();
  } catch (e) {
    console.log(e);
  }
})();
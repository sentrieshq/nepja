import { Keypair, PublicKey } from '@solana/web3.js'
import 'dotenv/config'
import type { 
  DialectSdk
} from '@dialectlabs/sdk'

import {
  Backend,
  ConfigProps,
  Dialect,
  DialectWalletAdapterWrapper,
  EncryptionKeysStore,
  NodeDialectWalletAdapter,
  TokenStore,
  IllegalStateError
} from '@dialectlabs/sdk'
import { Query } from 'ts-postgres'
import { setTimeout } from 'timers/promises'
import { createDbPool } from './utils'

const pool = createDbPool()
const TIMEOUT = 2000

type NftData = {
  mintAddress: string,
  ownerAddress: string,
  nftName: string
}

export function createSdk(): DialectSdk {
  const PRIVATE_KEY = JSON.parse(process.env.DAPP_PRIVATE_KEY as string);

  const keypair = Keypair.fromSecretKey(Uint8Array.from(PRIVATE_KEY))

  const backends = [Backend.DialectCloud, Backend.Solana]
  const dialectCloud = {
    url: process.env.DIALECT_URL,
    tokenStore: TokenStore.createInMemory(),
  }
  const environment = 'production';
  const encryptionKeysStore = EncryptionKeysStore.createInMemory();
  const solana = {
    rpcUrl: process.env.RPC_URL as string,
  };

  const wallet = DialectWalletAdapterWrapper.create(
    NodeDialectWalletAdapter.create(keypair),
  );

  const sdk: DialectSdk = Dialect.sdk({
    backends,
    dialectCloud,
    environment,
    encryptionKeysStore,
    solana,
    wallet,
  } as ConfigProps);

  return sdk
}

const getUnsentThawedNfts = async() => {
  const hashlist: NftData[] = []
  const client = await pool.acquire()
  try {
    const response = client.query(
      `SELECT
        sentries_vest.sentry_address,
        sentries_vest.sentry_owner_address,
        sentries.sentry_name
      FROM sentries_vest
      LEFT JOIN sentries ON sentries.sentry_address = sentries_vest.sentry_address
      WHERE sentry_vest_message_sent IS FALSE
      AND sentry_vest_thawed_time IS NOT NULL
      AND sentry_vest_thawed IS TRUE
      `
    )
    for await (const row of response) {
      hashlist.push({ 
        mintAddress: row.get('sentry_address') as string,
        ownerAddress: row.get('sentry_owner_address') as string,
        nftName: row.get('sentry_name') as string
      })
    }
    return hashlist
  } catch(e){
    console.error(e)
  } finally {
    pool.release(client)
  }
}

const updateMessageSent = async(mintAddress: string) => {
  const client = await pool.acquire()
  try {
    const query = new Query(
      `UPDATE
        sentries_vest
      SET
        sentry_vest_message_sent = TRUE::BOOLEAN
      WHERE sentry_address = '${mintAddress}';`
    )
    await client.execute(query);
    return true
  } catch(e) {
    console.error(`Failed to update ${mintAddress} in database!`, e)
    return false
  } finally {
    pool.release(client)
  }
}

const sendNotification = async(mintAddress: string, ownerAddress: string, nftName: string) => {
  const sdk = createSdk();
  const dapp = await sdk.dapps.find();
  if(!dapp) {
    throw new IllegalStateError(
      "Dapp doesn't exist, please create dapp before using it."
    )
  }
  const recipient = new PublicKey(
    ownerAddress // ownerAddress
  )

  const title = `${nftName} Thawed`
  const message = `${nftName} NFT has been thawed. Token address ${mintAddress}.`
  try {
    const notification = await dapp.messages.send({
      title,
      message,
      recipient
    })
    console.log(notification)
    console.log({
      title,
      message,
      recipient
    })
    return true
  } catch (err) {
    console.error(err)
    return false
  }
}

const main = async () =>{
  const hashlist = await getUnsentThawedNfts()
  if(!hashlist){
    return
  }
  for await(const mint of hashlist){
    const messageSent = await sendNotification(mint.mintAddress, mint.ownerAddress, mint.nftName)
    if (messageSent) {
      const updateWorked = await updateMessageSent(mint.mintAddress)
      if(updateWorked){
        console.log(`Updated db for ${mint.nftName}`)
      }
      console.log(`Sent message for ${mint.nftName}`)
    }
    await setTimeout(TIMEOUT)
  }
}

main()
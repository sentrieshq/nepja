import { Client } from 'ts-postgres'
import { Pool } from 'generic-pool'
import { differenceInCalendarDays } from 'date-fns'
import { createDbPool, changeTimezone } from './utils'

import 'dotenv/config'

const pool = createDbPool()

type HolderAllocation = {
  address: string,
  totalAllocation: number
}

type ThawedAllocation = {
  address: string,
  thawedAllocation: number
}

// TODO: Flag for cleanup
const START_DATE = new Date(2022, 7, 22, 8, 0)
const VEST_PERIOD = 30

const getPreMintTotal = async(pool: Pool<Client>) => {
  const result: HolderAllocation[] = []
  const client = await pool.acquire()
  try {
        const res =
      await client.query(`SELECT
            COUNT(*)::INTEGER AS total_nfts,
            nft_owner_address
          FROM nfts_vest
          GROUP BY nft_owner_address`)
    for await(const row of res) {
      result.push({
        address: row.get('nft_owner_address') as string,
        totalAllocation: row.get('total_nfts') as number
      })
    }
    return result
  } catch (e) {
    console.error(e)
    throw e
  } finally {
    pool.release(client)
  }
}

const getThawedTotals = async(pool: Pool<Client>) => {
  const result: ThawedAllocation[] = []
  const client = await pool.acquire()
  try {
        const res =
      await client.query(`SELECT
            COUNT(*)::INTEGER AS thawed_allocation,
            nft_owner_address
          FROM nfts_vest
          WHERE nft_vest_thawed = TRUE 
          AND nft_vest_thawed_time IS NOT NULL
          GROUP BY nft_owner_address;`)
      for await(const row of res) {
        result.push({
          address: row.get('nft_owner_address') as string,
          thawedAllocation: row.get('thawed_allocation') as number
        })
      }
      return result
  } catch (e) {
    console.error(e)
    throw e
  } finally {
    pool.release(client)
  } 
}

const getRandomNfts = async(pool: Pool<Client>, address: string, limit: number) => {
  const result: string[] = []
  const client = await pool.acquire()
  try {
    const res = await client.query(`
      SELECT
        nft_owner_address,
        nft_address
      FROM nfts_vest
      WHERE nft_owner_address = '${address}'
        AND nft_vest_thawed = FALSE 
        AND nft_vest_thawed_time IS NULL
      ORDER BY RANDOM () LIMIT ${limit};
    `)
    for await(const row of res) {
      result.push(
        row.get('nft_address') as string
      )
    }
    return result
  } catch (e) {
    console.error(e)
    throw e
  } finally {
    pool.release(client)
  }
}

const main = async(pool: Pool<Client>) => {
  const startDateMod = changeTimezone(START_DATE)
  console.log(`Our vesting start time ${startDateMod}`)
  console.log(`Our vesting period ${VEST_PERIOD}`)
  const currentDate = new Date()
  const currentDateMod = changeTimezone(currentDate)
  console.log(`Current date operating ${currentDateMod}`)

  // Date calcs
  let daysBetween = differenceInCalendarDays(currentDateMod, startDateMod) + 1

  if(daysBetween >= 30) {
    throw `Dump the remainder, we're on the last day or past!`
  } else {
    if(currentDateMod < startDateMod) {
      console.error(`Not time to start thawing!`)
      throw `Unable to start`
    }
    console.log(`Number of days vesting ${daysBetween}`)
  }

  // Fetch our data
  // Premint base
  const preMintSet: HolderAllocation[] = await getPreMintTotal(pool)
  if(!preMintSet){
    throw `Nothing located`
  }

  // Thawed current
  const thawedSet: ThawedAllocation[] = await getThawedTotals(pool)
  if(!thawedSet){
    throw `Nothing located`
  }

  const aggMints: string[] = []
  for await(let holder of preMintSet) {
    const address = holder.address
    const totalNftCount = holder.totalAllocation
    const setThaw = thawedSet.filter(a => a.address === holder.address)[0]
    let thawedNftCount = 0
    if(setThaw){
      thawedNftCount = setThaw.thawedAllocation
    }
    const dailyAllocation = totalNftCount / VEST_PERIOD
    const runningTotal = dailyAllocation * daysBetween // Should have assuming fractions
    // What the difference is between what has been awarded and what should be including today's
    const deltaAllocation = runningTotal - (thawedNftCount + Math.floor(dailyAllocation))
    let todayAward = dailyAllocation
    console.log(`-----------------------------`)
    // TODO: Review
    if (deltaAllocation >= 1){
      // Add only one more whole number to the allocation
      todayAward = Math.ceil(dailyAllocation)
      console.log(`Adjusting allocation from ${dailyAllocation} to ${todayAward}`)
    }
    if(todayAward < 1){
      todayAward = 0
      console.log(`Setting allocation from ${dailyAllocation} to ${todayAward}`)
    }
    if(todayAward > 1){
      todayAward = Math.floor(todayAward)
      console.log(`Flooring allocation from ${dailyAllocation} to ${todayAward}`)
    }
    console.log(`${address} has ${totalNftCount}`)
    console.log(`dailyAllocation: ${dailyAllocation}\nthawedNftCount: ${thawedNftCount}\nshouldHaveAllocation: ${runningTotal}`)
    console.log(`deltaAllocation: ${deltaAllocation}\ntodayAward: ${todayAward}`)

    const mintsToThaw = await getRandomNfts(pool, address, todayAward)
    if(mintsToThaw.length > 0) {
      for await(const mint of mintsToThaw) {
        aggMints.push(mint)
      }
    }
  }
  console.log(aggMints)
  console.log(aggMints.length)
  return true
}

(async () => {
    try {
      await main(pool)
    } catch (e) {
      console.log(e)
    }
})()
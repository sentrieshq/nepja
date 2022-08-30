import { Client } from 'ts-postgres'
import { createPool } from 'generic-pool'
import 'dotenv/config'

const poolMin = parseInt(process.env.DB_POOL_MIN ? process.env.DB_POOL_MIN : '15')
const poolMax = parseInt(process.env.DB_POOL_MAX ? process.env.DB_POOL_MAX : '50')

export const changeTimezone  = (date: Date) => {
  const localized = new Date(date.toLocaleString('en-US', { timeZone: 'Etc/GMT' }))
  const diff = date.getTime() - localized.getTime()
  return new Date(date.getTime() - diff)
}

export const createDbPool = () => {
  const pool = createPool(
    {
      create: async () => {
        const client = new Client({
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_DATABASE,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        });
        return client.connect().then(() => {
          client.on('error', console.log)
          return client
        })
      },
      destroy: async (client: Client) => {
        return client.end().then(() => {})
      },
      validate: (client: Client) => {
        return Promise.resolve(!client.closed)
      },
    },
    { testOnBorrow: true,
      min: poolMin,
      max: poolMax
    },
  )
  return pool
}

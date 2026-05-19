import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()
const PORT = 3068

app.get('/ping', (c) => c.json({ status: 'ok' }))

serve(
  {
    fetch: app.fetch,
    port: PORT
  },
  () => {
    const host = process.env.HOST ?? 'localhost'
    const protocol = process.env.PROTOCOL ?? 'http'

    console.log(`Server running at ${protocol}://${host}:${PORT}`)
  }
)

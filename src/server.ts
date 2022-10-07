import express, { Express } from 'express'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { payloadHandler } from './actions'

dotenv.config()

export interface IResponse {
  action: 'update-votes' | 'update-teams'
  data: object
}
export interface IPayload {
  action: 'vote-captain' | 'remove-team' | 'add-team' | 'fetch-teams'
  deviceId: string
  teamName: string
  votedDeviceId: string
}

const app: Express = express()
const httpServer = createServer(app)
const port = process.env.PORT
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

const fields = ['fieldA', 'fieldB', 'fieldC', 'fieldD', 'fieldE'] as const
io.on('connection', socket => {
  fields.forEach(field => {
    socket.on(field, async (payload: IPayload, callBack) => {
      await payloadHandler(field, payload)
      callBack && callBack('finished')
    })
  })
})

app.get('/', (req, res) => {
  res.send('Express + TypeScript Server is running now')
})
httpServer.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
})
export { app, io }

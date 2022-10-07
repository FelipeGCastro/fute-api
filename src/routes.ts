import { Request, Response, Router } from 'express'

const routes = Router()

// QUEUE
routes.get('/api/queue', (request: Request, response: Response) => {
  response.status(200).send('Something')
})

export default routes

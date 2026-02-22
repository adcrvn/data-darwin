import 'dotenv/config'
import express from 'express'
import routes from '@/routes'
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use('/api', routes)

// 404 handler
app.use(notFoundHandler)
// Centralized error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Express API server running on port ${PORT}`)
})

export default app


const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const app = express()
const prisma = new PrismaClient()

const allowedOrigins = [
  'http://localhost:5173',
  'https://clinica-frontend-sigma.vercel.app'
]

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}
app.use(cors(corsOptions))

app.use(express.json())

app.post('/api/citas', async (req, res) => {
  const { nombre, email, telefono, fecha, motivo } = req.body
  const cita = await prisma.cita.create({
    data: { nombre, email, telefono, fecha: new Date(fecha), motivo }
  })
  res.json(cita)
})

app.get('/api/citas', async (req, res) => {
  const citas = await prisma.cita.findMany()
  res.json(citas)
})

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})

const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const app = express()
const prisma = new PrismaClient()

app.use(cors())
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

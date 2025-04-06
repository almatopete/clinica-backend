const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { enviarConfirmacionCita } = require('./utils/mailer')

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
  const { nombre, email, telefono, motivo, horarioId } = req.body

  const horario = await prisma.horario.findUnique({
    where: { id: horarioId },
    include: { cita: true }
  })

  if (!horario || horario.cita) {
    return res.status(400).json({ error: 'Horario no disponible' })
  }

  const cita = await prisma.cita.create({
    data: {
      nombre,
      email,
      telefono,
      motivo,
      fecha: horario.fechaHora,
      horario: { connect: { id: horarioId } }
    }
  })

  // Enviar email
  try {
    await enviarConfirmacionCita(cita)
  } catch (e) {
    console.error('Error enviando correo:', e)
  }

  res.json(cita)
})


app.get('/api/citas', async (req, res) => {
  const citas = await prisma.cita.findMany()
  res.json(citas)
})

app.get('/api/doctores', async (req, res) => {
  const doctores = await prisma.doctor.findMany()
  res.json(doctores)
})

const { format } = require('date-fns') // Asegúrate de tener date-fns instalado

app.get('/api/horarios/:doctorId', async (req, res) => {
  const doctorId = parseInt(req.params.doctorId)

  const horarios = await prisma.horario.findMany({
    where: { doctorId },
    include: { cita: true },
    orderBy: { fechaHora: 'asc' }
  })

  const result = horarios.map(h => {
    const start = format(h.fechaHora, 'yyyy-MM-dd HH:mm')
    const end = format(new Date(h.fechaHora.getTime() + 59 * 60 * 1000), 'yyyy-MM-dd HH:mm')

    return {
      id: h.id,
      start,
      end,
      disponible: !h.cita,
      title: h.cita ? 'Reservado' : 'Disponible',
      class: h.cita ? 'bg-red-500 text-white' : 'bg-green-100 text-black border border-green-300'
    }
  })

  res.json(result)
})




app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})

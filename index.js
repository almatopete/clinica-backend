const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { enviarConfirmacionCita } = require('./utils/mailer')

const app = express()
const prisma = new PrismaClient()

const bcrypt = require('bcrypt')
const { generarToken, verificarToken } = require('./utils/auth')


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

app.post('/api/citas', verificarToken, async (req, res) => {
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
      horario: { connect: { id: horarioId } },
      user: { connect: { id: req.user.id } }
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

app.get('/api/doctores/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const doctor = await prisma.doctor.findUnique({
    where: { id }
  })

  if (!doctor) return res.status(404).json({ error: 'No encontrado' })
  res.json(doctor)
})

app.post('/api/register', async (req, res) => {
  const { nombre, email, password } = req.body

  const existe = await prisma.user.findUnique({ where: { email } })
  if (existe) return res.status(400).json({ error: 'El correo ya está registrado' })

  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      nombre
    }
  })

  const token = generarToken(user)
  res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre } })
})

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })

  const valido = await bcrypt.compare(password, user.password)
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' })

  const token = generarToken(user)
  res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre } })
})




app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})

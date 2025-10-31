require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { enviarConfirmacionCita } = require('./utils/mailer')
const { generarToken, verificarToken, requireRole } = require('./utils/auth')

// OJO con la ruta: si tu validators está en utils/, déjalo así; si está en raíz, cámbialo a './validators'
const { validarRegistro, validarLogin, validarCrearCita, validarIdParam, validarReprogramar, validarFiltroDoctores } = require('./utils/validators')
const handleValidation = require('./middleware/handleValidation')

const { PrismaClient, Prisma } = require('@prisma/client')
const { format } = require('date-fns')
const bcrypt = require('bcrypt')

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
  methods: ['GET', 'POST', 'DELETE', 'PATCH'],
  credentials: true
}
app.use(cors(corsOptions))

app.use(express.json())

app.post('/api/citas', verificarToken, validarCrearCita, handleValidation, async (req, res) => {
  const { nombre, email, telefono, motivo, horarioId } = req.body

  try {
    // estrategia: confiar en UNIQUE(horarioId) y capturar conflicto (mejor para carreras)
    const cita = await prisma.cita.create({
      data: {
        nombre, email, telefono, motivo,
        fecha: (await prisma.horario.findUniqueOrThrow({ where: { id: Number(horarioId) } })).fechaHora,
        estado: 'PROGRAMADA',
        horario: { connect: { id: Number(horarioId) } },
        user: { connect: { id: req.user.id } }
      },
      include: { horario: { include: { doctor: true } } }
    })

    try { await enviarConfirmacionCita(cita) } catch (e) { console.error('Error enviando correo:', e) }
    return res.status(201).json(cita)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Horario no disponible' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(400).json({ error: 'Horario no encontrado' })
    }
    console.error(err)
    return res.status(500).json({ error: 'No se pudo crear la cita' })
  }
})



// ADMIN ve todas; DOCTOR podría ver las de sus horarios; PATIENT solo las propias
app.get('/api/citas', verificarToken, async (req, res) => {
  let where = {}

  if (req.user.role === 'ADMIN') {
    where = {}
  } else if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    })
    if (!doctor) return res.json([])
    where = { horario: { doctorId: doctor.id } }
  } else {
    where = { userId: req.user.id }
  }

  const citas = await prisma.cita.findMany({
    where,
    include: { horario: { include: { doctor: true } }, user: true },
    orderBy: { fecha: 'asc' }
  })
  res.json(citas)
})



app.get('/api/doctores', validarFiltroDoctores, handleValidation, async (req, res) => {
  const { especialidad } = req.query
  const doctores = await prisma.doctor.findMany({
    where: especialidad ? { especialidad: { contains: especialidad, mode: 'insensitive' } } : undefined
  })
  res.json(doctores)
})


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
    const reservado = !!h.cita && h.cita.estado !== 'CANCELADA'
    return {
      id: h.id,
      start, end,
      disponible: !reservado,
      title: reservado ? 'Reservado' : 'Disponible',
      class: reservado ? 'bg-red-500 text-white' : 'bg-green-100 text-black border border-green-300'
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

app.post('/api/register', validarRegistro, handleValidation, async (req, res) => {
  const { nombre, email, password } = req.body
  const existe = await prisma.user.findUnique({ where: { email } })
  if (existe) return res.status(400).json({ error: 'El correo ya está registrado' })

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, password: hash, nombre, role: 'PATIENT' }
  })
  const token = generarToken(user)
  res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role } })
})

app.post('/api/login', validarLogin, handleValidation, async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })
  const valido = await bcrypt.compare(password, user.password)
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' })
  const token = generarToken(user)
  res.json({ token, user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role } })
})


app.get('/api/users/me', verificarToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, nombre: true, createdAt: true }
  })
  res.json(user)
})


app.get('/api/users/my-appointments', verificarToken, async (req, res) => {
  const citas = await prisma.cita.findMany({
    where: { user: { id: req.user.id } },
    include: {
      horario: {
        include: {
          doctor: true
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })

  const result = citas.map(cita => ({
    id: cita.id,
    fecha: cita.fecha,
    motivo: cita.motivo,
    doctor: cita.horario?.doctor?.nombre || 'Desconocido'
  }))

  res.json(result)
})

app.delete('/api/citas/:id', verificarToken, requireRole('ADMIN'), validarIdParam, handleValidation, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.cita.delete({ where: { id } })
    res.json({ message: 'Cita eliminada' })
  } catch (error) {
    console.error('Error cancelando cita:', error)
    res.status(500).json({ error: 'No se pudo eliminar la cita' })
  }
})


app.patch('/api/citas/:id', verificarToken, requireRole('PATIENT','ADMIN'), validarIdParam, validarReprogramar, handleValidation, async (req, res) => {
  const id = Number(req.params.id)
  const { accion, nuevoHorarioId } = req.body

  // Asegura que el paciente solo toque sus citas (ADMIN puede tocar todas)
  const cita = await prisma.cita.findUnique({ where: { id } })
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })
  if (req.user.role !== 'ADMIN' && cita.userId !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  try {
    if (accion === 'cancelar') {
      const updated = await prisma.cita.update({
        where: { id },
        data: { estado: 'CANCELADA', horarioId: null } // liberar slot
      })
      return res.json(updated)
    }

    if (accion === 'reprogramar') {
      if (!nuevoHorarioId) return res.status(400).json({ error: 'nuevoHorarioId requerido' })
      // conectar nuevo horario, capturar conflict
      const updated = await prisma.cita.update({
        where: { id },
        data: {
          horario: { connect: { id: Number(nuevoHorarioId) } },
          fecha: (await prisma.horario.findUniqueOrThrow({ where: { id: Number(nuevoHorarioId) } })).fechaHora,
          estado: 'PROGRAMADA'
        },
        include: { horario: { include: { doctor: true } } }
      })
      return res.json(updated)
    }

    return res.status(400).json({ error: 'Acción no soportada' })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Nuevo horario no disponible' })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(400).json({ error: 'Horario no encontrado' })
    }
    console.error(err)
    return res.status(500).json({ error: 'No se pudo actualizar la cita' })
  }
})

function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
  return csv
}

// KPIs de ocupación por rango de fechas
app.get('/api/reportes/ocupacion', verificarToken, requireRole('ADMIN'), async (req, res) => {
  const { desde, hasta } = req.query
  const where = {}
  if (desde || hasta) where.fecha = {}
  if (desde) where.fecha.gte = new Date(desde)
  if (hasta) where.fecha.lte = new Date(hasta)

  const [total, programadas, canceladas, atendidas, noShow] = await Promise.all([
    prisma.cita.count({ where }),
    prisma.cita.count({ where: { ...where, estado: 'PROGRAMADA' } }),
    prisma.cita.count({ where: { ...where, estado: 'CANCELADA' } }),
    prisma.cita.count({ where: { ...where, estado: 'ATENDIDA' } }),
    prisma.cita.count({ where: { ...where, estado: 'NO_SHOW' } }),
  ])

  res.json({ total, programadas, canceladas, atendidas, noShow })
})

app.get('/api/reportes/ocupacion.csv', verificarToken, requireRole('ADMIN'), async (req, res) => {
  const { desde, hasta } = req.query
  const where = {}
  if (desde || hasta) where.fecha = {}
  if (desde) where.fecha.gte = new Date(desde)
  if (hasta) where.fecha.lte = new Date(hasta)

  const citas = await prisma.cita.findMany({
    where,
    include: { horario: { include: { doctor: true } }, user: true },
    orderBy: { fecha: 'asc' }
  })
  const rows = citas.map(c => ({
    id: c.id,
    fecha: c.fecha.toISOString(),
    estado: c.estado,
    paciente: c.nombre,
    email: c.email,
    telefono: c.telefono,
    motivo: c.motivo,
    doctor: c.horario?.doctor?.nombre ?? '',
    especialidad: c.horario?.doctor?.especialidad ?? '',
    usuarioId: c.userId ?? ''
  }))

  const csv = toCSV(rows)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="ocupacion.csv"')
  res.send(csv)
})
// Obtener detalle de una cita por ID
app.get(
  '/api/citas/:id',
  verificarToken,
  validarIdParam,
  handleValidation,
  async (req, res) => {
    const id = Number(req.params.id)

    // Traemos la cita con joins útiles
    const cita = await prisma.cita.findUnique({
      where: { id },
      include: {
        horario: { include: { doctor: true } },
        user: { select: { id: true, nombre: true, email: true } }
      }
    })

    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' })

    // Autorización por rol
    if (req.user.role === 'ADMIN') {
      return res.json(cita)
    }

    if (req.user.role === 'PATIENT') {
      if (cita.userId !== req.user.id) {
        return res.status(403).json({ error: 'No autorizado' })
      }
      return res.json(cita)
    }

    if (req.user.role === 'DOCTOR') {
      // TODO: cuando enlaces User -> Doctor, valida que el doctor dueño del horario sea el doctor logueado
      // Ejemplo futuro:
      // const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.id }, select: { id: true } })
      // if (!doctor || cita.horario?.doctorId !== doctor.id) return res.status(403).json({ error: 'No autorizado' })
      return res.status(403).json({ error: 'No autorizado (falta mapear User->Doctor)' })
    }

    // Rol desconocido
    return res.status(403).json({ error: 'No autorizado' })
  }
)
app.get('/api/doctor/agenda', verificarToken, requireRole('DOCTOR','ADMIN'), async (req, res) => {
  // Si es ADMIN puedes permitir query ?doctorId=...
  let doctorId = null

  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
      select: { id: true }
    })
    if (!doctor) return res.status(404).json({ error: 'Doctor no vinculado al usuario' })
    doctorId = doctor.id
  } else if (req.user.role === 'ADMIN' && req.query.doctorId) {
    doctorId = Number(req.query.doctorId)
  }

  const where = doctorId ? { horario: { doctorId } } : {}
  const citas = await prisma.cita.findMany({
    where,
    include: {
      horario: { include: { doctor: true } },
      user: { select: { id: true, nombre: true, email: true } }
    },
    orderBy: { fecha: 'asc' }
  })

  // Formato sencillo para tu vista
  const result = citas.map(c => ({
    id: c.id,
    fecha: c.fecha,
    motivo: c.motivo,
    estado: c.estado,
    paciente: { id: c.user?.id, nombre: c.nombre || c.user?.nombre, email: c.email || c.user?.email },
    doctor: c.horario?.doctor?.nombre
  }))

  res.json(result)
})


app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})

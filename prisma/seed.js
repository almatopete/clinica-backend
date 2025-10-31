/* eslint-disable no-console */
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcrypt = require('bcrypt')
const {
  addDays,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} = require('date-fns')

/**
 * Configuración de slots:
 * - Días: Lunes (1) y Viernes (5)
 * - Horas: 09:00 a 17:00 (cada hora)
 * - Semanas a generar: 8
 */
const DIAS_SEMANA_OBJETIVO = [1, 5] // 0=Dom,1=Lun,...,5=Vie,6=Sáb
const HORA_INICIO = 9
const HORA_FIN = 17
const SEMANAS = 8

// Catálogo de doctores (fuente única para crear User + Doctor vinculados)
const DOCTORS_CATALOG = [
  {
    slug: 'carlos.mendez',
    userName: 'Dr. Carlos Méndez',
    email: 'carlos.mendez@clinic.test',
    especialidad: 'Medicina General',
    descripcion: 'Atención integral y seguimiento a enfermedades comunes.',
    foto: '/images/doctor.png',
    cv: 'Médico general con 15+ años de experiencia en atención primaria.',
  },
  {
    slug: 'ana.perez',
    userName: 'Dra. Ana Pérez',
    email: 'ana.perez@clinic.test',
    especialidad: 'Dermatología',
    descripcion: 'Especialista en piel, cabello y uñas.',
    foto: '/images/doctor2.png',
    cv: 'Dermatóloga clínica y estética con 10+ años de experiencia.',
  },
  {
    slug: 'juan.ramirez',
    userName: 'Dr. Juan Ramírez',
    email: 'juan.ramirez@clinic.test',
    especialidad: 'Nutrición',
    descripcion: 'Enfoque clínico y personalizado en planes alimenticios.',
    foto: '/images/doctor4.png',
    cv: 'Lic. en Nutrición; planes alimenticios personalizados para todas las edades.',
  },
]

// ⛔️ Seguridad: evita correr en producción salvo bandera explícita
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
  console.error('❌ Seed bloqueado en producción. Define ALLOW_SEED=true para forzar (bajo tu propio riesgo).')
  process.exit(1)
}

// Utilidad para normalizar a HH:mm exacto
function atTime(date, hour, minute = 0) {
  return setMilliseconds(
    setSeconds(setMinutes(setHours(new Date(date), hour), minute), 0),
    0
  )
}

async function wipeData() {
  await prisma.$transaction([
    prisma.cita.deleteMany(),
    prisma.horario.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.user.deleteMany(),
  ])
  const [u, d, h, c] = await Promise.all([
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.horario.count(),
    prisma.cita.count(),
  ])
  console.log(`→ Tablas vaciadas. users=${u}, doctores=${d}, horarios=${h}, citas=${c}`)
}

async function seedUsersBase() {
  // Passwords por defecto (puedes sobreescribir vía .env)
  const ADMIN_PWD = process.env.SEED_ADMIN_PWD || 'Admin123!'
  const DOCTOR_PWD = process.env.SEED_DOCTOR_PWD || 'Doctor123!' // se usará para todos los doctores
  const MARIA_PWD = process.env.SEED_MARIA_PWD || 'Maria123!'
  const JOSE_PWD = process.env.SEED_JOSE_PWD || 'Jose123!'

  const [adminHash, mariaHash, joseHash, doctorHash] = await Promise.all([
    bcrypt.hash(ADMIN_PWD, 10),
    bcrypt.hash(MARIA_PWD, 10),
    bcrypt.hash(JOSE_PWD, 10),
    bcrypt.hash(DOCTOR_PWD, 10),
  ])

  // Admin + 2 pacientes
  const [admin, paciente1, paciente2] = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: 'admin@clinic.test' },
      update: { password: adminHash, role: 'ADMIN', nombre: 'Admin' },
      create: {
        email: 'admin@clinic.test',
        password: adminHash,
        nombre: 'Admin',
        role: 'ADMIN',
      },
    }),
    prisma.user.upsert({
      where: { email: 'maria@example.com' },
      update: { password: mariaHash, role: 'PATIENT', nombre: 'María López' },
      create: {
        email: 'maria@example.com',
        password: mariaHash,
        nombre: 'María López',
        role: 'PATIENT',
      },
    }),
    prisma.user.upsert({
      where: { email: 'jose@example.com' },
      update: { password: joseHash, role: 'PATIENT', nombre: 'José Pérez' },
      create: {
        email: 'jose@example.com',
        password: joseHash,
        nombre: 'José Pérez',
        role: 'PATIENT',
      },
    }),
  ])

  // Usuarios DOCTOR (uno por cada registro del catálogo)
  const doctorUsers = []
  for (const doc of DOCTORS_CATALOG) {
    const u = await prisma.user.upsert({
      where: { email: doc.email },
      update: { password: doctorHash, role: 'DOCTOR', nombre: doc.userName },
      create: {
        email: doc.email,
        password: doctorHash,
        nombre: doc.userName,
        role: 'DOCTOR',
      },
    })
    doctorUsers.push(u)
  }

  const usersCount = await prisma.user.count()
  console.log(`→ Usuarios creados/asegurados: ${usersCount} (incluye ${doctorUsers.length} doctores)`)

  return {
    admin,
    paciente1,
    paciente2,
    doctorUsers, // array 1–a–1 con DOCTORS_CATALOG
    plainPasswords: {
      ADMIN_PWD,
      DOCTOR_PWD,
      MARIA_PWD,
      JOSE_PWD,
    },
  }
}

async function seedDoctors(doctorUsers) {
  if (!doctorUsers?.length || doctorUsers.length !== DOCTORS_CATALOG.length) {
    console.warn('⚠️  doctorUsers no corresponde al catálogo; revisa el seed de usuarios DOCTOR.')
  }

  // Crear doctores vinculados 1–a–1 a sus usuarios por índice
  const doctores = []
  for (let i = 0; i < DOCTORS_CATALOG.length; i++) {
    const d = DOCTORS_CATALOG[i]
    const user = doctorUsers[i]
    const doctor = await prisma.doctor.upsert({
      where: { id: i + 1 }, // IDs determinísticos 1..N (opcional)
      update: {
        nombre: d.userName,
        especialidad: d.especialidad,
        descripcion: d.descripcion,
        foto: d.foto,
        cv: d.cv,
        userId: user.id, // 🔗 siempre enlazado
      },
      create: {
        id: i + 1,
        nombre: d.userName,
        especialidad: d.especialidad,
        descripcion: d.descripcion,
        foto: d.foto,
        cv: d.cv,
        userId: user.id, // 🔗 siempre enlazado
      },
    })
    doctores.push(doctor)
  }

  const count = await prisma.doctor.count()
  console.log(`→ Doctores creados/asegurados: ${count} (todos con userId)`)

  return doctores
}

function generarHorarios(doctores) {
  const hoy = new Date()
  // Arrancamos mañana para evitar slots en el pasado
  const inicio = atTime(addDays(hoy, 1), 0, 0)
  const diasAGenerar = SEMANAS * 7

  const horarios = []
  for (let i = 0; i < diasAGenerar; i++) {
    const dia = addDays(inicio, i)
    const dow = dia.getDay()
    if (!DIAS_SEMANA_OBJETIVO.includes(dow)) continue

    for (let hour = HORA_INICIO; hour <= HORA_FIN; hour++) {
      for (const d of doctores) {
        const fechaHora = atTime(dia, hour, 0)
        horarios.push({ doctorId: d.id, fechaHora })
      }
    }
  }
  return horarios
}

async function seedHorarios(doctores) {
  const horarios = generarHorarios(doctores)
  if (!horarios.length) {
    console.warn('⚠️  No se generaron horarios (arreglo vacío). Revisa DIAS_SEMANA_OBJETIVO/HORA_INICIO/FIN.')
    return []
  }

  const res = await prisma.horario.createMany({
    data: horarios,
    skipDuplicates: true, // por si ejecutas el seed más de una vez
  })
  console.log(`→ Horarios insertados (createMany): ${res.count}`)

  // Volver a leer para obtener IDs (createMany no devuelve registros)
  const minFecha = horarios[0].fechaHora
  const maxFecha = horarios[horarios.length - 1].fechaHora
  const creados = await prisma.horario.findMany({
    where: { fechaHora: { gte: minFecha, lte: maxFecha } },
    orderBy: { fechaHora: 'asc' },
  })
  console.log(`→ Horarios leídos por rango: ${creados.length}`)
  return creados
}

async function seedCitas({ paciente1, paciente2 }, horarios) {
  if (horarios.length < 21) {
    console.warn(`⚠️  Pocos horarios (${horarios.length}); no se crearán citas de demo.`)
    return
  }

  // Slots de ejemplo
  const slot1 = horarios[3]  // PROGRAMADA
  const slot2 = horarios[10] // CONFIRMADA
  const slot3 = horarios[20] // CANCELADA

  const h1 = await prisma.horario.findUnique({ where: { id: slot1.id }, include: { doctor: true } })
  const h2 = await prisma.horario.findUnique({ where: { id: slot2.id }, include: { doctor: true } })
  const h3 = await prisma.horario.findUnique({ where: { id: slot3.id }, include: { doctor: true } })

  const data = [
    {
      nombre: 'María López',
      email: 'maria@example.com',
      telefono: '5551234567',
      motivo: 'Valoración general',
      fecha: h1.fechaHora,
      estado: 'PROGRAMADA',
      userId: paciente1.id,
      horarioId: h1.id,
    },
    {
      nombre: 'José Pérez',
      email: 'jose@example.com',
      telefono: '5558889999',
      motivo: 'Revisión de piel',
      fecha: h2.fechaHora,
      estado: 'CONFIRMADA',
      userId: paciente2.id,
      horarioId: h2.id,
    },
    {
      nombre: 'María López',
      email: 'maria@example.com',
      telefono: '5551234567',
      motivo: 'Plan nutricional',
      fecha: h3.fechaHora,
      estado: 'CANCELADA',
      userId: paciente1.id,
      // si liberas el slot al cancelar, usa horarioId: null
      horarioId: h3.id,
    },
  ]

  for (const c of data) {
    await prisma.cita.create({ data: c })
  }
  const count = await prisma.cita.count()
  console.log(`→ Citas creadas: ${count}`)
}

async function main() {
  console.log('→ Entorno:')
  console.log('   NODE_ENV      =', process.env.NODE_ENV)
  console.log('   DATABASE_URL  =', process.env.DATABASE_URL)

  console.log('→ Limpiando datos...')
  await wipeData()

  console.log('→ Creando usuarios (admin, pacientes y doctores)…')
  const users = await seedUsersBase()
  const { doctorUsers } = users

  console.log('→ Creando doctores (vinculados a usuarios DOCTOR)…')
  const doctores = await seedDoctors(doctorUsers)

  console.log('→ Creando horarios…')
  const horarios = await seedHorarios(doctores)

  console.log('→ Creando citas de ejemplo…')
  await seedCitas(users, horarios)

  // Conteo final
  const [u, d, h, c] = await Promise.all([
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.horario.count(),
    prisma.cita.count(),
  ])
  console.log(`\n✓ Resumen final: users=${u}, doctores=${d}, horarios=${h}, citas=${c}\n`)

  console.log('Credenciales de prueba:')
  console.log(`  ADMIN     → admin@clinic.test   / ${users.plainPasswords.ADMIN_PWD}`)
  console.log(`  DOCTORES  →`)
  for (const doc of DOCTORS_CATALOG) {
    console.log(`               ${doc.email} / ${users.plainPasswords.DOCTOR_PWD}`)
  }
  console.log(`  PACIENTE1 → maria@example.com   / ${users.plainPasswords.MARIA_PWD}`)
  console.log(`  PACIENTE2 → jose@example.com    / ${users.plainPasswords.JOSE_PWD}`)
  console.log('\n⚠️ Recuerda: este seed es solo para desarrollo.\n')
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

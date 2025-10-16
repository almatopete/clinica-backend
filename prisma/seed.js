/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { addDays, setHours, setMinutes, setSeconds, setMilliseconds, set } = require('date-fns')

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

// Utilidad para normalizar a HH:mm exacto
function atTime(date, hour, minute = 0) {
  return setMilliseconds(setSeconds(setMinutes(setHours(new Date(date), hour), minute), 0), 0)
}

async function wipeData() {
  // Borra en orden de menor a mayor dependencia
  await prisma.$transaction([
    prisma.cita.deleteMany(),
    prisma.horario.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

async function seedUsers() {
  // Admin + 2 pacientes + (opcional) usuarios doctores
  const [admin, paciente1, paciente2] = await prisma.$transaction([
    prisma.user.upsert({
      where: { email: 'admin@clinic.test' },
      update: {},
      create: { email: 'admin@clinic.test', password: 'HASH_PLACEHOLDER', nombre: 'Admin', role: 'ADMIN' }
    }),
    prisma.user.upsert({
      where: { email: 'maria@example.com' },
      update: {},
      create: { email: 'maria@example.com', password: 'HASH_PLACEHOLDER', nombre: 'María López', role: 'PATIENT' }
    }),
    prisma.user.upsert({
      where: { email: 'jose@example.com' },
      update: {},
      create: { email: 'jose@example.com', password: 'HASH_PLACEHOLDER', nombre: 'José Pérez', role: 'PATIENT' }
    }),
  ])

  // Nota: si quieres contraseñas reales, siembra hashes (bcrypt.hash) fuera y pégalos aquí.
  return { admin, paciente1, paciente2 }
}

async function seedDoctors() {
  const doctores = await Promise.all([
    prisma.doctor.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        nombre: 'Dr. Carlos Méndez',
        especialidad: 'Medicina General',
        descripcion: 'Atención integral y seguimiento a enfermedades comunes.',
        foto: '/images/doctor.png',
        cv: 'Médico general con 15+ años de experiencia en atención primaria.'
      }
    }),
    prisma.doctor.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        nombre: 'Dra. Ana Pérez',
        especialidad: 'Dermatología',
        descripcion: 'Especialista en piel, cabello y uñas.',
        foto: '/images/doctor2.png',
        cv: 'Dermatóloga clínica y estética con 10+ años de experiencia.'
      }
    }),
    prisma.doctor.upsert({
      where: { id: 3 },
      update: {},
      create: {
        id: 3,
        nombre: 'Dr. Juan Ramírez',
        especialidad: 'Nutrición',
        descripcion: 'Enfoque clínico y personalizado en planes alimenticios.',
        foto: '/images/doctor4.png',
        cv: 'Lic. en Nutrición; planes alimenticios personalizados para todas las edades.'
      }
    }),
  ])

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
  if (!horarios.length) return []

  await prisma.horario.createMany({
    data: horarios,
    skipDuplicates: true, // por si ejecutas el seed más de una vez
  })

  // Vuelve a leer para obtener los IDs (createMany no devuelve registros)
  // Puedes filtrar por rango de fechas cercano para no traer toda la tabla
  const minFecha = horarios[0].fechaHora
  const maxFecha = horarios[horarios.length - 1].fechaHora
  const creados = await prisma.horario.findMany({
    where: { fechaHora: { gte: minFecha, lte: maxFecha } },
    orderBy: { fechaHora: 'asc' }
  })
  return creados
}

async function seedCitas({ paciente1, paciente2 }, horarios) {
  if (horarios.length < 10) return

  // Toma algunos slots libres para ejemplos
  const slot1 = horarios[3]     // cercano (PROGRAMADA)
  const slot2 = horarios[10]    // CONFIRMADA
  const slot3 = horarios[20]    // CANCELADA

  // Lee fecha real desde horario para consistencia
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
      // si liberas el slot al cancelar, deja horarioId: null;
      // para ejemplificar, guardamos el enlace y el estado CANCELADA
      horarioId: h3.id,
    }
  ]

  // Crea individualmente para respetar la UNIQUE(horarioId)
  for (const c of data) {
    await prisma.cita.create({ data: c })
  }
}

async function main() {
  console.log('→ Limpiando datos...')
  await wipeData()

  console.log('→ Creando usuarios...')
  const users = await seedUsers()

  console.log('→ Creando doctores...')
  const doctores = await seedDoctors()

  console.log('→ Creando horarios...')
  const horarios = await seedHorarios(doctores)

  console.log('→ Creando citas de ejemplo...')
  await seedCitas(users, horarios)

  console.log('✓ Seed completado')
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

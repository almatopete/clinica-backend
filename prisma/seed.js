const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { addDays, isWeekend, setHours, setMinutes } = require('date-fns')

async function main() {
  // Eliminar datos anteriores si es necesario
  await prisma.cita.deleteMany()
  await prisma.horario.deleteMany()
  await prisma.doctor.deleteMany()

  // Crear una cita de ejemplo
  await prisma.cita.create({
    data: {
      nombre: "María López",
      email: "maria@example.com",
      telefono: "5551234567",
      fecha: new Date('2025-04-05T10:00:00.000Z'),
      motivo: "Valoración facial"
    }
  })

  // Crear doctores
  const doctores = await prisma.$transaction([
    prisma.doctor.create({ data: { nombre: 'Dra. Ana Pérez', especialidad: 'Dermatología' } }),
    prisma.doctor.create({ data: { nombre: 'Dr. Carlos Méndez', especialidad: 'Medicina General' } }),
    prisma.doctor.create({ data: { nombre: 'Dra. Laura Ramírez', especialidad: 'Nutrición' } })
  ])

  const start = new Date()
  const horarios = []

  for (let i = 0; i < 60; i++) {
    const day = addDays(start, i)
    const dayOfWeek = day.getDay()

    // Solo lunes (1) y viernes (5)
    if (dayOfWeek === 1 || dayOfWeek === 5) {
      for (let hour = 9; hour <= 17; hour++) {
        for (const doctor of doctores) {
          const fechaHora = setMinutes(setHours(new Date(day), hour), 0)
          horarios.push({
            doctorId: doctor.id,
            fechaHora
          })
        }
      }
    }
  }

  await prisma.horario.createMany({ data: horarios })
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })

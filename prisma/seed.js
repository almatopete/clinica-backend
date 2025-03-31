const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.cita.create({
    data: {
      nombre: "María López",
      email: "maria@example.com",
      telefono: "5551234567",
      fecha: new Date('2025-04-05T10:00:00.000Z'),
      motivo: "Valoración facial"
    }
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
  })

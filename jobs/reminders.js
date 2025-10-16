const cron = require('node-cron')

// Corre cada 10 min; busca citas en ventanas ~24h o ~2h
cron.schedule('*/10 * * * *', async () => {
  const ahora = new Date()
  const ventana = (h) => {
    const target = new Date(ahora.getTime() + h*60*60*1000)
    // margen +-5min
    const min = new Date(target.getTime() - 5*60*1000)
    const max = new Date(target.getTime() + 5*60*1000)
    return { min, max }
  }

  const ventanas = [ventana(24), ventana(2)]
  for (const v of ventanas) {
    const citas = await prisma.cita.findMany({
      where: {
        estado: 'PROGRAMADA',
        fecha: { gte: v.min, lte: v.max }
      },
      include: { horario: { include: { doctor: true } } }
    })
    for (const c of citas) {
      try { await enviarConfirmacionCita({ ...c, reminder: true }) } catch (e) { console.error('Reminder email error:', e) }
    }
  }
})

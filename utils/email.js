const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

async function enviarConfirmacionCita(cita) {
  await resend.emails.send({
    from: 'Clinica <onboarding@resend.dev>',
    to: cita.email,
    subject: 'Confirmación de Cita Médica',
    html: `
      <h2>Hola ${cita.nombre},</h2>
      <p>Tu cita fue agendada exitosamente.</p>
      <p><strong>Fecha:</strong> ${new Date(cita.fecha).toLocaleString()}</p>
      <p><strong>Motivo:</strong> ${cita.motivo}</p>
      <br>
      <p>Gracias por confiar en nuestra clínica.</p>
    `
  })
}

module.exports = { enviarConfirmacionCita }

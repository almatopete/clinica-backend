// backend/mailer.js
const Mailjet = require('node-mailjet')
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
)

async function enviarConfirmacionCita(cita) {
  const request = mailjet
    .post('send', { version: 'v3.1' })
    .request({
      Messages: [
        {
          From: {
            Email: 'no-reply@medicalcenter.infinityfreeapp.com',
            Name: "Centro Médico"
          },
          To: [
            {
              Email: cita.email,
              Name: cita.nombre
            }
          ],
          Subject: "Confirmación de Cita Médica",
          TextPart: `Hola ${cita.nombre}, tu cita ha sido agendada para el ${new Date(cita.fecha).toLocaleString()}. Motivo: ${cita.motivo}.`,
          HTMLPart: `
            <h3>Hola ${cita.nombre},</h3>
            <p>Tu cita ha sido <strong>confirmada</strong> para el <strong>${new Date(cita.fecha).toLocaleString()}</strong>.</p>
            <p><strong>Motivo:</strong> ${cita.motivo}</p>
            <hr />
            <p>Gracias por confiar en nosotros.</p>
          `
        }
      ]
    })

    request
  .then((result) => {
    console.log(result.body.Messages[0].To[0])
    console.log(result.body);
  })
  .catch((err) => {
    console.error(err.statusCode, err.message);
  });


}

module.exports = { enviarConfirmacionCita }

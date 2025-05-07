const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'secret123' // Cambia esto en producción

function generarToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' })

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(403).json({ error: 'Token inválido' })
  }
}

module.exports = { generarToken, verificarToken }

const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'secret123' // Cambia esto en producción

function generarToken(user) {
  const payload = { id: user.id, email: user.email, role: user.role }
  // Para académico puedes dejar 7d; ideal en real: 15m + refresh token
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' })
  const token = authHeader.split(' ')[1]
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(403).json({ error: 'Token inválido' })
  }
}

// Uso: requireRole('ADMIN') o requireRole('PATIENT','ADMIN')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    next()
  }
}

module.exports = { generarToken, verificarToken, requireRole }

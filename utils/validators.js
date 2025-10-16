const { body, param, query } = require('express-validator')

const validarRegistro = [
  body('nombre').isString().trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 100 }),
]

const validarLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 100 }),
]

const validarCrearCita = [
  body('nombre').isString().trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('telefono').isString().trim().isLength({ min: 7, max: 20 }),
  body('motivo').isString().trim().isLength({ min: 3, max: 200 }),
  body('horarioId').isInt({ gt: 0 })
]

const validarIdParam = [ param('id').isInt({ gt: 0 }) ]

const validarReprogramar = [
  body('accion').isIn(['cancelar', 'reprogramar']),
  body('nuevoHorarioId').optional().isInt({ gt: 0 })
]

const validarFiltroDoctores = [
  query('especialidad').optional().isString().trim().isLength({ min: 2, max: 80 })
]

module.exports = {
  validarRegistro, validarLogin, validarCrearCita, validarIdParam, validarReprogramar, validarFiltroDoctores
}

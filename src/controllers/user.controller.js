/** User controller — admin-only CRUD. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const userService = require('../services/user.service');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  roleIds: z.array(z.coerce.number()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.coerce.number()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
});

const list = asyncHandler(async (req, res) => {
  const q = listQuerySchema.parse(req.query);
  res.json(await userService.list(q));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await userService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);
  res.status(201).json(await userService.create(data));
});

const update = asyncHandler(async (req, res) => {
  const data = updateUserSchema.parse(req.body);
  res.json(await userService.update(req.params.id, data));
});

const deactivate = asyncHandler(async (req, res) => {
  res.json(await userService.softDelete(req.params.id));
});

module.exports = {
  list: [validate({ query: listQuerySchema }), list],
  getById,
  create: [validate({ body: createUserSchema }), create],
  update: [validate({ body: updateUserSchema }), update],
  deactivate,
};

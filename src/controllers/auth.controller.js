/** Auth controller — thin HTTP wrapper over auth.service. */
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');
const authService = require('../services/auth.service');
const validate = require('../middlewares/validate.middleware');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ accessToken, user });
});

const refresh = asyncHandler(async (req, res) => {
  // Prefer cookie; fall back to body for non-browser clients
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  const { accessToken, refreshToken: newRt, user } = await authService.refresh(refreshToken);
  res.cookie('refreshToken', newRt, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  // Stateless refresh — client just discards. We clear the cookie.
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  res.json(user);
});

module.exports = {
  login: [validate({ body: loginSchema }), login],
  refresh: [validate({ body: refreshSchema }), refresh],
  logout,
  me,
};

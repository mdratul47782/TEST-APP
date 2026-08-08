/**
 * Auth routes: POST /api/auth/register, POST /api/auth/login
 *
 * Simple JWT authentication - stateless tokens signed with `JWT_SECRET`,
 * no session store, no expiry constraints (generous `JWT_EXPIRES_IN`).
 */
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { users, ROLES } = require('../db/schema');

/**
 * A submitted `role` is only honored when the request carries a valid
 * Admin token - otherwise public registration always lands on the safe
 * default role (Store_Manager). Prevents privilege self-escalation.
 */
function isAdminRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET).role === 'Admin';
  } catch {
    return false;
  }
}

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/* ------------------------------ Register ------------------------------ */

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ message: `Role must be one of: ${ROLES.join(', ')}.` });
  }

  // Only an authenticated Admin may create privileged accounts.
  const effectiveRole = role && isAdminRequest(req) ? role : 'Store_Manager';

  const normalizedEmail = normalizeEmail(email);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ message: 'A user with this email already exists.' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const [inserted] = await db.insert(users).values({
    name: String(name).trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: effectiveRole,
  });

  const user = {
    id: inserted.insertId,
    name: String(name).trim(),
    email: normalizedEmail,
    role: effectiveRole,
  };

  return res.status(201).json({ message: 'Account created successfully.', token: signToken(user), user });
});

/* ------------------------------- Login -------------------------------- */

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  if (!row) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(String(password), row.password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const user = publicUser(row);
  return res.json({ message: 'Login successful.', token: signToken(user), user });
});

module.exports = router;

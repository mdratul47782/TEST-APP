/**
 * Simple JWT authentication middleware.
 *
 * - authenticate: verifies the `Authorization: Bearer <token>` header and
 *   attaches the decoded user payload to `req.user`.
 * - authorize(...roles): role-based access control guard (must run after
 *   `authenticate`).
 */
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Allowed roles: ${allowedRoles.join(', ')}.`,
      });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };

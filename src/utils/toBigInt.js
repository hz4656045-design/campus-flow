/**
 * Safely coerce a value to a JS bigint for Prisma BigInt-typed fields.
 *
 * Why this exists:
 *   `BigInt(value)` throws `TypeError: Cannot convert a BigInt value to a BigInt`
 *   when `value` is already a bigint. Across the app, id values arrive as either:
 *     - bigint  (already coerced upstream, e.g. from req.user.id, schema.parse)
 *     - string  (from req.params / req.query / JWT payload.sub)
 *     - number  (rare, from JSON bodies)
 *   so a bare `BigInt(x)` is unsafe. This helper normalises all three.
 *
 *   toBigInt(1n)        // → 1n           (no throw)
 *   toBigInt('123')     // → 123n
 *   toBigInt(123)       // → 123n
 */
function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  return BigInt(value);
}

module.exports = toBigInt;

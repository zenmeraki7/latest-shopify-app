import { ZodError } from "zod";

/**
 * ✅ Universal Zod validation middleware
 *
 * Ensures consistent validation for request body, params, and query.
 * Integrates clean error formatting and async-safe parsing.
 *
 * Usage:
 *   router.post("/path", validate(schema), controller)
 */
export function validate(schema) {
  return async (req, res, next) => {
    try {
      // Validate all common request sources
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Zod-specific validation failure
        return res.status(400).json({
          error: "Validation failed",
          details: err.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }

      // Unknown or runtime error
      console.error("❌ Unexpected validation error:", err);
      return res.status(500).json({
        error: "Internal validation error",
      });
    }
  };
}

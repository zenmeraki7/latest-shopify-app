import crypto from "crypto";

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  // Convert strings to buffers for timing-safe comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  // If lengths differ, still compare to prevent timing leak
  if (bufA.length !== bufB.length) {
    // Compare against a dummy buffer of the same length
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Admin authentication middleware
 * Validates Bearer token against ADMIN_API_KEY
 */
export function adminAuth(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: "Authorization header is required" 
      });
    }

    // Check Bearer format
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "Invalid authorization format. Use: Bearer <token>" 
      });
    }

    // Extract token
    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({ 
        error: "Token is required" 
      });
    }

    // Validate token using timing-safe comparison
    if (!timingSafeCompare(token, process.env.ADMIN_API_KEY)) {
      return res.status(403).json({ 
        error: "Unauthorized" 
      });
    }

    // Token is valid, proceed
    next();

  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(500).json({ 
      error: "Authentication failed" 
    });
  }
}
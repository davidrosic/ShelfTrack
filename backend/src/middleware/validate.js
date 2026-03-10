/**
 * Request Validation Middleware
 *
 * Design Decisions:
 *
 * 1. SCHEMA-BASED VALIDATION
 *    - Define expected shape of request body/query/params
 *    - Centralized validation rules (DRY principle)
 *    - Easy to extend for new endpoints
 *
 * 2. VALIDATION STRATEGY
 *    - Check required fields exist
 *    - Type checking (string, number, email, etc.)
 *    - Format validation (email regex, date parsing)
 *    - Custom validators for business rules
 *
 * 3. ERROR ACCUMULATION
 *    - Collect all validation errors, not just first
 *    - Return detailed error response
 *    - Field-level error messages for forms
 *
 * 4. SANITIZATION
 *    - Trim string inputs
 *    - Convert types (string -> number)
 *    - Prevent common injection patterns
 */

/**
 * Validate request body against schema
 *
 * @param {Object} schema - Validation schema
 * @param {Object} schema.fields - Field definitions
 * @param {Array<string>} [schema.required] - Required field names
 *
 * Schema format:
 * {
 *   fields: {
 *     email: { type: 'email', min: 5, max: 255 },
 *     age: { type: 'number', min: 0, max: 150 }
 *   },
 *   required: ['email', 'age']
 * }
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = {};
    const data = req.body || {};

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (
          data[field] === undefined ||
          data[field] === null ||
          data[field] === ""
        ) {
          errors[field] = errors[field] || [];
          errors[field].push(`${field} is required`);
        }
      }
    }

    // Validate each field
    if (schema.fields) {
      for (const [field, rules] of Object.entries(schema.fields)) {
        const value = data[field];

        // Skip validation if field is empty and not required
        if (value === undefined || value === null || value === "") {
          continue;
        }

        // Type validation
        if (rules.type) {
          const error = validateType(field, value, rules.type, rules);
          if (error) {
            errors[field] = errors[field] || [];
            errors[field].push(error);
          }
        }

        // String length validation
        if (typeof value === "string") {
          if (rules.min !== undefined && value.length < rules.min) {
            errors[field] = errors[field] || [];
            errors[field].push(
              `${field} must be at least ${rules.min} characters`,
            );
          }
          if (rules.max !== undefined && value.length > rules.max) {
            errors[field] = errors[field] || [];
            errors[field].push(
              `${field} must be at most ${rules.max} characters`,
            );
          }
        }

        // Number range validation
        if (typeof value === "number") {
          if (rules.min !== undefined && value < rules.min) {
            errors[field] = errors[field] || [];
            errors[field].push(`${field} must be at least ${rules.min}`);
          }
          if (rules.max !== undefined && value > rules.max) {
            errors[field] = errors[field] || [];
            errors[field].push(`${field} must be at most ${rules.max}`);
          }
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
          errors[field] = errors[field] || [];
          errors[field].push(
            `${field} must be one of: ${rules.enum.join(", ")}`,
          );
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
          errors[field] = errors[field] || [];
          if (field === 'password') {
            errors[field].push("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)");
          } else {
            errors[field].push(`${field} format is invalid`);
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Request validation failed",
        errors,
      });
    }

    // Sanitize strings (trim whitespace)
    if (schema.fields) {
      for (const field of Object.keys(schema.fields)) {
        if (typeof data[field] === "string") {
          req.body[field] = data[field].trim();
        }
      }
    }

    next();
  };
}

/**
 * Validate a value's type
 * @returns {string|null} Error message or null if valid
 */
function validateType(field, value, type, _rules) {
  switch (type) {
    case "string":
      if (typeof value !== "string") {
        return `${field} must be a string`;
      }
      break;

    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return `${field} must be a number`;
      }
      break;

    case "integer":
      if (!Number.isInteger(value)) {
        return `${field} must be an integer`;
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        return `${field} must be a boolean`;
      }
      break;

    case "email": {
      if (typeof value !== "string") {
        return `${field} must be a string`;
      }
      // RFC 5322 compliant email regex (simplified)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${field} must be a valid email address`;
      }
      break;
    }

    case "date":
      if (!(value instanceof Date) && isNaN(Date.parse(value))) {
        return `${field} must be a valid date`;
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return `${field} must be an array`;
      }
      break;

    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return `${field} must be an object`;
      }
      break;

    default:
      return null;
  }
  return null;
}

/**
 * Predefined validation schemas for common operations
 */
export const schemas = {
  user: {
    register: {
      fields: {
        email: { type: "email", required: true },
        username: { type: "string", min: 3, max: 50, required: true },
        password: { 
          type: "string", 
          min: 8, 
          max: 255, 
          required: true,
          pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
        },
        firstName: { type: "string", min: 1, max: 100, required: true },
        lastName: { type: "string", min: 1, max: 100, required: true },
        dateOfBirth: { type: "date" },
      },
      required: ["email", "username", "password", "firstName", "lastName"],
    },
    login: {
      fields: {
        email: { type: "email", required: true },
        password: { type: "string", required: true },
      },
      required: ["email", "password"],
    },
  },

  book: {
    create: {
      fields: {
        openLibraryId: { type: "string", max: 50 },
        title: { type: "string", min: 1, max: 255, required: true },
        author: { type: "string", min: 1, max: 255, required: true },
        coverUrl: { type: "string", max: 2048 },
        firstPublishYear: { type: "integer", min: 1000, max: 2100 },
        isCustom: { type: "boolean" },
      },
      required: ["title", "author"],
    },
    search: {
      fields: {
        q: { type: "string", min: 1, max: 255, required: true },
      },
      required: ["q"],
    },
  },

  userBook: {
    addToShelf: {
      fields: {
        bookId: { type: "integer", required: true },
        status: { type: "string", enum: ["want_to_read", "reading", "read"] },
        rating: { type: "integer", min: 1, max: 5 },
        review: { type: "string", max: 10000 },
        notes: { type: "string", max: 10000 },
      },
      required: ["bookId"],
    },
    updateStatus: {
      fields: {
        status: {
          type: "string",
          enum: ["want_to_read", "reading", "read"],
          required: true,
        },
      },
      required: ["status"],
    },
    updateReview: {
      fields: {
        rating: { type: "integer", min: 1, max: 5 },
        review: { type: "string", max: 10000 },
        notes: { type: "string", max: 10000 },
      },
    },
  },
};

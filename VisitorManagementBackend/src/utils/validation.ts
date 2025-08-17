import Joi from 'joi';

// User registration validation schema
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    }),
  
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name must not exceed 100 characters',
      'any.required': 'First name is required'
    }),
  
  lastName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name must not exceed 100 characters',
      'any.required': 'Last name is required'
    })
});

// User login validation schema
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// Visitor validation schemas
export const createVisitorSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.min': 'Name cannot be empty',
      'string.max': 'Name must not exceed 255 characters',
      'any.required': 'Name is required'
    }),
  
  title: Joi.string()
    .trim()
    .max(255)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Title must not exceed 255 characters'
    }),
  
  company: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.min': 'Company cannot be empty',
      'string.max': 'Company must not exceed 255 characters',
      'any.required': 'Company is required'
    }),
  
  phone: Joi.string()
    .trim()
    .max(50)
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Phone must not exceed 50 characters',
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  
  email: Joi.string()
    .email()
    .max(255)
    .allow('')
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email must not exceed 255 characters'
    }),
  
  website: Joi.string()
    .uri()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.uri': 'Please provide a valid website URL',
      'string.max': 'Website must not exceed 500 characters'
    }),
  
  interests: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .min(0)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least 0 interests are required',
      'array.max': 'Maximum 20 interests allowed',
      'any.required': 'Interests array is required'
    }),
  
  notes: Joi.string()
    .trim()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes must not exceed 2000 characters'
    }),
  
  captureMethod: Joi.string()
    .valid('business_card', 'event_badge')
    .required()
    .messages({
      'any.only': 'Capture method must be either "business_card" or "event_badge"',
      'any.required': 'Capture method is required'
    }),
  
  capturedAt: Joi.string()
    .isoDate()
    .required()
    .messages({
      'string.isoDate': 'Captured at must be a valid ISO date',
      'any.required': 'Captured at date is required'
    }),
  
  localId: Joi.string()
    .trim()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Local ID must not exceed 255 characters'
    })
});

export const updateVisitorSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .messages({
      'string.min': 'Name cannot be empty',
      'string.max': 'Name must not exceed 255 characters'
    }),
  
  title: Joi.string()
    .trim()
    .max(255)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Title must not exceed 255 characters'
    }),
  
  company: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .messages({
      'string.min': 'Company cannot be empty',
      'string.max': 'Company must not exceed 255 characters'
    }),
  
  phone: Joi.string()
    .trim()
    .max(50)
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Phone must not exceed 50 characters',
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  
  email: Joi.string()
    .email()
    .max(255)
    .allow('')
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email must not exceed 255 characters'
    }),
  
  website: Joi.string()
    .uri()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.uri': 'Please provide a valid website URL',
      'string.max': 'Website must not exceed 500 characters'
    }),
  
  interests: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .min(0)
    .max(20)
    .optional()
    .messages({
      'array.min': 'At least 0 interests are required',
      'array.max': 'Maximum 20 interests allowed'
    }),
  
  notes: Joi.string()
    .trim()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes must not exceed 2000 characters'
    }),
  
  captureMethod: Joi.string()
    .valid('business_card', 'event_badge')
    .optional()
    .messages({
      'any.only': 'Capture method must be either "business_card" or "event_badge"'
    }),
  
  capturedAt: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Captured at must be a valid ISO date'
    })
});

// Sync operation validation schema
const syncOperationSchema = Joi.object({
  action: Joi.string()
    .valid('create', 'update', 'delete')
    .required()
    .messages({
      'any.only': 'Action must be one of: create, update, delete',
      'any.required': 'Action is required'
    }),
  
  localId: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.min': 'Local ID cannot be empty',
      'string.max': 'Local ID must not exceed 255 characters',
      'any.required': 'Local ID is required'
    }),
  
  serverId: Joi.string()
    .trim()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Server ID must not exceed 255 characters'
    }),
  
  timestamp: Joi.string()
    .isoDate()
    .required()
    .messages({
      'string.isoDate': 'Timestamp must be a valid ISO date',
      'any.required': 'Timestamp is required'
    }),
  
  data: Joi.when('action', {
    is: 'create',
    then: createVisitorSchema.fork(['localId'], (schema) => schema.optional()),
    otherwise: Joi.when('action', {
      is: 'update',
      then: updateVisitorSchema,
      otherwise: Joi.optional()
    })
  })
});

// Bulk sync validation schema
export const bulkSyncSchema = Joi.object({
  operations: Joi.array()
    .items(syncOperationSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one operation is required',
      'array.max': 'Maximum 1000 operations allowed per sync request',
      'any.required': 'Operations array is required'
    }),
  
  lastSyncTimestamp: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Last sync timestamp must be a valid ISO date'
    })
});

// Visitor validation helper functions
export const validateVisitorData = (data: any) => {
  const { error } = createVisitorSchema.validate(data, { abortEarly: false });
  
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return { isValid: true, errors: [] };
};

export const validateVisitorUpdate = (data: any) => {
  const { error } = updateVisitorSchema.validate(data, { abortEarly: false });
  
  if (error) {
    return {
      isValid: false,
      errors: error.details.map(detail => detail.message)
    };
  }
  
  return { isValid: true, errors: [] };
};

// Validation middleware helper
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validationErrors,
          correlationId: req.correlationId || 'unknown'
        }
      });
    }

    req.body = value;
    next();
  };
};
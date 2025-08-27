# API Utilities

This folder contains utility modules to improve the API's functionality, maintainability, and consistency.

## Available Utilities

### 🔍 `validation.js`
Input validation and data sanitization utilities.

**Key functions:**
- `validateGuildSettings(settings)` - Validates guild settings object
- `validateAutoResponse(response)` - Validates auto response object  
- `isValidDiscordId(id)` - Validates Discord snowflake IDs
- `isValidHexColor(color)` - Validates hex color codes
- `sanitizeString(str, maxLength)` - Sanitizes string input

**Example:**
```javascript
const { validateGuildSettings } = require('../utils');

const validation = validateGuildSettings(req.body);
if (!validation.valid) {
  return res.status(400).json({ errors: validation.errors });
}
```

### 📤 `responses.js`
Standardized API response formatting utilities.

**Key functions:**
- `successResponse(data, message)` - Creates consistent success responses
- `errorResponse(error, statusCode)` - Creates consistent error responses
- `validationErrorResponse(errors)` - Creates validation error responses
- `formatUser(user)` - Formats user objects for API responses
- `formatSettings(settings)` - Formats settings objects for API responses

**Example:**
```javascript
const { successResponse, formatSettings } = require('../utils');

const settings = await store.getGuildSettings(guildId);
res.json(successResponse(formatSettings(settings)));
```

### ❌ `errors.js`
Error handling classes and middleware.

**Key classes:**
- `APIError` - Base API error class
- `ValidationError` - Validation errors (400)
- `AuthenticationError` - Auth errors (401)
- `NotFoundError` - Not found errors (404)

**Key functions:**
- `errorHandler(err, req, res, next)` - Express error middleware
- `asyncHandler(fn)` - Wraps async route handlers
- `notFoundHandler(req, res)` - 404 handler for unmatched routes

**Example:**
```javascript
const { asyncHandler, NotFoundError } = require('../utils');

router.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await store.getUser(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json(successResponse(user));
}));
```

### 🛠️ `helpers.js`
General helper utilities for common API operations.

**Key functions:**
- `extractPagination(query)` - Extracts pagination from query params
- `getUserGuildId(req, store)` - Gets user's selected guild ID
- `validateGuildAccess(client, guildId)` - Validates bot has guild access
- `generateRandomString(length)` - Generates random strings
- `formatDuration(ms)` - Formats milliseconds to readable duration

**Example:**
```javascript
const { extractPagination, getUserGuildId } = require('../utils');

const { page, limit, offset } = extractPagination(req.query);
const guildId = await getUserGuildId(req, store);
```

## Usage Patterns

### 1. Basic Route with Utilities
```javascript
const { asyncHandler, successResponse, getUserGuildId } = require('../utils');

router.get('/', asyncHandler(async (req, res) => {
  const guildId = await getUserGuildId(req, store);
  const data = await store.getData(guildId);
  res.json(successResponse(data));
}));
```

### 2. Route with Validation
```javascript
const { 
  asyncHandler, 
  validateGuildSettings, 
  successResponse, 
  validationErrorResponse 
} = require('../utils');

router.put('/', asyncHandler(async (req, res) => {
  const validation = validateGuildSettings(req.body);
  if (!validation.valid) {
    return res.status(400).json(validationErrorResponse(validation.errors));
  }
  
  const updated = await store.updateSettings(validation.data);
  res.json(successResponse(updated, 'Settings updated'));
}));
```

### 3. Adding Error Handling to Server
```javascript
const { errorHandler, notFoundHandler } = require('./utils');

// Add to server.js after all routes
app.use(notFoundHandler);
app.use(errorHandler);
```

## Benefits

✅ **Consistency** - Standardized responses across all endpoints  
✅ **Validation** - Robust input validation and sanitization  
✅ **Error Handling** - Comprehensive error handling with proper HTTP codes  
✅ **Maintainability** - Reusable utilities reduce code duplication  
✅ **Security** - Input sanitization and validation prevent common vulnerabilities  
✅ **Developer Experience** - Clear error messages and standardized responses

## Integration

To integrate these utilities into existing routes:

1. **Import what you need:**
   ```javascript
   const { asyncHandler, successResponse, validateGuildSettings } = require('../utils');
   ```

2. **Wrap async routes:**
   ```javascript
   router.get('/', asyncHandler(async (req, res) => {
     // Your async logic here
   }));
   ```

3. **Use validation:**
   ```javascript
   const validation = validateGuildSettings(req.body);
   if (!validation.valid) {
     return res.status(400).json(validationErrorResponse(validation.errors));
   }
   ```

4. **Format responses:**
   ```javascript
   res.json(successResponse(data, 'Optional success message'));
   ```

See `example-enhanced-settings.js` for a complete example of an enhanced route using these utilities.

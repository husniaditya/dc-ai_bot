# AI-Powered Auto Response Management

This document describes the AI chat assistant's capabilities for managing auto-responses through natural language.

## Overview

The Chocomaid AI Assistant now supports full CRUD (Create, Read, Update, Delete) operations for auto-responses. Users can interact with the bot's auto-response system using natural language instead of filling out forms.

## Available AI Functions

### 1. **list_auto_responses**
Lists all auto-responses for the current guild.

**Example queries:**
- "Show me all auto-responses"
- "List my triggers"
- "What auto-responses do I have?"

### 2. **get_auto_response**
Get details of a specific auto-response.

**Parameters:**
- `key` (required): The identifier of the auto-response

**Example queries:**
- "Show me the 'greeting' auto-response"
- "Get details for trigger 'welcome'"

### 3. **create_auto_response**
Create a new auto-response trigger.

**Parameters:**
- `key` (required): Unique identifier (e.g., "greeting")
- `text` (required): Text to match (e.g., "hello")
- `replies` (required): Array of possible replies
- `matchType` (optional): "contains", "whole", or "exact" (default: "contains")
- `flags` (optional): Regex flags (default: "i" for case-insensitive)
- `enabled` (optional): Enable/disable (default: true)

**Example queries:**
- "Create an auto-response called 'greeting' that triggers on 'hello' and replies 'Hi there!'"
- "Add a trigger for 'goodbye' that says 'See you later!' or 'Bye!'"
- "Make a new auto-response key: 'welcome', text: 'welcome', reply: 'Welcome to the server!'"

### 4. **update_auto_response**
Update an existing auto-response.

**Parameters:**
- `key` (required): The identifier of the auto-response to update
- `text` (optional): New text to match
- `replies` (optional): New array of replies
- `matchType` (optional): New match type
- `flags` (optional): New regex flags
- `enabled` (optional): Enable/disable

**Example queries:**
- "Update the 'greeting' auto-response to say 'Hello friend!'"
- "Change the trigger for 'welcome' to match 'welcome back'"
- "Modify 'goodbye' replies to 'Farewell!' and 'See you soon!'"

### 5. **delete_auto_response**
Delete an auto-response.

**Parameters:**
- `key` (required): The identifier of the auto-response to delete

**Example queries:**
- "Delete the 'greeting' auto-response"
- "Remove the trigger called 'goodbye'"
- "Delete auto-response 'test'"

### 6. **toggle_auto_response**
Enable or disable an auto-response without deleting it.

**Parameters:**
- `key` (required): The identifier of the auto-response
- `enabled` (required): true to enable, false to disable

**Example queries:**
- "Disable the 'greeting' auto-response"
- "Enable the trigger 'welcome'"
- "Turn off 'goodbye' auto-response"

## Match Types

### Contains (Default)
Matches if the text appears anywhere in the message.
- Pattern: "hello" matches "hello", "hello world", "say hello"

### Whole Word
Matches complete words only.
- Pattern: "hello" matches "hello world" but NOT "helloworld"

### Exact
Matches only if the entire message is exactly the text.
- Pattern: "hello" matches ONLY "hello", not "hello world"

## Examples

### Create Examples

```
User: "Create an auto-response called 'greet' that triggers on 'hi' and says 'Hello!'"
AI: Executes create_auto_response with:
  - key: "greet"
  - text: "hi"
  - replies: ["Hello!"]
  - matchType: "contains"
  - flags: "i"
```

```
User: "Add a trigger for 'thanks' that responds with 'You're welcome!' or 'No problem!'"
AI: Executes create_auto_response with:
  - key: "thanks"
  - text: "thanks"
  - replies: ["You're welcome!", "No problem!"]
```

### Update Examples

```
User: "Update the 'greet' trigger to also say 'Hey there!'"
AI: Executes update_auto_response with:
  - key: "greet"
  - replies: ["Hey there!"]
```

```
User: "Change 'welcome' to match the exact phrase 'welcome'"
AI: Executes update_auto_response with:
  - key: "welcome"
  - matchType: "exact"
```

### Delete Examples

```
User: "Delete the 'test' auto-response"
AI: Executes delete_auto_response with:
  - key: "test"
```

### Toggle Examples

```
User: "Disable the 'greet' trigger"
AI: Executes toggle_auto_response with:
  - key: "greet"
  - enabled: false
```

## Parameter Extraction

The AI uses pattern matching to extract parameters from natural language:

### Key Extraction
- "called X", "named X", "key: X"
- "'X' auto-response"

### Text Extraction
- "text: 'X'", "pattern: 'X'", "triggers on 'X'"
- "when someone says 'X'"
- "detect 'X'"

### Replies Extraction
- "reply: 'X'", "responds with 'X'"
- "say 'X' or 'Y'"
- Multiple replies separated by "or", "and", commas

### Match Type Detection
- Contains: "contains", "anywhere"
- Whole: "whole word", "complete word"
- Exact: "exact", "exactly"

### Enabled/Disabled
- Disable: "disable", "turn off"
- Enable: "enable", "turn on"

## Technical Implementation

### Backend (ai-chat.js)

The AI chat endpoint includes:
1. **Function Definitions**: Tools with parameters and handlers
2. **Parameter Extraction**: `extractParametersFromMessage()` function
3. **Function Execution**: Async handlers that interact with the store
4. **Natural Language Response**: Gemini generates user-friendly responses

### Frontend (FloatingAIChat.jsx)

Features:
1. **Function Call Display**: Shows which function was executed
2. **Auto-Refresh**: Automatically refreshes data after CRUD operations
3. **Error Handling**: Displays errors in a user-friendly way
4. **Context Awareness**: Knows which guild the user is viewing

## Auto-Refresh Behavior

When a CRUD operation is performed:
1. AI executes the function
2. Backend returns the result
3. Frontend displays the AI's response
4. After 500ms, the dashboard automatically refreshes to show the changes

This ensures users see the updated auto-response list immediately after making changes.

## Error Handling

The AI provides clear error messages for:
- Missing required parameters
- Invalid parameter types
- Non-existent auto-responses
- Database errors

Example error responses:
- "I couldn't find an auto-response called 'xyz'"
- "To create an auto-response, I need at least a key, text, and reply"
- "Failed to update auto-response: database error"

## Best Practices

1. **Use clear identifiers**: Choose descriptive keys for auto-responses
2. **Quote text and replies**: Use quotes to clearly separate values
3. **Be specific**: When updating, mention which field you want to change
4. **Verify changes**: The AI will confirm what was changed
5. **Use natural language**: The AI understands conversational requests

## Future Enhancements

Potential improvements:
- Bulk operations (create/update/delete multiple at once)
- Search and filter auto-responses
- Test auto-response patterns against sample messages
- Import/export auto-response configurations
- Suggest similar existing auto-responses to avoid duplicates

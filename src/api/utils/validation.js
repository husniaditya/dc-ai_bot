/**
 * API-specific validation utilities
 */

// Common validation patterns
const patterns = {
  discordId: /^\d{17,19}$/,
  hexColor: /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  timezone: /^[A-Za-z_]+\/[A-Za-z_]+$/,
  language: /^[a-z]{2}(-[A-Z]{2})?$/,
  prefix: /^.{1,5}$/
};

/**
 * Validate Discord snowflake ID
 */
function isValidDiscordId(id) {
  return typeof id === 'string' && patterns.discordId.test(id);
}

/**
 * Validate hex color code
 */
function isValidHexColor(color) {
  return typeof color === 'string' && patterns.hexColor.test(color);
}

/**
 * Validate timezone string
 */
function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate language code
 */
function isValidLanguage(lang) {
  return typeof lang === 'string' && patterns.language.test(lang);
}

/**
 * Validate bot prefix
 */
function isValidPrefix(prefix) {
  return typeof prefix === 'string' && patterns.prefix.test(prefix) && prefix.length > 0;
}

/**
 * Sanitize string input
 */
function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

/**
 * Validate and sanitize guild settings object
 */
function validateGuildSettings(settings) {
  const errors = [];
  const clean = {};

  // Auto reply enabled
  if (settings.autoReplyEnabled !== undefined) {
    if (typeof settings.autoReplyEnabled === 'boolean') {
      clean.autoReplyEnabled = settings.autoReplyEnabled;
    } else {
      errors.push('autoReplyEnabled must be boolean');
    }
  }

  // Auto reply cooldown
  if (settings.autoReplyCooldownMs !== undefined) {
    const cooldown = Number(settings.autoReplyCooldownMs);
    if (!isNaN(cooldown) && cooldown >= 0 && cooldown <= 300000) { // 0-5 minutes
      clean.autoReplyCooldownMs = cooldown;
    } else {
      errors.push('autoReplyCooldownMs must be number between 0 and 300000');
    }
  }

  // Language
  if (settings.language !== undefined) {
    if (isValidLanguage(settings.language)) {
      clean.language = settings.language;
    } else {
      errors.push('language must be valid language code (e.g., en, en-US)');
    }
  }

  // Timezone
  if (settings.timezone !== undefined) {
    if (isValidTimezone(settings.timezone)) {
      clean.timezone = settings.timezone;
    } else {
      errors.push('timezone must be valid timezone (e.g., America/New_York)');
    }
  }

  // Hour format
  if (settings.hourFormat !== undefined) {
    if (settings.hourFormat === 12 || settings.hourFormat === 24) {
      clean.hourFormat = settings.hourFormat;
    } else {
      errors.push('hourFormat must be 12 or 24');
    }
  }

  // Embed color
  if (settings.embedColor !== undefined) {
    const color = sanitizeString(settings.embedColor, 7);
    if (isValidHexColor(color)) {
      clean.embedColor = color.startsWith('#') ? color : `#${color}`;
    } else {
      errors.push('embedColor must be valid hex color');
    }
  }

  // Prefix
  if (settings.prefix !== undefined) {
    const prefix = sanitizeString(settings.prefix, 5);
    if (isValidPrefix(prefix)) {
      clean.prefix = prefix;
    } else {
      errors.push('prefix must be 1-5 characters');
    }
  }

  // Slash commands enabled
  if (settings.slashCommandsEnabled !== undefined) {
    if (typeof settings.slashCommandsEnabled === 'boolean') {
      clean.slashCommandsEnabled = settings.slashCommandsEnabled;
    } else {
      errors.push('slashCommandsEnabled must be boolean');
    }
  }

  return { valid: errors.length === 0, errors, data: clean };
}

/**
 * Validate auto response object
 */
function validateAutoResponse(response) {
  const errors = [];
  const clean = {};

  // Trigger
  if (!response.trigger) {
    errors.push('trigger is required');
  } else {
    const trigger = sanitizeString(response.trigger, 100);
    if (trigger.length > 0) {
      clean.trigger = trigger;
    } else {
      errors.push('trigger cannot be empty');
    }
  }

  // Response text
  if (!response.response) {
    errors.push('response is required');
  } else {
    const responseText = sanitizeString(response.response, 2000);
    if (responseText.length > 0) {
      clean.response = responseText;
    } else {
      errors.push('response cannot be empty');
    }
  }

  // Enabled flag
  if (response.enabled !== undefined) {
    if (typeof response.enabled === 'boolean') {
      clean.enabled = response.enabled;
    } else {
      errors.push('enabled must be boolean');
    }
  } else {
    clean.enabled = true; // default
  }

  return { valid: errors.length === 0, errors, data: clean };
}

module.exports = {
  isValidDiscordId,
  isValidHexColor,
  isValidTimezone,
  isValidLanguage,
  isValidPrefix,
  sanitizeString,
  validateGuildSettings,
  validateAutoResponse
};

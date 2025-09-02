// REFACTORED: Central store that delegates to modular services
// This file maintains backward compatibility while using the new modular architecture

// Import the refactored store that handles all the complexity
const refactoredStore = require('./store/index');

// Re-export all the APIs for backward compatibility
module.exports = refactoredStore;

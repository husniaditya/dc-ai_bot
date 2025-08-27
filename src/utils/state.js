const conversationStore = new Map();
const askCache = new Map();
function getConversationStore(){ return conversationStore; }
function getAskCache(){ return askCache; }
module.exports = { getConversationStore, getAskCache };

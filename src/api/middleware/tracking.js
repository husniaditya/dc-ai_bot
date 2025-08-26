// API Response tracking middleware
function createTrackingMiddleware(store) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.json and res.send to track response
    const originalJson = res.json;
    const originalSend = res.send;
    
    const trackResponse = () => {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      store.trackApiResponse(responseTime, success);
    };
    
    res.json = function(data) {
      trackResponse();
      return originalJson.call(this, data);
    };
    
    res.send = function(data) {
      trackResponse();
      return originalSend.call(this, data);
    };
    
    next();
  };
}

module.exports = createTrackingMiddleware;

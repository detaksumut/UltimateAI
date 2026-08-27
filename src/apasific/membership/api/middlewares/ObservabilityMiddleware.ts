import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * ObservabilityMiddleware
 * Intercepts every API request to inject standard Enterprise tracking metadata.
 */
export const ObservabilityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const traceId = req.header('X-Trace-Id') || `trc_${uuidv4()}`;
  const correlationId = req.header('X-Correlation-Id') || `cor_${uuidv4()}`;
  const requestId = `req_${uuidv4()}`;

  // Inject into context (mocked via req object for demonstration)
  (req as any).traceContext = { traceId, correlationId, requestId };
  
  // Expose TraceID in response headers for client debugging
  res.setHeader('X-Trace-Id', traceId);

  const startTime = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1e3) + (diff[1] * 1e-6);
    
    // Structured Logging Pattern
    console.log(JSON.stringify({
      level: 'INFO',
      type: 'API_REQUEST',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      executionTimeMs: executionTimeMs.toFixed(2),
      traceId,
      correlationId,
      requestId
    }));
  });

  next();
};

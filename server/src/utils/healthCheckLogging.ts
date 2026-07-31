import { Request, Response } from 'express';

// Uptime monitors and the platform load balancer poll the health-check route
// constantly; a successful (< 400) response is pure noise. Failures (>= 400)
// still log so real outages (e.g. a 503 when the DB is unreachable) stay visible.
export const HEALTH_CHECK_PATHS = new Set(['/v1/healthCheck']);

// The health-check router is mounted with app.use(path, router), so Express
// strips the mount prefix while dispatching: by the time Morgan evaluates this
// predicate (on response finish) req.path is "/" and the prefix lives on
// req.baseUrl. Match req.baseUrl — matching req.path never fires for a mounted
// router, which silently defeats the whole suppression.
export const skipSuccessfulHealthCheck = (req: Request, res: Response): boolean =>
  HEALTH_CHECK_PATHS.has(req.baseUrl) && res.statusCode < 400;

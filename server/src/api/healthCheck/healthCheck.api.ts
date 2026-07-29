import { RequestHandler } from 'express';
import { version } from '../../../package.json';

const healthCheckEndpoint: RequestHandler = (_req, res) => {
  res.status(200).json({ healthy: true, version });
};

export default {
  healthCheckEndpoint,
};

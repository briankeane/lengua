import { Application } from 'express';
import authApi from './auth';
import healthCheckApi from './healthCheck';
import translateApi from './translate';
import userApi from './user';

function addRoutes(app: Application) {
  app.use('/v1/auth', authApi);
  app.use('/v1/healthCheck', healthCheckApi);
  app.use('/v1/translate', translateApi);
  app.use('/v1/users', userApi);
}

export default addRoutes;

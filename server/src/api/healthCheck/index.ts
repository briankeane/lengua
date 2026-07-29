import express from 'express';
import controller from './healthCheck.api';

const router = express.Router();

router.get('/', controller.healthCheckEndpoint);

// To use middleware, it would be something like
/*
router.post('/', authenticateAccessToken, checkBodyFor(['name', 'email']), controller.healthCheckEndpoint);
*/

export default router;

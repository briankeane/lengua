import express from 'express';
import { authenticateAccessToken, isOperatingOnSelf, requireRoleOfAtLeast } from '../security';
import { validateUUIDsInParams, checkBodyForAtLeastOneOf, oneOf } from '../validation';
import { handleGetMe, handleGetUser, handleUpdateUser } from './user.api';

const router = express.Router();

const UPDATABLE_FIELDS = ['firstName', 'lastName', 'displayName', 'profileImageUrl'];

router.get('/me', authenticateAccessToken, handleGetMe);

router.get(
  '/:userId',
  authenticateAccessToken,
  validateUUIDsInParams(['userId']),
  oneOf([isOperatingOnSelf('userId'), requireRoleOfAtLeast('admin')]),
  handleGetUser,
);

router.put(
  '/:userId',
  authenticateAccessToken,
  validateUUIDsInParams(['userId']),
  oneOf([isOperatingOnSelf('userId'), requireRoleOfAtLeast('admin')]),
  checkBodyForAtLeastOneOf(UPDATABLE_FIELDS),
  handleUpdateUser,
);

export default router;

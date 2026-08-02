import express from 'express';
import { authenticateAccessToken } from '../security';
import { checkBodyEnum, checkBodyFor, checkBodyForNoExtraFields } from '../validation';
import { TRANSLATION_DIRECTIONS } from '../../lib/translate';
import { handleTranslate } from './translate.api';

const router = express.Router();

router.post(
  '/',
  authenticateAccessToken,
  checkBodyFor(['text', 'direction']),
  checkBodyForNoExtraFields(['text', 'direction']),
  checkBodyEnum('direction', TRANSLATION_DIRECTIONS),
  handleTranslate,
);

export default router;

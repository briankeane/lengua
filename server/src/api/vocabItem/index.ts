import express from 'express';
import { authenticateAccessToken } from '../security';
import { checkBodyFor, checkBodyNonEmpty } from '../validation';
import { handleCreateVocabItem } from './vocabItem.api';

const router = express.Router();

const REQUIRED_FIELDS = ['targetLanguageCode', 'sourceText', 'targetText'];

router.post(
  '/',
  authenticateAccessToken,
  checkBodyFor(REQUIRED_FIELDS),
  checkBodyNonEmpty(REQUIRED_FIELDS),
  handleCreateVocabItem,
);

export default router;

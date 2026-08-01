import express from 'express';
import { authenticateAccessToken } from '../security';
import { checkBodyFor, checkBodyNonEmpty, checkBodyMaxLength } from '../validation';
import { handleCreateVocabItem } from './vocabItem.api';

const router = express.Router();

const REQUIRED_FIELDS = ['targetLanguageCode', 'sourceText', 'targetText'];

// Caps keep normalized text under Postgres' btree unique-index row-size limit and
// prevent unbounded language-code values from overflowing the varchar column.
const MAX_LENGTHS = {
  targetLanguageCode: 20,
  sourceText: 512,
  targetText: 512,
};

router.post(
  '/',
  authenticateAccessToken,
  checkBodyFor(REQUIRED_FIELDS),
  checkBodyNonEmpty(REQUIRED_FIELDS),
  checkBodyMaxLength(MAX_LENGTHS),
  handleCreateVocabItem,
);

export default router;

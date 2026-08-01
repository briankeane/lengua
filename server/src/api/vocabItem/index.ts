import express from 'express';
import { authenticateAccessToken } from '../security';
import {
  checkBodyFor,
  checkBodyNonEmpty,
  checkBodyMaxLength,
  checkQueryForNoExtraFields,
} from '../validation';
import { handleCreateVocabItem, handleListVocabItems } from './vocabItem.api';

const router = express.Router();

const REQUIRED_FIELDS = ['targetLanguageCode', 'sourceText', 'targetText'];

const ALLOWED_QUERY_PARAMS = ['targetLanguageCode', 'limit', 'cursor'];

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

router.get(
  '/',
  authenticateAccessToken,
  checkQueryForNoExtraFields(ALLOWED_QUERY_PARAMS),
  handleListVocabItems,
);

export default router;

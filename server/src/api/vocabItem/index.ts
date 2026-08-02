import express from 'express';
import { authenticateAccessToken } from '../security';
import {
  checkBodyFor,
  checkBodyNonEmpty,
  checkBodyMaxLength,
  checkBodyEnum,
  checkBodyForNoExtraFields,
  checkQueryForNoExtraFields,
  validateUUIDsInParams,
} from '../validation';
import { REVIEW_TRACKS, REVIEW_OUTCOMES } from '../../db/models/vocabItem.model';
import {
  handleCreateVocabItem,
  handleListVocabItems,
  handleDeleteVocabItem,
  handleReviewQueue,
  handleGradeReview,
} from './vocabItem.api';

const router = express.Router();

const REQUIRED_FIELDS = ['targetLanguageCode', 'sourceText', 'targetText'];

const ALLOWED_QUERY_PARAMS = ['targetLanguageCode', 'limit', 'cursor'];

const ALLOWED_REVIEW_QUERY_PARAMS = ['direction', 'limit', 'targetLanguageCode'];

const GRADE_FIELDS = ['direction', 'outcome'];

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

router.get(
  '/review',
  authenticateAccessToken,
  checkQueryForNoExtraFields(ALLOWED_REVIEW_QUERY_PARAMS),
  handleReviewQueue,
);

router.post(
  '/:vocabItemId/review',
  authenticateAccessToken,
  validateUUIDsInParams(['vocabItemId']),
  checkBodyForNoExtraFields(GRADE_FIELDS),
  checkBodyEnum('direction', REVIEW_TRACKS),
  checkBodyEnum('outcome', REVIEW_OUTCOMES),
  handleGradeReview,
);

router.delete(
  '/:vocabItemId',
  authenticateAccessToken,
  validateUUIDsInParams(['vocabItemId']),
  handleDeleteVocabItem,
);

export default router;

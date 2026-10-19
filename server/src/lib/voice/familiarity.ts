import { FamiliarityBucket } from './types';

// Familiarity is a 0-8 Leitner box (see MAX_FAMILIARITY in lib/vocabItem). The
// three prompt buckets split that range into thirds: brand-new/early words the
// tutor should introduce, words in active learning to quiz, and well-known words
// to challenge. Out-of-range values clamp to the nearest bucket.
export function bucketFor(familiarity: number): FamiliarityBucket {
  if (familiarity <= 2) return 'new';
  if (familiarity <= 5) return 'learning';
  return 'known';
}

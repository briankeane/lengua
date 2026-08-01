import { FamiliarityBucket } from './types';

export function bucketFor(familiarity: number): FamiliarityBucket {
  if (familiarity <= 1) return 'new';
  if (familiarity <= 3) return 'learning';
  return 'known';
}

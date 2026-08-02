import { literal, Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import VocabItem, { ReviewOutcome, ReviewTrack } from '../../db/models/vocabItem.model';
import { NotFoundError, ValidationError } from '../../utils/errors';

export interface SaveVocabItemInput {
  userId: string;
  targetLanguageCode: string;
  sourceText: string;
  targetText: string;
}

export interface SaveVocabItemResult {
  item: VocabItem;
  created: boolean;
}

export interface DeleteVocabItemInput {
  userId: string;
  vocabItemId: string;
}

export interface ListVocabItemsInput {
  userId: string;
  limit: number;
  targetLanguageCode?: string;
  cursor?: string;
}

export interface ListVocabItemsResult {
  items: VocabItem[];
  nextCursor: string | null;
}

// The per-track SRS state exposed to clients. Both tracks share this shape.
export interface SerializedTrack {
  familiarity: number;
  nextDueAt: Date | null;
  lastSeenAt: Date | null;
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  lastOutcome: string | null;
}

// The public shape returned to clients. Internal columns (userId,
// targetTextNormalized) are intentionally excluded from the API contract. SRS
// state is nested under two independent tracks.
export interface SerializedVocabItem {
  id: string;
  targetLanguageCode: string;
  sourceText: string;
  targetText: string;
  receptive: SerializedTrack;
  productive: SerializedTrack;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeTargetText(targetText: string): string {
  return targetText.trim().normalize('NFC').toLowerCase();
}

export async function saveVocabItem(input: SaveVocabItemInput): Promise<SaveVocabItemResult> {
  const targetLanguageCode = input.targetLanguageCode.trim().toLowerCase();
  const targetTextNormalized = normalizeTargetText(input.targetText);
  const where = { userId: input.userId, targetLanguageCode, targetTextNormalized };

  const existing = await VocabItem.findOne({ where });
  if (existing) {
    return { item: existing, created: false };
  }

  try {
    const item = await VocabItem.create({
      userId: input.userId,
      targetLanguageCode,
      sourceText: input.sourceText,
      targetText: input.targetText,
      targetTextNormalized,
    });
    return { item, created: true };
  } catch (err) {
    // A concurrent insert won the race between findOne and create. The unique
    // index is the source of truth, so re-fetch and return the existing row.
    if (err instanceof UniqueConstraintError) {
      const item = await VocabItem.findOne({ where });
      if (item) {
        return { item, created: false };
      }
    }
    throw err;
  }
}

// Deletes a single vocab item owned by the user. Scoping the destroy by userId
// (rather than fetching then checking) means another user's item is never
// removed and its existence is not revealed: a missing or non-owned id both
// surface as NotFoundError.
export async function deleteVocabItem(input: DeleteVocabItemInput): Promise<void> {
  const deletedCount = await VocabItem.destroy({
    where: { id: input.vocabItemId, userId: input.userId },
  });
  if (deletedCount === 0) {
    throw new NotFoundError('Vocab item not found');
  }
}

interface Cursor {
  createdAt: string;
  id: string;
}

const CURSOR_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(item: VocabItem): string {
  const payload: Cursor = { createdAt: item.createdAt.toISOString(), id: item.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

// Decodes a client-supplied cursor into values safe to hand to the query. Both
// fields are validated (id must be a UUID, createdAt a parseable date) and the
// timestamp is re-serialized to a canonical ISO string, so a hand-crafted cursor
// can never reach Postgres as a malformed literal (which would surface as a 500).
function decodeCursor(cursor: string): Cursor {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const { createdAt, id } = decoded ?? {};
    const createdAtMs = typeof createdAt === 'string' ? new Date(createdAt).getTime() : NaN;
    if (typeof id === 'string' && CURSOR_UUID_REGEX.test(id) && !Number.isNaN(createdAtMs)) {
      return { createdAt: new Date(createdAtMs).toISOString(), id };
    }
  } catch {
    // fall through to the ValidationError below
  }
  throw new ValidationError('Invalid Value: cursor is malformed');
}

// Lists a user's vocab items newest-first using keyset (cursor) pagination.
// Keyset avoids the skipped/duplicated rows that offset pagination produces when
// the client adds items between page loads. Ordering is (createdAt DESC, id DESC);
// id is a stable tiebreaker so rows sharing a createdAt still page cleanly.
//
// The cursor carries createdAt at millisecond precision. This is exact as long as
// every row is written through Sequelize (JS Date is millisecond-precision). If a
// backfill or manual insert ever writes sub-millisecond timestamps, two rows could
// share a cursor's millisecond and a page boundary could skip one — revisit the
// cursor encoding (e.g. carry full microsecond precision) if that path is added.
export async function listVocabItems(input: ListVocabItemsInput): Promise<ListVocabItemsResult> {
  const conditions: WhereOptions[] = [{ userId: input.userId }];

  if (input.targetLanguageCode) {
    conditions.push({ targetLanguageCode: input.targetLanguageCode.trim().toLowerCase() });
  }

  if (input.cursor) {
    const { createdAt, id } = decodeCursor(input.cursor);
    conditions.push({
      [Op.or]: [{ createdAt: { [Op.lt]: createdAt } }, { createdAt, id: { [Op.lt]: id } }],
    });
  }

  // Fetch one extra row to detect whether another page exists without a COUNT.
  const rows = await VocabItem.findAll({
    where: { [Op.and]: conditions },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: input.limit + 1,
  });

  const hasMore = rows.length > input.limit;
  const items = hasMore ? rows.slice(0, input.limit) : rows;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

  return { items, nextCursor };
}

function serializeTrack(item: VocabItem, track: ReviewTrack): SerializedTrack {
  if (track === 'receptive') {
    return {
      familiarity: item.receptiveFamiliarity,
      nextDueAt: item.receptiveNextDueAt,
      lastSeenAt: item.receptiveLastSeenAt,
      timesSeen: item.receptiveTimesSeen,
      timesCorrect: item.receptiveTimesCorrect,
      timesIncorrect: item.receptiveTimesIncorrect,
      lastOutcome: item.receptiveLastOutcome,
    };
  }
  return {
    familiarity: item.productiveFamiliarity,
    nextDueAt: item.productiveNextDueAt,
    lastSeenAt: item.productiveLastSeenAt,
    timesSeen: item.productiveTimesSeen,
    timesCorrect: item.productiveTimesCorrect,
    timesIncorrect: item.productiveTimesIncorrect,
    lastOutcome: item.productiveLastOutcome,
  };
}

export function serializeVocabItem(item: VocabItem): SerializedVocabItem {
  return {
    id: item.id,
    targetLanguageCode: item.targetLanguageCode,
    sourceText: item.sourceText,
    targetText: item.targetText,
    receptive: serializeTrack(item, 'receptive'),
    productive: serializeTrack(item, 'productive'),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// --- Spaced repetition ------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// A correct answer promotes the card by one Leitner box (capped); an incorrect
// answer resets it and reschedules it minutes out for a quick retry.
export const MAX_FAMILIARITY = 8;
export const INCORRECT_RETRY_MS = 10 * MINUTE_MS;

// Leitner box (== familiarity) -> interval until the next review, on a correct
// answer. Box 0 is only ever reached by an incorrect answer, which uses the
// fixed retry delay above rather than this table.
export const LEITNER_INTERVALS_MS: Record<number, number> = {
  1: 1 * DAY_MS,
  2: 3 * DAY_MS,
  3: 7 * DAY_MS,
  4: 14 * DAY_MS,
  5: 30 * DAY_MS,
  6: 90 * DAY_MS,
  7: 180 * DAY_MS,
  8: 365 * DAY_MS,
};

export interface ScheduleResult {
  familiarity: number;
  nextDueAt: Date;
}

// Pure Leitner scheduler for a single track. Given the track's current
// familiarity, an outcome, and the current time, returns the new familiarity and
// due date. Used identically for either track.
export function scheduleTrack(
  currentFamiliarity: number,
  outcome: ReviewOutcome,
  now: Date,
): ScheduleResult {
  if (outcome === 'incorrect') {
    return { familiarity: 0, nextDueAt: new Date(now.getTime() + INCORRECT_RETRY_MS) };
  }
  const familiarity = Math.min(currentFamiliarity + 1, MAX_FAMILIARITY);
  return { familiarity, nextDueAt: new Date(now.getTime() + LEITNER_INTERVALS_MS[familiarity]) };
}

export const REVIEW_DIRECTIONS = ['receptive', 'productive', 'any'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

export interface ReviewQueueInput {
  userId: string;
  direction: ReviewDirection;
  limit: number;
  targetLanguageCode?: string;
}

export interface ReviewCard {
  vocabItemId: string;
  direction: ReviewTrack;
  sourceText: string;
  targetText: string;
  targetLanguageCode: string;
  familiarity: number;
  nextDueAt: Date | null;
}

export interface ReviewQueueResult {
  reviewCards: ReviewCard[];
  dueCounts: { receptive: number; productive: number; total: number };
}

export interface GradeReviewInput {
  userId: string;
  vocabItemId: string;
  direction: ReviewTrack;
  outcome: ReviewOutcome;
}

// A track is due when it has never been scheduled (NULL) or its due date has
// passed. NULL therefore means "brand new, review immediately".
function trackDueWhere(track: ReviewTrack, now: Date): WhereOptions {
  const field = `${track}NextDueAt`;
  return { [Op.or]: [{ [field]: null }, { [field]: { [Op.lte]: now } }] };
}

function toReviewCard(item: VocabItem, track: ReviewTrack): ReviewCard {
  const isReceptive = track === 'receptive';
  return {
    vocabItemId: item.id,
    direction: track,
    sourceText: item.sourceText,
    targetText: item.targetText,
    targetLanguageCode: item.targetLanguageCode,
    familiarity: isReceptive ? item.receptiveFamiliarity : item.productiveFamiliarity,
    nextDueAt: isReceptive ? item.receptiveNextDueAt : item.productiveNextDueAt,
  };
}

// Most-overdue-first: NULLs (brand new) first, then by due date ascending, then
// id ascending. When one card is due in both tracks (direction=any), receptive
// is emitted before productive so the order is deterministic.
function compareReviewCards(a: ReviewCard, b: ReviewCard): number {
  const at = a.nextDueAt ? a.nextDueAt.getTime() : null;
  const bt = b.nextDueAt ? b.nextDueAt.getTime() : null;
  if (at === null && bt !== null) return -1;
  if (at !== null && bt === null) return 1;
  if (at !== null && bt !== null && at !== bt) return at - bt;
  if (a.vocabItemId !== b.vocabItemId) return a.vocabItemId < b.vocabItemId ? -1 : 1;
  if (a.direction === b.direction) return 0;
  return a.direction === 'receptive' ? -1 : 1;
}

async function fetchTrackCards(
  track: ReviewTrack,
  base: WhereOptions,
  now: Date,
  limit: number,
): Promise<ReviewCard[]> {
  const dueField = `${track}NextDueAt`;
  const rows = await VocabItem.findAll({
    where: { [Op.and]: [base, trackDueWhere(track, now)] },
    order: [
      // Emulate NULLS FIRST portably: `IS NOT NULL` sorts false (0) before true.
      [literal(`"${dueField}" IS NOT NULL`), 'ASC'],
      [dueField, 'ASC'],
      ['id', 'ASC'],
    ],
    limit,
  });
  return rows.map((row) => toReviewCard(row, track));
}

// Returns the due (card, track) entries plus per-track due totals. dueCounts are
// computed independently of `limit` and `direction`; total is the number of
// distinct cards due in at least one track. reviewCards is ordered most-overdue
// first and capped at `limit`.
export async function getReviewQueue(input: ReviewQueueInput): Promise<ReviewQueueResult> {
  const now = new Date();
  const base: WhereOptions = { userId: input.userId };
  if (input.targetLanguageCode) {
    (base as Record<string, unknown>).targetLanguageCode = input.targetLanguageCode
      .trim()
      .toLowerCase();
  }

  const [receptive, productive, total] = await Promise.all([
    VocabItem.count({ where: { [Op.and]: [base, trackDueWhere('receptive', now)] } }),
    VocabItem.count({ where: { [Op.and]: [base, trackDueWhere('productive', now)] } }),
    VocabItem.count({
      where: {
        [Op.and]: [
          base,
          { [Op.or]: [trackDueWhere('receptive', now), trackDueWhere('productive', now)] },
        ],
      },
    }),
  ]);

  const tracks: ReviewTrack[] =
    input.direction === 'any' ? ['receptive', 'productive'] : [input.direction];

  // Each track query is already limited and ordered; the global top-`limit`
  // entries are a subset of each track's top-`limit`, so merging then slicing is
  // correct.
  const perTrack = await Promise.all(
    tracks.map((track) => fetchTrackCards(track, base, now, input.limit)),
  );
  const reviewCards = perTrack.flat().sort(compareReviewCards).slice(0, input.limit);

  return { reviewCards, dueCounts: { receptive, productive, total } };
}

// Grades a single track of one owned card. Missing or non-owned ids surface as
// NotFoundError (matching deleteVocabItem). Only the named track's stats and
// schedule are touched; the other track is left untouched.
export async function gradeReview(input: GradeReviewInput): Promise<VocabItem> {
  const item = await VocabItem.findOne({
    where: { id: input.vocabItemId, userId: input.userId },
  });
  if (!item) {
    throw new NotFoundError('Vocab item not found');
  }

  const now = new Date();
  const current =
    input.direction === 'receptive'
      ? {
          familiarity: item.receptiveFamiliarity,
          timesSeen: item.receptiveTimesSeen,
          timesCorrect: item.receptiveTimesCorrect,
          timesIncorrect: item.receptiveTimesIncorrect,
        }
      : {
          familiarity: item.productiveFamiliarity,
          timesSeen: item.productiveTimesSeen,
          timesCorrect: item.productiveTimesCorrect,
          timesIncorrect: item.productiveTimesIncorrect,
        };

  const { familiarity, nextDueAt } = scheduleTrack(current.familiarity, input.outcome, now);
  const timesSeen = current.timesSeen + 1;
  const timesCorrect = current.timesCorrect + (input.outcome === 'correct' ? 1 : 0);
  const timesIncorrect = current.timesIncorrect + (input.outcome === 'incorrect' ? 1 : 0);

  if (input.direction === 'receptive') {
    await item.update({
      receptiveFamiliarity: familiarity,
      receptiveNextDueAt: nextDueAt,
      receptiveLastSeenAt: now,
      receptiveLastOutcome: input.outcome,
      receptiveTimesSeen: timesSeen,
      receptiveTimesCorrect: timesCorrect,
      receptiveTimesIncorrect: timesIncorrect,
    });
  } else {
    await item.update({
      productiveFamiliarity: familiarity,
      productiveNextDueAt: nextDueAt,
      productiveLastSeenAt: now,
      productiveLastOutcome: input.outcome,
      productiveTimesSeen: timesSeen,
      productiveTimesCorrect: timesCorrect,
      productiveTimesIncorrect: timesIncorrect,
    });
  }

  return item;
}

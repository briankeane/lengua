import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import VocabItem from '../../db/models/vocabItem.model';
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

// The public shape returned to clients. Internal columns (userId,
// targetTextNormalized) are intentionally excluded from the API contract.
export interface SerializedVocabItem {
  id: string;
  targetLanguageCode: string;
  sourceText: string;
  targetText: string;
  familiarity: number;
  lastSeenAt: Date | null;
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  lastOutcome: string | null;
  nextDueAt: Date | null;
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

export function serializeVocabItem(item: VocabItem): SerializedVocabItem {
  return {
    id: item.id,
    targetLanguageCode: item.targetLanguageCode,
    sourceText: item.sourceText,
    targetText: item.targetText,
    familiarity: item.familiarity,
    lastSeenAt: item.lastSeenAt,
    timesSeen: item.timesSeen,
    timesCorrect: item.timesCorrect,
    timesIncorrect: item.timesIncorrect,
    lastOutcome: item.lastOutcome,
    nextDueAt: item.nextDueAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

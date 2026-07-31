import { expect } from 'chai';
import ConversationSession from './conversationSession.model';
import { createUser } from '../../../test/testDataGenerator';

describe('ConversationSession model', () => {
  it('creates a session with sensible defaults', async () => {
    const user = await createUser();
    const session = await ConversationSession.create({
      userId: user.id,
      provider: 'elevenlabs',
      mode: 'quiz',
      targetLanguageCode: 'es',
    });

    expect(session.id).to.be.a('string');
    expect(session.status).to.equal('active');
    expect(session.evaluationStatus).to.equal('not_started');
    expect(session.evaluationAttemptCount).to.equal(0);
  });

  it('persists JSONB fields round-trip', async () => {
    const user = await createUser();
    const vocab = [
      { id: 'w1', term: 'perro', translation: 'dog', familiarity: 2, bucket: 'learning' },
    ];
    const session = await ConversationSession.create({
      userId: user.id,
      provider: 'elevenlabs',
      mode: 'weave',
      targetLanguageCode: 'es',
      vocabSnapshot: vocab,
    });

    const reloaded = await ConversationSession.findByPk(session.id);
    expect(reloaded?.vocabSnapshot).to.deep.equal(vocab);
  });
});

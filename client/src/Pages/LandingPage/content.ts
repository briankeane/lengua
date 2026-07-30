export const LANDING = {
  brand: 'Lengua',
  nav: {
    signIn: 'Sign in',
    cta: 'Get started',
  },
  hero: {
    title: 'The translator that helps you learn.',
    sub: 'The translator you already reach for — except Lengua remembers every word you look up and quizzes you out loud until it’s yours. The words you need are the ones you’re already searching for.',
    primaryCta: 'Get started — free',
    secondaryCta: 'See how it works',
    micro: 'No password. No email. Just Google.',
  },
  reframe:
    'Every translator forgets the moment you close it. Tomorrow you look up the same word again. Lengua helps you learn what you look up.',
  how: {
    heading: 'Look it up. Keep it. Say it back.',
    steps: [
      {
        title: 'Look it up',
        body: "Hit a word you don't know — in a conversation, a show, a street sign. Look it up and get the translation and pronunciation instantly.",
      },
      {
        title: 'Keep it',
        body: "Save it to your deck in one tap. Lengua schedules it to come back right before you'd forget it.",
      },
      {
        title: 'Say it back',
        body: 'Practice out loud. Lengua listens and quizzes you until the word is yours — not just recognized, but spoken.',
      },
    ],
  },
  features: [
    {
      art: 'deck',
      title: 'The words you look up are the words you need',
      body: 'Your deck is built from the words you actually looked up — never a generic list. Every card is something you already needed once and will need again.',
    },
    {
      art: 'schedule',
      title: 'A translator that actually remembers',
      body: "Spaced repetition tracks what's sticking and what's slipping, surfacing each word at the exact moment it's about to fade. It scales from your first hundred words to your ten-thousandth.",
    },
    {
      art: 'voice',
      title: 'And it quizzes you back — out loud',
      body: "Reading a word isn't knowing it. Voice practice makes you produce the word from memory — so it's ready when you're mid-sentence and reaching for it.",
    },
  ],
  languages: {
    heading: 'Learning Spanish? Start today.',
    sub: 'More languages on the way.',
  },
  finalCta: {
    heading: 'Meet the translator that teaches you.',
    sub: 'The words you need are the ones you keep looking up. Start keeping them.',
    cta: 'Get started — free',
  },
  footer: {
    tagline: 'No password. No email.',
    copyright: '© 2026 Lengua',
  },
} as const;

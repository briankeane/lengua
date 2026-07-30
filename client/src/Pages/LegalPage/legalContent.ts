export type LegalKind = 'privacy' | 'terms';

export type LegalDoc = {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

export const EFFECTIVE_DATE = 'July 30, 2026';
const CONTACT = 'hello@lengua-app.com';

export const LEGAL: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'Lengua helps you learn a language from the words you look up. This policy explains what we collect, why, and the choices you have. We keep it short because we keep the data small.',
    sections: [
      {
        heading: 'Who we are',
        body: [
          `Lengua is operated by the Lengua team. If you have any questions about this policy or your data, contact us at ${CONTACT}.`,
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Account information. You sign in with Google, and we receive your name, email address, and profile image from your Google account. We never see or store a password, and we do not ask for one.',
          'Learning data. We store the words and phrases you look up, the decks you build, and your review history and results so we can schedule what to practice next.',
          'Voice practice. When you use voice practice, your device microphone captures audio so we can check your pronunciation. We process this audio to score the attempt and do not use it to identify you.',
          'Basic usage data. We collect standard technical information such as device type, browser, and app interactions to keep the service working and improve it.',
        ],
      },
      {
        heading: 'How we use your data',
        body: [
          'We use your data to run the core product: signing you in, building your personal deck, scheduling reviews with spaced repetition, and running voice practice. We use aggregate usage data to fix problems and improve the app. We do not sell your personal data.',
        ],
      },
      {
        heading: 'Who we share it with',
        body: [
          'We share data only with service providers that help us run Lengua (for example, authentication through Google and our hosting provider), and only as needed to operate the service. We may disclose data if required by law.',
        ],
      },
      {
        heading: 'Data retention and your choices',
        body: [
          `We keep your account and learning data while your account is active. You can ask us to delete your account and associated data at any time by emailing ${CONTACT}. Depending on where you live, you may have rights to access, correct, or delete your personal data.`,
        ],
      },
      {
        heading: 'Changes to this policy',
        body: [
          'We may update this policy as the product evolves. When we make material changes, we will update the effective date above and, where appropriate, notify you in the app.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro:
      'These terms are the agreement between you and Lengua when you use the app. By signing in, you agree to them.',
    sections: [
      {
        heading: 'Your account',
        body: [
          'You sign in with Google. You are responsible for keeping access to your Google account secure, and for the activity that happens under your Lengua account. You must be old enough to form a binding contract in your country to use Lengua.',
        ],
      },
      {
        heading: 'Using Lengua',
        body: [
          'We grant you a personal, non-transferable right to use Lengua for learning. Do not misuse the service: no reverse engineering, no attempts to disrupt or overload it, no scraping, and no use that breaks the law or infringes others’ rights.',
        ],
      },
      {
        heading: 'Your content',
        body: [
          'The words, decks, and notes you create are yours. You grant Lengua the permission needed to store and process that content so we can provide the service to you, such as scheduling reviews and running voice practice.',
        ],
      },
      {
        heading: 'Service changes and availability',
        body: [
          'We are actively building Lengua, so features may change, and the service may occasionally be unavailable. We may add, change, or remove features over time.',
        ],
      },
      {
        heading: 'Disclaimers and liability',
        body: [
          'Lengua is provided “as is,” without warranties of any kind. To the extent permitted by law, Lengua is not liable for indirect or incidental damages arising from your use of the service. Lengua is a learning aid and does not guarantee any particular result.',
        ],
      },
      {
        heading: 'Contact',
        body: [`Questions about these terms? Email us at ${CONTACT}.`],
      },
    ],
  },
};

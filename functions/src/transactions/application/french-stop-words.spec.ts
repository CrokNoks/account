import { FRENCH_STOP_WORDS } from './french-stop-words';

describe('FRENCH_STOP_WORDS', () => {
  it('is not empty and contains common French words', () => {
    expect(FRENCH_STOP_WORDS.length).toBeGreaterThan(0);
    for (const word of ['à', 'été', 'où', 'le', 'de']) {
      expect(FRENCH_STOP_WORDS).toContain(word);
    }
  });

  it('matches the list of the installed natural library', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { words } = require('natural/lib/natural/util/stopwords_fr') as {
      words: string[];
    };
    expect([...FRENCH_STOP_WORDS]).toEqual(words);
  });
});

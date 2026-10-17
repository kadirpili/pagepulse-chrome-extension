import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  countCharacters,
  countParagraphs,
  calculateReadingTime,
  calculateSpeakingTime,
  extractTextSummary,
  analyzeText,
  DEFAULT_READING_WPM,
  DEFAULT_SPEAKING_WPM
} from '../src/stats.js';

test('countWords', async (t) => {
  await t.test('returns 0 for empty, null, or non-string input', () => {
    assert.equal(countWords(''), 0);
    assert.equal(countWords('   '), 0);
    assert.equal(countWords(null), 0);
    assert.equal(countWords(undefined), 0);
    assert.equal(countWords(123), 0);
  });

  await t.test('counts standard words separated by single spaces', () => {
    assert.equal(countWords('The quick brown fox jumps over the lazy dog'), 9);
  });

  await t.test('handles multiple consecutive spaces, newlines, and tabs', () => {
    const text = 'Hello \t\t world \n\n this   is \r\n a test.';
    assert.equal(countWords(text), 6);
  });

  await t.test('handles hyphenated words and contractions correctly', () => {
    assert.equal(countWords("Don't count this as two words, it's one."), 8);
    assert.equal(countWords('State-of-the-art technology is mind-blowing.'), 4);
  });

  await t.test('ignores standalone punctuation and symbols', () => {
    assert.equal(countWords('--- ... ??? !@#$%^&*()'), 0);
    assert.equal(countWords('Hello, world! -- How are you?'), 5);
  });

  await t.test('supports multilingual unicode characters and CJK word segmentation', () => {
    assert.equal(countWords('Café crème déjà vu'), 4);
    assert.equal(countWords('Привет мир'), 2);
    // CJK without whitespace should segment into meaningful word units
    assert.equal(countWords('你好世界'), 2); // '你好' + '世界'
    assert.equal(countWords('こんにちは世界！これはテストです。'), 6);
  });
});

test('countCharacters', async (t) => {
  await t.test('returns 0 for non-string input', () => {
    assert.equal(countCharacters(null), 0);
    assert.equal(countCharacters(undefined), 0);
  });

  await t.test('counts total characters including spaces by default', () => {
    assert.equal(countCharacters('Hello World'), 11);
    assert.equal(countCharacters(''), 0);
  });

  await t.test('counts characters excluding spaces when requested', () => {
    assert.equal(countCharacters('Hello World', { includeSpaces: false }), 10);
    assert.equal(countCharacters('  a  b  c  ', { includeSpaces: false }), 3);
  });

  await t.test('correctly handles unicode multi-byte characters and emojis', () => {
    // Emojis often occupy surrogate pairs in UTF-16, Array.from counts code points
    assert.equal(countCharacters('⏱️ Rocket 🚀'), 10);
  });
});

test('countParagraphs', async (t) => {
  await t.test('returns 0 for empty or whitespace text', () => {
    assert.equal(countParagraphs(''), 0);
    assert.equal(countParagraphs('   \n\n   '), 0);
  });

  await t.test('counts single paragraph', () => {
    assert.equal(countParagraphs('A single paragraph without line breaks.'), 1);
  });

  await t.test('counts multiple paragraphs separated by blank lines', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\n\nThird paragraph.';
    assert.equal(countParagraphs(text), 3);
  });
});

test('calculateReadingTime', async (t) => {
  await t.test('handles zero and edge cases safely', () => {
    const zero = calculateReadingTime(0);
    assert.equal(zero.minutes, 0);
    assert.equal(zero.seconds, 0);
    assert.equal(zero.totalSeconds, 0);
    assert.equal(zero.text, '0s');

    const negative = calculateReadingTime(-50);
    assert.equal(negative.totalSeconds, 0);

    const safeWpm = calculateReadingTime(100, 0);
    assert.equal(safeWpm.totalSeconds, 30); // Falls back to default WPM
  });

  await t.test('returns "< 1 min" for short reads under 30 seconds', () => {
    const result = calculateReadingTime(50, 200); // 15 seconds
    assert.equal(result.totalSeconds, 15);
    assert.equal(result.text, '< 1 min');
  });

  await t.test('formats exact minutes cleanly', () => {
    const result = calculateReadingTime(400, 200); // 2 minutes exactly
    assert.equal(result.minutes, 2);
    assert.equal(result.seconds, 0);
    assert.equal(result.text, '2 min');
  });

  await t.test('formats mixed minutes and seconds cleanly', () => {
    const result = calculateReadingTime(250, 200); // 75 seconds = 1m 15s
    assert.equal(result.minutes, 1);
    assert.equal(result.seconds, 15);
    assert.equal(result.text, '1m 15s');
  });
});

test('calculateSpeakingTime', async (t) => {
  await t.test('uses default speaking rate of 130 wpm', () => {
    const result = calculateSpeakingTime(130);
    assert.equal(result.minutes, 1);
    assert.equal(result.seconds, 0);
    assert.equal(result.text, '1 min');
  });
});

test('extractTextSummary', async (t) => {
  await t.test('returns empty string for invalid inputs', () => {
    assert.equal(extractTextSummary(null), '');
    assert.equal(extractTextSummary(''), '');
  });

  await t.test('leaves text under maxLength untouched', () => {
    const short = 'A brief sentence.';
    assert.equal(extractTextSummary(short, 50), short);
  });

  await t.test('truncates longer text and appends ellipsis', () => {
    const long = 'This is a longer paragraph that will exceed the given threshold.';
    const result = extractTextSummary(long, 20);
    assert.ok(result.endsWith('...'));
    assert.ok(result.length <= 23);
  });
});

test('analyzeText integration', async (t) => {
  await t.test('aggregates all metrics correctly', () => {
    const sample = 'Hello world.\n\nThis is a complete test of the PagePulse stats module.';
    const result = analyzeText(sample, { readingWpm: 200, speakingWpm: 130 });

    assert.equal(result.words, 12);
    assert.equal(result.paragraphs, 2);
    assert.ok(result.characters > 0);
    assert.ok(result.charactersNoSpaces > 0);
    assert.ok(result.readingTime);
    assert.ok(result.speakingTime);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateClaim,
  generateDeterministicClaims,
  getClaimsForVideo,
  VALID_VERDICTS
} from '../src/claim-service.js';

test('claim-service: validateClaim', async (t) => {
  await t.test('validates and returns a fully conforming claim record', () => {
    const raw = {
      timestamp: 42.5,
      sentence: 'The Great Wall of China is visible from the Moon with the naked eye.',
      verdict: 'misinformation',
      explanation: 'Apollo astronauts confirmed the Great Wall cannot be resolved from lunar orbit without optics.',
      sources: ['https://www.nasa.gov/vision/universe/watchtheskies/great_wall.html'],
      duration: 5.0
    };

    const validated = validateClaim(raw);
    assert.equal(validated.timestamp, 42.5);
    assert.equal(validated.sentence, raw.sentence);
    assert.equal(validated.verdict, 'misinformation');
    assert.equal(validated.explanation, raw.explanation);
    assert.deepEqual(validated.sources, raw.sources);
    assert.equal(validated.duration, 5.0);
  });

  await t.test('populates default duration when duration property is omitted', () => {
    const raw = {
      timestamp: 10.0,
      sentence: 'Water boils at 100 degrees Celsius at sea level.',
      verdict: 'verified',
      explanation: 'Standard thermodynamic boiling point under 1 atmosphere of pressure.',
      sources: ['https://en.wikipedia.org/wiki/Water']
    };

    const validated = validateClaim(raw);
    assert.ok(typeof validated.duration === 'number' && validated.duration > 0, 'Duration should default to positive number');
  });

  await t.test('rejects non-object inputs with descriptive Error', () => {
    assert.throws(() => validateClaim(null), /object/i);
    assert.throws(() => validateClaim(undefined), /object/i);
    assert.throws(() => validateClaim('not an object'), /object/i);
    assert.throws(() => validateClaim(123), /object/i);
  });

  await t.test('rejects missing or invalid timestamp', () => {
    const base = {
      sentence: 'Sample sentence',
      verdict: 'verified',
      explanation: 'Sample explanation',
      sources: ['https://example.com']
    };

    assert.throws(() => validateClaim({ ...base, timestamp: -5 }), /timestamp/i);
    assert.throws(() => validateClaim({ ...base, timestamp: NaN }), /timestamp/i);
    assert.throws(() => validateClaim({ ...base, timestamp: Infinity }), /timestamp/i);
    assert.throws(() => validateClaim({ ...base, timestamp: '10' }), /timestamp/i);
    assert.throws(() => validateClaim(base), /timestamp/i);
  });

  await t.test('rejects empty or non-string sentence', () => {
    const base = {
      timestamp: 15.0,
      verdict: 'verified',
      explanation: 'Sample explanation',
      sources: ['https://example.com']
    };

    assert.throws(() => validateClaim({ ...base, sentence: '' }), /sentence/i);
    assert.throws(() => validateClaim({ ...base, sentence: '   ' }), /sentence/i);
    assert.throws(() => validateClaim({ ...base, sentence: 123 }), /sentence/i);
    assert.throws(() => validateClaim(base), /sentence/i);
  });

  await t.test('rejects invalid or unauthorized verdict strings', () => {
    const base = {
      timestamp: 15.0,
      sentence: 'Sample sentence',
      explanation: 'Sample explanation',
      sources: ['https://example.com']
    };

    assert.throws(() => validateClaim({ ...base, verdict: 'fake_news' }), /verdict/i);
    assert.throws(() => validateClaim({ ...base, verdict: 'true' }), /verdict/i);
    assert.throws(() => validateClaim({ ...base, verdict: '' }), /verdict/i);
  });

  await t.test('rejects non-array or invalid sources', () => {
    const base = {
      timestamp: 15.0,
      sentence: 'Sample sentence',
      verdict: 'unknown',
      explanation: 'Sample explanation'
    };

    assert.throws(() => validateClaim({ ...base, sources: 'https://example.com' }), /sources/i);
    assert.throws(() => validateClaim({ ...base, sources: null }), /sources/i);
  });
});

test('claim-service: Seeded Claims Repository', async (t) => {
  await t.test('returns rich pre-configured claims for known test video dQw4w9WgXcQ', async () => {
    const claims = await getClaimsForVideo('dQw4w9WgXcQ');
    assert.ok(Array.isArray(claims), 'Must return an array');
    assert.ok(claims.length >= 3, 'Must contain at least 3 claims');

    // Assert chronological ordering
    for (let i = 0; i < claims.length - 1; i++) {
      assert.ok(claims[i].timestamp <= claims[i + 1].timestamp, 'Claims must be sorted chronologically');
    }

    // Assert verdict diversity
    const verdicts = claims.map((c) => c.verdict);
    assert.ok(verdicts.includes('misinformation'), 'Seeded set should contain a misinformation claim');
    assert.ok(verdicts.includes('verified'), 'Seeded set should contain a verified claim');

    // Assert every claim passes schema validation
    claims.forEach((claim) => {
      assert.doesNotThrow(() => validateClaim(claim));
    });
  });
});

test('claim-service: Deterministic Fallback Generator', async (t) => {
  const arbitraryId = 'arbitrary-seed-xyz-987';

  await t.test('100-call determinism check: identical video ID produces 100% deep-equal claims', () => {
    const baseline = generateDeterministicClaims(arbitraryId);
    assert.ok(Array.isArray(baseline));
    assert.ok(baseline.length >= 3 && baseline.length <= 6);

    for (let i = 0; i < 100; i++) {
      const run = generateDeterministicClaims(arbitraryId);
      assert.deepEqual(run, baseline, `Run ${i + 1} did not match baseline`);
    }
  });

  await t.test('diversity check: distinct video IDs generate distinct claim sets', () => {
    const setA = generateDeterministicClaims('videoIdAlpha123');
    const setB = generateDeterministicClaims('videoIdBeta45678');
    const setC = generateDeterministicClaims('videoIdGamma9999');

    assert.notDeepEqual(setA, setB);
    assert.notDeepEqual(setB, setC);
    assert.notDeepEqual(setA, setC);
  });

  await t.test('generated claims conform strictly to schema and chronological sorting', () => {
    const testIds = ['video-one', 'video-two', 'complex-id_123-abc'];
    for (const id of testIds) {
      const claims = generateDeterministicClaims(id);
      assert.ok(claims.length >= 3);
      for (let i = 0; i < claims.length; i++) {
        validateClaim(claims[i]);
        if (i > 0) {
          assert.ok(claims[i].timestamp >= claims[i - 1].timestamp);
        }
      }
    }
  });

  await t.test('handles arbitrary video ID via getClaimsForVideo fallback', async () => {
    const claims = await getClaimsForVideo('randomUncataloguedId1');
    assert.ok(Array.isArray(claims));
    assert.ok(claims.length >= 3);
  });

  await t.test('handles empty or null video ID gracefully without throwing unhandled rejection', async () => {
    const emptyResult = await getClaimsForVideo('');
    assert.ok(Array.isArray(emptyResult));

    const nullResult = await getClaimsForVideo(null);
    assert.ok(Array.isArray(nullResult));
  });
});

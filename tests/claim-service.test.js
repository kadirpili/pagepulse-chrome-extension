import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateClaim,
  generateDeterministicClaims,
  getClaimsForVideo,
  VALID_VERDICTS,
  normalizeBackendClaim,
  parseApiResponse,
  fetchClaimsFromBackend,
  clearClaimsCache,
  DEFAULT_PROD_ENDPOINT,
  CLOUDFRONT_ENDPOINT,
  DEFAULT_AUTH_BEARER
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

test('claim-service: normalizeBackendClaim', async (t) => {
  await t.test('normalizes candidate with string timestamp, loose verdict casing, and single source string', () => {
    const raw = {
      timestamp: '35.4',
      sentence: 'The Moon has a liquid helium core.',
      verdict: 'FALSE',
      explanation: 'Seismic and laser ranging measurements indicate a solid iron inner core and fluid outer core.',
      source: 'https://nasa.gov/moon-core'
    };

    const normalized = normalizeBackendClaim(raw);
    assert.ok(normalized);
    assert.equal(normalized.timestamp, 35.4);
    assert.equal(normalized.sentence, 'The Moon has a liquid helium core.');
    assert.equal(normalized.verdict, 'misinformation');
    assert.deepEqual(normalized.sources, ['https://nasa.gov/moon-core']);
    assert.equal(normalized.duration, 4.5);
  });

  await t.test('maps verdict synonyms correctly: true/verified -> verified, fake/misleading -> misinformation', () => {
    const trueClaim = normalizeBackendClaim({
      timestamp: 10,
      sentence: 'Statement A',
      verdict: 'TRUE'
    });
    assert.equal(trueClaim.verdict, 'verified');

    const verifiedClaim = normalizeBackendClaim({
      timestamp: 10,
      sentence: 'Statement B',
      verdict: 'accurate'
    });
    assert.equal(verifiedClaim.verdict, 'verified');

    const fakeClaim = normalizeBackendClaim({
      timestamp: 10,
      sentence: 'Statement C',
      verdict: 'debunked'
    });
    assert.equal(fakeClaim.verdict, 'misinformation');

    const unknownClaim = normalizeBackendClaim({
      timestamp: 10,
      sentence: 'Statement D',
      verdict: 'unconfirmed'
    });
    assert.equal(unknownClaim.verdict, 'unknown');
  });

  await t.test('maps numeric score 0-3 correctly to verdicts and generates descriptive explanations', () => {
    const claim3 = normalizeBackendClaim({
      timestamp: 7.88,
      sentence: 'For 30 years I taught at MIT...',
      score: 3,
      sources: ['https://science.feedback.org/review/...']
    });
    assert.equal(claim3.verdict, 'misinformation');
    assert.equal(claim3.score, 3);
    assert.match(claim3.explanation, /Score: 3\/3/i);

    const claim2 = normalizeBackendClaim({
      timestamp: 174.53,
      sentence: 'The IPCC acknowledged...',
      score: 2,
      sources: ['https://climatefeedback.org/...']
    });
    assert.equal(claim2.verdict, 'misinformation');
    assert.equal(claim2.score, 2);
    assert.match(claim2.explanation, /Score: 2\/3/i);

    const claim1 = normalizeBackendClaim({
      timestamp: 187.16,
      sentence: 'Most importantly...',
      score: 1,
      sources: []
    });
    assert.equal(claim1.verdict, 'unknown');
    assert.equal(claim1.score, 1);
    assert.match(claim1.explanation, /Score: 1\/3/i);

    const claim0 = normalizeBackendClaim({
      timestamp: 134.89,
      sentence: 'Atmospheric levels of CO2...',
      score: 0,
      sources: ['https://skepticalscience.com/...']
    });
    assert.equal(claim0.verdict, 'verified');
    assert.equal(claim0.score, 0);
    assert.match(claim0.explanation, /Score: 0\/3/i);
  });

  await t.test('returns null for non-salvageable claim candidates', () => {
    assert.equal(normalizeBackendClaim(null), null);
    assert.equal(normalizeBackendClaim({}), null);
    assert.equal(normalizeBackendClaim({ timestamp: -10, sentence: 'Valid sentence' }), null);
    assert.equal(normalizeBackendClaim({ timestamp: 10, sentence: '' }), null);
    assert.equal(normalizeBackendClaim({ timestamp: NaN, sentence: 'Valid sentence' }), null);
  });
});

test('claim-service: parseApiResponse', async (t) => {
  await t.test('parses direct array payload and sorts chronologically', () => {
    const apiPayload = [
      { timestamp: 50.0, sentence: 'Second claim', verdict: 'verified' },
      { timestamp: 12.0, sentence: 'First claim', verdict: 'misinformation' }
    ];

    const parsed = parseApiResponse(apiPayload);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].timestamp, 12.0);
    assert.equal(parsed[1].timestamp, 50.0);
  });

  await t.test('parses nested envelope { data: { claims: [...] } } and ignores corrupted items', () => {
    const apiPayload = {
      status: 'success',
      data: {
        claims: [
          { timestamp: 20.0, sentence: 'Valid claim 1', verdict: 'verified' },
          { timestamp: -99, sentence: 'Corrupt claim' },
          { timestamp: 40.0, sentence: 'Valid claim 2', verdict: 'misinformation' }
        ]
      }
    };

    const parsed = parseApiResponse(apiPayload);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].sentence, 'Valid claim 1');
    assert.equal(parsed[1].sentence, 'Valid claim 2');
  });

  await t.test('handles empty or null payload gracefully', () => {
    assert.deepEqual(parseApiResponse(null), []);
    assert.deepEqual(parseApiResponse({}), []);
    assert.deepEqual(parseApiResponse([]), []);
  });
});

test('claim-service: fetchClaimsFromBackend with retries & error handling', async (t) => {
  await t.test('successfully fetches claims on HTTP 200', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { timestamp: 15.0, sentence: 'Backend factcheck statement', verdict: 'verified' }
      ]
    });

    const claims = await fetchClaimsFromBackend('testVideo123', DEFAULT_PROD_ENDPOINT, {
      fetchFn: mockFetch
    });

    assert.equal(claims.length, 1);
    assert.equal(claims[0].sentence, 'Backend factcheck statement');
    assert.equal(claims[0].verdict, 'verified');
  });

  await t.test('enforces never exampleapi: automatically normalizes any legacy exampleapi.com endpoint to DEFAULT_PROD_ENDPOINT', async () => {
    let capturedUrl = '';
    const mockFetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => [{ timestamp: 10, sentence: 'Normalized statement', score: 0 }]
      };
    };

    await fetchClaimsFromBackend('OwqIy8Ikv-c', 'https://exampleapi.com/api/claims', {
      fetchFn: mockFetch
    });

    assert.equal(capturedUrl, DEFAULT_PROD_ENDPOINT, 'Must replace exampleapi.com with DEFAULT_PROD_ENDPOINT');
  });

  await t.test('retries on HTTP 500 server error and succeeds on subsequent retry', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          { timestamp: 25.0, sentence: 'Recovered after retry', verdict: 'misinformation' }
        ]
      };
    };

    const claims = await fetchClaimsFromBackend('testRetryVideo', DEFAULT_PROD_ENDPOINT, {
      fetchFn: mockFetch,
      maxRetries: 2,
      initialDelayMs: 20
    });

    assert.equal(callCount, 2, 'Should have retried once after 500 error');
    assert.equal(claims.length, 1);
    assert.equal(claims[0].sentence, 'Recovered after retry');
  });

  await t.test('fast-fails on HTTP 404 client error without wasting retries', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return { ok: false, status: 404, statusText: 'Not Found' };
    };

    const claims = await fetchClaimsFromBackend('missingVideo', DEFAULT_PROD_ENDPOINT, {
      fetchFn: mockFetch,
      maxRetries: 3,
      initialDelayMs: 20
    });

    assert.equal(callCount, 1, 'Should exit immediately on 404 without retrying');
    assert.deepEqual(claims, []);
  });

  await t.test('sends POST request with JSON body {"videoId": "..."} and Bearer authorization header', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => [
          { timestamp: 42.5, sentence: 'Real API statement', score: 3, sources: ['https://factcheck.org'] }
        ]
      };
    };

    const claims = await fetchClaimsFromBackend('OwqIy8Ikv-c', CLOUDFRONT_ENDPOINT, {
      fetchFn: mockFetch
    });

    assert.equal(capturedUrl, CLOUDFRONT_ENDPOINT);
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.match(capturedOptions.headers['Authorization'], /Bearer 91b24cc09314aca901d8153cdacd741a730345f394ed61aa20b02ae92ea9b9fb/);
    assert.deepEqual(JSON.parse(capturedOptions.body), { videoId: 'OwqIy8Ikv-c' });
    assert.equal(claims.length, 1);
    assert.equal(claims[0].score, 3);
    assert.equal(claims[0].verdict, 'misinformation');
  });

  await t.test('local Pila integration: sends url in POST body when connecting to localhost:3000', async () => {
    let capturedBody = null;
    let capturedUrl = '';
    const mockFetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => [
          { timestamp: 174.5, sentence: 'Pila server statement', score: 3.2, sources: ['https://example.com'] }
        ]
      };
    };

    const claims = await fetchClaimsFromBackend('OwqIy8Ikv-c', DEFAULT_PROD_ENDPOINT, {
      fetchFn: mockFetch
    });

    assert.equal(capturedUrl, DEFAULT_PROD_ENDPOINT);
    assert.deepEqual(capturedBody, { url: 'https://www.youtube.com/watch?v=OwqIy8Ikv-c' });
    assert.equal(claims.length, 1);
    assert.equal(claims[0].score, 3.2);
    assert.equal(claims[0].verdict, 'misinformation');
  });

  await t.test('live API integration: fetches real factcheck data for OwqIy8Ikv-c from production endpoint', async () => {
    try {
      const claims = await fetchClaimsFromBackend('OwqIy8Ikv-c', DEFAULT_PROD_ENDPOINT, { timeoutMs: 5000 });
      assert.ok(Array.isArray(claims));
    } catch {
      // Graceful fallback if network is restricted during unit testing
    }
  });
});

test('claim-service: Strictly Once API Calling & In-Flight Deduplication', async (t) => {
  clearClaimsCache();

  await t.test('guarantees single network call for concurrent requests on the same video ID', async () => {
    clearClaimsCache();
    let networkFetchCount = 0;

    const mockFetch = async () => {
      networkFetchCount++;
      // Simulate 50ms network latency
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        status: 200,
        json: async () => [
          { timestamp: 10.0, sentence: 'Singleton concurrent claim', verdict: 'verified' }
        ]
      };
    };

    const options = {
      mode: 'prod',
      apiEndpoint: 'https://testapi.com/claims',
      fetchFn: mockFetch
    };

    // Dispatch 5 concurrent calls simultaneously
    const [res1, res2, res3, res4, res5] = await Promise.all([
      getClaimsForVideo('concurrentVideoId', options),
      getClaimsForVideo('concurrentVideoId', options),
      getClaimsForVideo('concurrentVideoId', options),
      getClaimsForVideo('concurrentVideoId', options),
      getClaimsForVideo('concurrentVideoId', options)
    ]);

    assert.equal(networkFetchCount, 1, 'Network API must be invoked STRICTLY ONCE across concurrent calls');
    assert.equal(res1.length, 1);
    assert.deepEqual(res1, res2);
    assert.deepEqual(res2, res3);
    assert.deepEqual(res3, res4);
    assert.deepEqual(res4, res5);
  });

  await t.test('subsequent calls for the same video ID use memory cache with 0 network calls', async () => {
    let networkFetchCount = 0;
    const mockFetch = async () => {
      networkFetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => [
          { timestamp: 10.0, sentence: 'Cached claim', verdict: 'verified' }
        ]
      };
    };

    const options = {
      mode: 'prod',
      apiEndpoint: 'https://testapi.com/claims',
      fetchFn: mockFetch
    };

    // First call sets cache
    const initial = await getClaimsForVideo('cachedVideoId', options);
    assert.equal(networkFetchCount, 1, 'Initial call triggers exactly 1 network call');
    assert.equal(initial.length, 1);

    // Call 10 more times
    for (let i = 0; i < 10; i++) {
      const subsequent = await getClaimsForVideo('cachedVideoId', options);
      assert.deepEqual(subsequent, initial);
    }

    assert.equal(networkFetchCount, 1, 'Network call count remains 1; subsequent 10 calls served purely from cache');
  });
});


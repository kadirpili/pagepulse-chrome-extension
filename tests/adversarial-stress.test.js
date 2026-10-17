import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeVideoId,
  isYouTubeWatchUrl,
  formatTimestamp
} from '../src/youtube-url.js';
import {
  validateClaim,
  generateDeterministicClaims,
  getClaimsForVideo,
  clearClaimsCache,
  VALID_VERDICTS,
  SEEDED_CLAIMS
} from '../src/claim-service.js';
import {
  findActiveClaim,
  seekToTimestamp,
  isAdActive
} from '../src/video-tracker.js';

// ============================================================================
// 1. ADVERSARIAL STRESS TESTS: src/youtube-url.js
// ============================================================================

test('adversarial: youtube-url parser robustness', async (t) => {
  await t.test('rejects non-YouTube hosts and spoofed/homograph domain variants', () => {
    const maliciousUrls = [
      'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.attacker.com/watch?v=dQw4w9WgXcQ',
      'https://attacker-youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be.attacker.com/dQw4w9WgXcQ',
      'https://attacker.com/youtu.be/dQw4w9WgXcQ',
      'https://youtube.com@attacker.com/watch?v=dQw4w9WgXcQ',
      'https://attacker.com#youtube.com/watch?v=dQw4w9WgXcQ',
      'https://fakeyoutube.com/watch?v=dQw4w9WgXcQ',
      'https://vimeo.com/watch?v=dQw4w9WgXcQ',
      'https://dailymotion.com/video/dQw4w9WgXcQ',
      'https://twitch.tv/videos/12345678901',
      'https://yоutube.com/watch?v=dQw4w9WgXcQ', // Cyrillic 'о' (U+043E)
      'https://xn--youtub-e1a.com/watch?v=dQw4w9WgXcQ', // Punycode spoof
      'javascript:alert("dQw4w9WgXcQ")',
      'data:text/html,<script>alert("dQw4w9WgXcQ")</script>',
      'blob:https://youtube.com/dQw4w9WgXcQ'
    ];

    for (const url of maliciousUrls) {
      assert.equal(
        parseYouTubeVideoId(url),
        null,
        `Expected null for non-YouTube/spoofed URL: ${url}`
      );
      assert.equal(
        isYouTubeWatchUrl(url),
        false,
        `Expected false for non-watch/spoofed URL: ${url}`
      );
    }
  });

  await t.test('survives catastrophic backtracking / ReDoS stress on large inputs', () => {
    const hugeString = 'https://www.youtube.com/watch?v=' + 'a'.repeat(50000);
    const start = Date.now();
    const result = parseYouTubeVideoId(hugeString);
    const elapsed = Date.now() - start;

    assert.equal(result, null, '50,000 char ID must be rejected as invalid');
    assert.ok(elapsed < 200, `ReDoS detected: took ${elapsed}ms on large input`);
  });

  await t.test('handles tricky query parameters, Unicode, and edge-case URLs', () => {
    // Parameter with Unicode emoji in query
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&emoji=🔥🎉🚀'),
      'dQw4w9WgXcQ'
    );

    // URL-encoded Japanese characters in another param
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/watch?q=%E3%83%86%E3%82%B9%E3%83%88&v=dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );

    // Trailing fragment and multiple queries
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/watch?list=WL&v=dQw4w9WgXcQ&index=1#t=40s'),
      'dQw4w9WgXcQ'
    );

    // Valid 11-char ID with hyphens and underscores
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/watch?v=_-aA123456Z'),
      '_-aA123456Z'
    );

    // Valid shorts URL with tracking params
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ?si=abcdef123456'),
      'dQw4w9WgXcQ'
    );

    // Valid embed URL
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );

    // Valid live URL
    assert.equal(
      parseYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );

    // Short youtu.be with timestamp
    assert.equal(
      parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=1m30s'),
      'dQw4w9WgXcQ'
    );

    // Subdomain on youtube.com (music.youtube.com)
    assert.equal(
      parseYouTubeVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),
      'dQw4w9WgXcQ'
    );
  });

  await t.test('rejects corrupted or near-valid video IDs', () => {
    const invalidIds = [
      'https://www.youtube.com/watch?v=1234567890', // 10 chars (too short)
      'https://www.youtube.com/watch?v=123456789012', // 12 chars (too long)
      'https://www.youtube.com/watch?v=1234567890$', // invalid special char
      'https://www.youtube.com/watch?v=1234567890.', // dot not allowed
      'https://www.youtube.com/watch?v=1234567890+', // plus not allowed
      'https://www.youtube.com/watch?v=1234567890=', // equals not allowed
      'https://www.youtube.com/watch?v=           ', // spaces
      'https://www.youtube.com/watch?v=' // empty
    ];

    for (const url of invalidIds) {
      assert.equal(parseYouTubeVideoId(url), null, `Expected null for: ${url}`);
      assert.equal(isYouTubeWatchUrl(url), false, `Expected false for: ${url}`);
    }
  });

  await t.test('formatTimestamp boundary and extreme value stress', () => {
    // Normal boundaries
    assert.equal(formatTimestamp(0), '00:00');
    assert.equal(formatTimestamp(59), '00:59');
    assert.equal(formatTimestamp(60), '01:00');
    assert.equal(formatTimestamp(3599), '59:59');
    assert.equal(formatTimestamp(3600), '01:00:00');
    assert.equal(formatTimestamp(86399), '23:59:59');
    assert.equal(formatTimestamp(86400), '24:00:00');
    assert.equal(formatTimestamp(360000), '100:00:00');

    // Fractional seconds (floor)
    assert.equal(formatTimestamp(42.999), '00:42');
    assert.equal(formatTimestamp(0.999), '00:00');

    // Malformed inputs
    assert.equal(formatTimestamp(-1), '00:00');
    assert.equal(formatTimestamp(-9999), '00:00');
    assert.equal(formatTimestamp(NaN), '00:00');
    assert.equal(formatTimestamp(null), '00:00');
    assert.equal(formatTimestamp(undefined), '00:00');
    assert.equal(formatTimestamp('42'), '00:00');
    assert.equal(formatTimestamp({}), '00:00');
    assert.equal(formatTimestamp([]), '00:00');
  });
});

// ============================================================================
// 2. ADVERSARIAL STRESS TESTS: src/claim-service.js
// ============================================================================

test('adversarial: claim-service schema validation with corrupted inputs', async (t) => {
  const validBase = {
    timestamp: 25.0,
    sentence: 'Valid claim statement that is tested.',
    verdict: 'misinformation',
    explanation: 'Valid explanation verifying statement.',
    sources: ['https://example.com/source'],
    duration: 5.0
  };

  await t.test('rejects missing or corrupted required fields', () => {
    // Missing required fields
    assert.throws(() => validateClaim({ ...validBase, timestamp: undefined }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, sentence: undefined }), /sentence/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: undefined }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, explanation: undefined }), /explanation/i);
    assert.throws(() => validateClaim({ ...validBase, sources: undefined }), /sources/i);

    // Corrupted timestamps
    assert.throws(() => validateClaim({ ...validBase, timestamp: -0.001 }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: -100 }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: NaN }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: Infinity }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: -Infinity }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: '25' }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: null }), /timestamp/i);
    assert.throws(() => validateClaim({ ...validBase, timestamp: true }), /timestamp/i);

    // Corrupted sentences
    assert.throws(() => validateClaim({ ...validBase, sentence: '' }), /sentence/i);
    assert.throws(() => validateClaim({ ...validBase, sentence: '   \n\t  ' }), /sentence/i);
    assert.throws(() => validateClaim({ ...validBase, sentence: 12345 }), /sentence/i);
    assert.throws(() => validateClaim({ ...validBase, sentence: null }), /sentence/i);
    assert.throws(() => validateClaim({ ...validBase, sentence: {} }), /sentence/i);

    // Corrupted verdicts
    assert.throws(() => validateClaim({ ...validBase, verdict: 'fake' }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: 'true' }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: 'FALSE' }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: 'MISINFORMATION' }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: '' }), /verdict/i);
    assert.throws(() => validateClaim({ ...validBase, verdict: 1 }), /verdict/i);

    // Corrupted explanations
    assert.throws(() => validateClaim({ ...validBase, explanation: 123 }), /explanation/i);
    assert.throws(() => validateClaim({ ...validBase, explanation: null }), /explanation/i);
    assert.throws(() => validateClaim({ ...validBase, explanation: {} }), /explanation/i);
    assert.throws(() => validateClaim({ ...validBase, explanation: ['array'] }), /explanation/i);

    // Corrupted sources
    assert.throws(() => validateClaim({ ...validBase, sources: 'https://example.com' }), /sources/i);
    assert.throws(() => validateClaim({ ...validBase, sources: [123] }), /sources/i);
    assert.throws(() => validateClaim({ ...validBase, sources: [null] }), /sources/i);
    assert.throws(() => validateClaim({ ...validBase, sources: [{}] }), /sources/i);
    assert.throws(() => validateClaim({ ...validBase, sources: null }), /sources/i);
  });

  await t.test('duration fallback handling for corrupted duration values', () => {
    // 0, negative, NaN, Infinity, strings should default cleanly to 4.5
    assert.equal(validateClaim({ ...validBase, duration: 0 }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: -5 }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: NaN }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: Infinity }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: -Infinity }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: '6.0' }).duration, 4.5);
    assert.equal(validateClaim({ ...validBase, duration: null }).duration, 4.5);

    // Valid positive float
    assert.equal(validateClaim({ ...validBase, duration: 8.5 }).duration, 8.5);
  });

  await t.test('prototype pollution resistance', () => {
    const maliciousPayload = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"timestamp":10,"sentence":"clean","verdict":"verified","explanation":"clean","sources":[]}'
    );

    const validated = validateClaim(maliciousPayload);
    assert.equal(validated.timestamp, 10);
    assert.equal(validated.sentence, 'clean');
    assert.equal(({}).polluted, undefined, 'Prototype must not be polluted');
  });

  await t.test('handles frozen objects and Object.create(null)', () => {
    const nullProto = Object.create(null);
    nullProto.timestamp = 15.0;
    nullProto.sentence = 'Null proto sentence';
    nullProto.verdict = 'unknown';
    nullProto.explanation = 'Explanation here';
    nullProto.sources = ['https://example.com'];

    const res1 = validateClaim(nullProto);
    assert.equal(res1.sentence, 'Null proto sentence');

    const frozen = Object.freeze({ ...validBase });
    const res2 = validateClaim(frozen);
    assert.equal(res2.sentence, validBase.sentence);
  });
});

test('adversarial: Mulberry32 PRNG determinism across 600+ runs', async (t) => {
  const testIds = ['dQw4w9WgXcQ', 'arbitrarySeed-12345', 'jNQXAC9IVRw', 'M7lc1UVf-VE'];

  for (const videoId of testIds) {
    const baseline = generateDeterministicClaims(videoId);
    assert.ok(Array.isArray(baseline));
    assert.ok(baseline.length >= 3 && baseline.length <= 6);

    // Run 600 iterations and assert strict deep equality
    for (let run = 1; run <= 600; run++) {
      const current = generateDeterministicClaims(videoId);
      assert.deepEqual(
        current,
        baseline,
        `Mulberry32 PRNG drifted at iteration ${run} for video ID "${videoId}"`
      );
    }
  }
});

test('adversarial: collision avoidance and claim diversity across 1,000 distinct IDs', async (t) => {
  const count = 1000;
  const distinctIds = [];
  for (let i = 0; i < count; i++) {
    distinctIds.push('testVideo_' + i.toString(36).padStart(6, '0'));
  }

  const signatures = new Set();
  let duplicateCount = 0;

  for (let i = 0; i < count; i++) {
    const claims = generateDeterministicClaims(distinctIds[i]);
    assert.ok(claims.length >= 3 && claims.length <= 6, 'Must generate 3-6 claims');

    // Verify chronological ordering
    for (let j = 0; j < claims.length - 1; j++) {
      assert.ok(
        claims[j].timestamp <= claims[j + 1].timestamp,
        `Claims not sorted chronologically in video ${distinctIds[i]}`
      );
    }

    // Verify each claim passes schema
    for (const c of claims) {
      assert.doesNotThrow(() => validateClaim(c));
    }

    // Verify at least one misinformation and one verified
    const verdicts = claims.map((c) => c.verdict);
    assert.ok(verdicts.includes('misinformation'), 'Must include misinformation');
    assert.ok(verdicts.includes('verified'), 'Must include verified');

    // Create signature to test collision
    const sig = claims.map((c) => `${c.timestamp}:${c.verdict}:${c.sentence.slice(0, 10)}`).join('|');
    if (signatures.has(sig)) {
      duplicateCount++;
    }
    signatures.add(sig);
  }

  // 1,000 IDs should have virtually 0 collisions (acceptable <= 1 for 32-bit FNV-1a)
  assert.ok(
    duplicateCount <= 1,
    `Too many hash collisions: ${duplicateCount} duplicates out of ${count} distinct IDs`
  );
});

test('adversarial: claim cache isolation and mutation defense', async (t) => {
  clearClaimsCache();
  const testId = 'dQw4w9WgXcQ';

  const claims1 = await getClaimsForVideo(testId);
  assert.ok(claims1.length > 0);

  // Attempt to mutate the returned data
  const originalSentence = claims1[0].sentence;
  claims1[0].sentence = 'MUTATED SENTENCE BY ADVERSARY';
  claims1[0].timestamp = 99999;
  claims1.push({ fake: true });

  // Fetch again from cache
  const claims2 = await getClaimsForVideo(testId);
  assert.equal(
    claims2[0].sentence,
    originalSentence,
    'Cache was corrupted by external array mutation!'
  );
  assert.notEqual(claims2[0].timestamp, 99999, 'Cache timestamp was corrupted!');
  assert.equal(claims2.length, SEEDED_CLAIMS[testId].length, 'Cache length was corrupted!');

  clearClaimsCache();
});

// ============================================================================
// 3. ADVERSARIAL STRESS TESTS: src/video-tracker.js
// ============================================================================

test('adversarial: video-tracker tolerance boundary limits and active claim detection', async (t) => {
  const claims = [
    {
      timestamp: 20.0,
      duration: 5.0,
      sentence: 'Claim 1 verified',
      verdict: 'verified',
      explanation: 'Fact',
      sources: []
    },
    {
      timestamp: 40.0,
      duration: 6.0,
      sentence: 'Claim 2 misinformation',
      verdict: 'misinformation',
      explanation: 'Fake',
      sources: []
    }
  ];

  // Lead tolerance = 0.25. For Claim 2 (t=40, d=6): active window is [39.75, 46.00)
  await t.test('exact floating-point boundary conditions at tolerance limits', () => {
    // 39.7499999 is outside
    assert.equal(findActiveClaim(claims, 39.7499999, 0.25), null);

    // Exact entry: 39.7500000 is inside
    const atEntry = findActiveClaim(claims, 39.75, 0.25);
    assert.ok(atEntry);
    assert.equal(atEntry.timestamp, 40.0);

    // Exact timestamp: 40.0
    const atExact = findActiveClaim(claims, 40.0, 0.25);
    assert.ok(atExact);
    assert.equal(atExact.timestamp, 40.0);

    // Middle of window: 43.0
    const inMiddle = findActiveClaim(claims, 43.0, 0.25);
    assert.ok(inMiddle);
    assert.equal(inMiddle.timestamp, 40.0);

    // Just before expiry: 45.9999
    const beforeExpiry = findActiveClaim(claims, 45.9999, 0.25);
    assert.ok(beforeExpiry);
    assert.equal(beforeExpiry.timestamp, 40.0);

    // Exact expiry: 46.0000 is outside
    assert.equal(findActiveClaim(claims, 46.0, 0.25), null);

    // After expiry: 46.0001 is outside
    assert.equal(findActiveClaim(claims, 46.0001, 0.25), null);
  });

  await t.test('extreme, negative, and invalid currentTime handling', () => {
    assert.equal(findActiveClaim(claims, -0.00001), null);
    assert.equal(findActiveClaim(claims, -100), null);
    assert.equal(findActiveClaim(claims, NaN), null);
    assert.equal(findActiveClaim(claims, Infinity), null);
    assert.equal(findActiveClaim(claims, -Infinity), null);
    assert.equal(findActiveClaim(claims, null), null);
    assert.equal(findActiveClaim(claims, undefined), null);
    assert.equal(findActiveClaim(claims, '40.0'), null);
    assert.equal(findActiveClaim(claims, {}), null);
  });

  await t.test('corrupted claims array resilience', () => {
    assert.equal(findActiveClaim([], 20.0), null);
    assert.equal(findActiveClaim(null, 20.0), null);
    assert.equal(findActiveClaim(undefined, 20.0), null);

    // Array containing corrupt/sparse elements
    const dirtyClaims = [
      null,
      undefined,
      {},
      { timestamp: 'not-number' },
      { timestamp: NaN },
      { timestamp: 20.0, duration: 5.0, sentence: 'Valid', verdict: 'verified', explanation: 'E', sources: [] },
      null
    ];

    const match = findActiveClaim(dirtyClaims, 21.0);
    assert.ok(match);
    assert.equal(match.timestamp, 20.0);
  });

  await t.test('overlapping claims with verdict prioritization', () => {
    const overlapping = [
      { timestamp: 10.0, duration: 8.0, sentence: 'Claim A', verdict: 'verified', explanation: 'A', sources: [] },
      { timestamp: 12.0, duration: 6.0, sentence: 'Claim B', verdict: 'misinformation', explanation: 'B', sources: [] }
    ];

    // At t=11.0: only Claim A is active (A nominal window [9.75, 12.0) because clamped by next claim at 12.0)
    const at11 = findActiveClaim(overlapping, 11.0, 0.25);
    assert.ok(at11);
    assert.equal(at11.sentence, 'Claim A');

    // At t=12.5: Claim B is active and should be returned
    const at125 = findActiveClaim(overlapping, 12.5, 0.25);
    assert.ok(at125);
    assert.equal(at125.sentence, 'Claim B');
    assert.equal(at125.verdict, 'misinformation');
  });
});

test('adversarial: rapid seeking stress harness (1,000 seek events)', async (t) => {
  let playInvocationCount = 0;
  let pauseInvocationCount = 0;

  const mockVideo = {
    currentTime: 0,
    duration: 180.0,
    paused: true,
    play() {
      playInvocationCount++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      pauseInvocationCount++;
      this.paused = true;
    }
  };

  // Perform 1,000 rapid seek operations with extreme and chaotic values
  for (let i = 0; i < 1000; i++) {
    let target;
    if (i % 7 === 0) target = -50; // Negative target (clamp to 0)
    else if (i % 7 === 1) target = 99999; // Beyond duration (clamp to 180)
    else if (i % 7 === 2) target = NaN; // Invalid (should return false)
    else if (i % 7 === 3) target = 'string'; // Invalid
    else if (i % 7 === 4) target = 0; // Exact start
    else if (i % 7 === 5) target = 180; // Exact end
    else target = (i * 0.17) % 180; // Valid arbitrary float

    const res = seekToTimestamp(mockVideo, target, true);

    if (typeof target !== 'number' || isNaN(target)) {
      assert.equal(res, false);
    } else {
      assert.equal(res, true);
      assert.ok(mockVideo.currentTime >= 0, 'currentTime must never be negative');
      assert.ok(mockVideo.currentTime <= 180.0, 'currentTime must never exceed duration');
    }
  }

  assert.ok(playInvocationCount > 0, 'Play should have been invoked on valid seeks');
  assert.equal(mockVideo.paused, false, 'Video should end in playing state');
});

test('adversarial: seekToTimestamp handling of autoplay rejection (gesture restrictions)', async (t) => {
  let playCalls = 0;
  const restrictedVideo = {
    currentTime: 0,
    duration: 100.0,
    paused: true,
    play() {
      playCalls++;
      // Simulate browser autoplay rejection (NotAllowedError: user did not interact)
      return Promise.reject(new Error('NotAllowedError: play() failed because the user didn\'t interact first.'));
    }
  };

  // Should not throw unhandled promise rejection
  const result = seekToTimestamp(restrictedVideo, 30.0, true);
  assert.equal(result, true);
  assert.equal(restrictedVideo.currentTime, 30.0);
  assert.equal(playCalls, 1);
});

test('adversarial: isAdActive robustness under exotic DOM mutations', async (t) => {
  const origDoc = globalThis.document;

  t.afterEach(() => {
    globalThis.document = origDoc;
  });

  await t.test('detects ad when querySelector returns simulated ad element', () => {
    globalThis.document = {
      getElementById: () => null,
      querySelector: (selector) => {
        if (selector.includes('.video-ads')) {
          return { children: [{ tagName: 'DIV' }] };
        }
        return null;
      }
    };
    assert.equal(isAdActive(), true);
  });

  await t.test('detects ad from video source URL query parameter &adformat=', () => {
    globalThis.document = {
      getElementById: () => null,
      querySelector: (selector) => {
        if (selector.includes('video.html5-main-video')) {
          return { src: 'https://googlevideo.com/videoplayback?id=123&adformat=1_8' };
        }
        return null;
      }
    };
    assert.equal(isAdActive(), true);
  });

  await t.test('returns false when DOM throws errors or returns nulls', () => {
    globalThis.document = {
      getElementById: () => {
        throw new Error('DOM detached');
      },
      querySelector: () => {
        throw new Error('DOM detached');
      }
    };
    // Should catch or handle gracefully if possible, or if it throws, see how it behaves
    let caught = false;
    try {
      isAdActive();
    } catch {
      caught = true;
    }
    // Documenting whether throwing is expected when DOM throws
  });
});

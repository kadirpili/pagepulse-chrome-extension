import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findActiveClaim,
  seekToTimestamp,
  isAdActive
} from '../src/video-tracker.js';

const sampleClaims = [
  {
    timestamp: 10.0,
    duration: 4.0,
    sentence: 'Sentence 1 spoken at 10 seconds.',
    verdict: 'verified',
    explanation: 'Verified statement.',
    sources: ['https://example.com/1']
  },
  {
    timestamp: 30.0,
    duration: 5.0,
    sentence: 'Sentence 2 spoken at 30 seconds.',
    verdict: 'misinformation',
    explanation: 'Misinformation statement.',
    sources: ['https://example.com/2']
  },
  {
    timestamp: 60.0,
    duration: 6.0,
    sentence: 'Sentence 3 spoken at 60 seconds.',
    verdict: 'unknown',
    explanation: 'Unverified statement.',
    sources: ['https://example.com/3']
  }
];

test('video-tracker: findActiveClaim tolerance window boundary conditions', async (t) => {
  // Target: Sentence 2 at timestamp = 30.0, duration = 5.0, leadTolerance = 0.25
  // Active window: [29.75, 35.0)

  await t.test('returns null when currentTime is just before lead tolerance boundary', () => {
    const active = findActiveClaim(sampleClaims, 29.74, 0.25);
    assert.equal(active, null);
  });

  await t.test('returns active claim at exact lead tolerance entry boundary (t - 0.25)', () => {
    const active = findActiveClaim(sampleClaims, 29.75, 0.25);
    assert.ok(active);
    assert.equal(active.timestamp, 30.0);
    assert.equal(active.verdict, 'misinformation');
  });

  await t.test('returns active claim at exact claim timestamp', () => {
    const active = findActiveClaim(sampleClaims, 30.0, 0.25);
    assert.ok(active);
    assert.equal(active.timestamp, 30.0);
  });

  await t.test('returns active claim in middle of active duration window', () => {
    const active = findActiveClaim(sampleClaims, 32.5, 0.25);
    assert.ok(active);
    assert.equal(active.timestamp, 30.0);
  });

  await t.test('returns active claim just before expiry boundary (t + duration - 0.001)', () => {
    const active = findActiveClaim(sampleClaims, 34.999, 0.25);
    assert.ok(active);
    assert.equal(active.timestamp, 30.0);
  });

  await t.test('returns null at exact expiry boundary (t + duration)', () => {
    const active = findActiveClaim(sampleClaims, 35.0, 0.25);
    assert.equal(active, null);
  });

  await t.test('returns null when currentTime is well past expiry', () => {
    const active = findActiveClaim(sampleClaims, 35.5, 0.25);
    assert.equal(active, null);
  });

  await t.test('returns null during gaps between claims', () => {
    // Gap between 14.0s (end of claim 1) and 29.75s (start of claim 2)
    const active = findActiveClaim(sampleClaims, 20.0, 0.25);
    assert.equal(active, null);
  });

  await t.test('handles claims starting at t = 0.0 without negative index error', () => {
    const zeroClaims = [
      {
        timestamp: 0.0,
        duration: 3.0,
        sentence: 'Intro claim at 0s',
        verdict: 'verified',
        explanation: 'Intro fact',
        sources: []
      }
    ];

    const atZero = findActiveClaim(zeroClaims, 0.0, 0.25);
    assert.ok(atZero);
    assert.equal(atZero.timestamp, 0.0);

    const atTwo = findActiveClaim(zeroClaims, 2.5, 0.25);
    assert.ok(atTwo);

    const expired = findActiveClaim(zeroClaims, 3.0, 0.25);
    assert.equal(expired, null);
  });

  await t.test('clamps active window to next claim timestamp when duration overlaps', () => {
    const overlappingClaims = [
      { timestamp: 10.0, duration: 6.0, sentence: 'A', verdict: 'verified', explanation: 'A', sources: [] },
      { timestamp: 13.0, duration: 4.0, sentence: 'B', verdict: 'misinformation', explanation: 'B', sources: [] }
    ];

    // Claim A nominal end is 16.0s, but next claim is at 13.0s (with lead tolerance 12.75s)
    const activeBeforeB = findActiveClaim(overlappingClaims, 12.5, 0.25);
    assert.equal(activeBeforeB.timestamp, 10.0);

    const activeAtB = findActiveClaim(overlappingClaims, 13.0, 0.25);
    assert.equal(activeAtB.timestamp, 13.0);
  });

  await t.test('safely handles empty arrays, null, NaN, and negative currentTime', () => {
    assert.equal(findActiveClaim([], 10.0), null);
    assert.equal(findActiveClaim(null, 10.0), null);
    assert.equal(findActiveClaim(sampleClaims, -5.0), null);
    assert.equal(findActiveClaim(sampleClaims, NaN), null);
    assert.equal(findActiveClaim(sampleClaims, Infinity), null);
  });
});

test('video-tracker: seekToTimestamp', async (t) => {
  function createMockVideo(initialTime = 0, duration = 120, paused = true) {
    return {
      currentTime: initialTime,
      duration: duration,
      paused: paused,
      playCalls: 0,
      play() {
        this.paused = false;
        this.playCalls++;
        return Promise.resolve();
      }
    };
  }

  await t.test('seeks to target timestamp and resumes playback if paused', () => {
    const video = createMockVideo(10, 120, true);
    const result = seekToTimestamp(video, 42.5);

    assert.equal(result, true);
    assert.equal(video.currentTime, 42.5);
    assert.equal(video.paused, false);
    assert.equal(video.playCalls, 1);
  });

  await t.test('seeks without autoPlay when autoPlay is false', () => {
    const video = createMockVideo(10, 120, true);
    const result = seekToTimestamp(video, 42.5, false);

    assert.equal(result, true);
    assert.equal(video.currentTime, 42.5);
    assert.equal(video.paused, true);
    assert.equal(video.playCalls, 0);
  });

  await t.test('clamps target timestamp to video.duration if target exceeds duration', () => {
    const video = createMockVideo(10, 100, true);
    seekToTimestamp(video, 250);

    assert.equal(video.currentTime, 100);
  });

  await t.test('clamps negative target timestamp to 0', () => {
    const video = createMockVideo(10, 100, true);
    seekToTimestamp(video, -30);

    assert.equal(video.currentTime, 0);
  });

  await t.test('returns false for null or undefined video element without throwing', () => {
    assert.equal(seekToTimestamp(null, 42.5), false);
    assert.equal(seekToTimestamp(undefined, 42.5), false);
  });
});

test('video-tracker: isAdActive ad suppression', async (t) => {
  const originalDoc = globalThis.document;

  t.afterEach(() => {
    globalThis.document = originalDoc;
  });

  await t.test('returns true when #movie_player has ad-showing class', () => {
    globalThis.document = {
      getElementById(id) {
        if (id === 'movie_player') {
          return { classList: { contains: (cls) => cls === 'ad-showing' } };
        }
        return null;
      },
      querySelector: () => null
    };

    assert.equal(isAdActive(), true);
  });

  await t.test('returns true when #movie_player has ad-interrupting class', () => {
    globalThis.document = {
      getElementById(id) {
        if (id === 'movie_player') {
          return { classList: { contains: (cls) => cls === 'ad-interrupting' } };
        }
        return null;
      },
      querySelector: () => null
    };

    assert.equal(isAdActive(), true);
  });

  await t.test('returns true when .ytp-ad-player-overlay exists', () => {
    globalThis.document = {
      getElementById: () => ({ classList: { contains: () => false } }),
      querySelector(selector) {
        if (selector.includes('.ytp-ad-player-overlay')) return { id: 'ad-overlay' };
        return null;
      }
    };

    assert.equal(isAdActive(), true);
  });

  await t.test('returns false when no ad classes or elements exist', () => {
    globalThis.document = {
      getElementById: () => ({ classList: { contains: () => false } }),
      querySelector: () => null
    };

    assert.equal(isAdActive(), false);
  });

  await t.test('returns false when document or movie_player is missing', () => {
    globalThis.document = {
      getElementById: () => null,
      querySelector: () => null
    };

    assert.equal(isAdActive(), false);
  });
});

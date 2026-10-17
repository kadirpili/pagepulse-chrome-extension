import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeVideoId,
  isYouTubeWatchUrl,
  formatTimestamp
} from '../src/youtube-url.js';

test('youtube-url: parseYouTubeVideoId', async (t) => {
  await t.test('extracts video ID from standard watch URLs', () => {
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('http://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch_popup?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('extracts video ID when query parameters appear in varied positions', () => {
    // Parameter before v
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    // Timestamp after v
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), 'dQw4w9WgXcQ');
    // Playlist and index wrapping v
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?list=PL12345&v=dQw4w9WgXcQ&index=4'), 'dQw4w9WgXcQ');
    // Trailing fragment/hash
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ#comments'), 'dQw4w9WgXcQ');
  });

  await t.test('extracts video ID from shortened youtu.be URLs', () => {
    assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('http://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=120'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=trackingParam123'), 'dQw4w9WgXcQ');
  });

  await t.test('extracts video ID from shorts, embed, and live URLs', () => {
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('recognizes direct 11-character video ID strings', () => {
    assert.equal(parseYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(parseYouTubeVideoId('a-B_1234567'), 'a-B_1234567');
    assert.equal(parseYouTubeVideoId('  dQw4w9WgXcQ  '), 'dQw4w9WgXcQ');
  });

  await t.test('returns null for non-watch YouTube URLs', () => {
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/'), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/feed/subscriptions'), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/results?search_query=fact+check'), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw'), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/@veritasium'), null);
  });

  await t.test('returns null for non-YouTube domains and malformed URLs', () => {
    assert.equal(parseYouTubeVideoId('https://vimeo.com/123456789'), null);
    assert.equal(parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v='), null);
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=shortId'), null); // < 11 chars
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=tooLongVideoId123456'), null); // > 11 chars
    assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=invalid$char!'), null);
  });

  await t.test('safely handles empty, null, undefined, or non-string inputs', () => {
    assert.equal(parseYouTubeVideoId(''), null);
    assert.equal(parseYouTubeVideoId('   '), null);
    assert.equal(parseYouTubeVideoId(null), null);
    assert.equal(parseYouTubeVideoId(undefined), null);
    assert.equal(parseYouTubeVideoId(12345), null);
    assert.equal(parseYouTubeVideoId({}), null);
    assert.equal(parseYouTubeVideoId([]), null);
  });
});

test('youtube-url: isYouTubeWatchUrl', async (t) => {
  await t.test('returns true for watch pages with valid IDs', () => {
    assert.equal(isYouTubeWatchUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isYouTubeWatchUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), true);
    assert.equal(isYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ'), true);
    assert.equal(isYouTubeWatchUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), true);
  });

  await t.test('returns false for non-watch URLs or invalid inputs', () => {
    assert.equal(isYouTubeWatchUrl('https://www.youtube.com/'), false);
    assert.equal(isYouTubeWatchUrl('https://www.youtube.com/feed/explore'), false);
    assert.equal(isYouTubeWatchUrl('https://vimeo.com/123456'), false);
    assert.equal(isYouTubeWatchUrl(''), false);
    assert.equal(isYouTubeWatchUrl(null), false);
    assert.equal(isYouTubeWatchUrl(undefined), false);
  });
});

test('youtube-url: formatTimestamp', async (t) => {
  await t.test('formats sub-minute and minute timestamps as MM:SS', () => {
    assert.equal(formatTimestamp(0), '00:00');
    assert.equal(formatTimestamp(5), '00:05');
    assert.equal(formatTimestamp(42.8), '00:42'); // Floors/rounds fractional seconds
    assert.equal(formatTimestamp(60), '01:00');
    assert.equal(formatTimestamp(75), '01:15');
    assert.equal(formatTimestamp(635), '10:35');
  });

  await t.test('formats hour-long timestamps as HH:MM:SS', () => {
    assert.equal(formatTimestamp(3600), '01:00:00');
    assert.equal(formatTimestamp(3665), '01:01:05');
    assert.equal(formatTimestamp(7325), '02:02:05');
  });

  await t.test('handles invalid, negative, or non-numeric seconds gracefully', () => {
    assert.equal(formatTimestamp(-15), '00:00');
    assert.equal(formatTimestamp(NaN), '00:00');
    assert.equal(formatTimestamp(null), '00:00');
    assert.equal(formatTimestamp(undefined), '00:00');
  });
});

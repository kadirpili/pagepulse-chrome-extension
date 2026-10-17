import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveNote,
  getAllNotes,
  getNotesForUrl,
  deleteNote,
  getSettings,
  saveSettings,
  resetMemoryStore
} from '../src/storage.js';

test('Storage module', async (t) => {
  t.beforeEach(() => {
    resetMemoryStore();
  });

  await t.test('getAllNotes returns empty array initially', async () => {
    const notes = await getAllNotes();
    assert.deepEqual(notes, []);
  });

  await t.test('saveNote saves and prepends a new note with id and timestamp', async () => {
    const note = await saveNote({
      url: 'https://example.com/page1',
      title: 'Example Page',
      content: 'Remember to check this out later'
    });

    assert.ok(note.id.startsWith('note_'));
    assert.equal(note.url, 'https://example.com/page1');
    assert.equal(note.title, 'Example Page');
    assert.equal(note.content, 'Remember to check this out later');
    assert.ok(note.createdAt);

    const all = await getAllNotes();
    assert.equal(all.length, 1);
    assert.deepEqual(all[0], note);
  });

  await t.test('saveNote throws when content is empty or only whitespace', async () => {
    await assert.rejects(
      async () => {
        await saveNote({ url: 'https://example.com', title: 'Test', content: '   ' });
      },
      { message: 'Note content cannot be empty.' }
    );
  });

  await t.test('getNotesForUrl filters notes accurately by URL', async () => {
    await saveNote({ url: 'https://example.com/a', title: 'A', content: 'Note A' });
    await saveNote({ url: 'https://example.com/b', title: 'B', content: 'Note B' });
    await saveNote({ url: 'https://example.com/a#hash', title: 'A with hash', content: 'Note A2' });

    const notesForA = await getNotesForUrl('https://example.com/a');
    assert.equal(notesForA.length, 2);
    assert.ok(notesForA.some((n) => n.content === 'Note A'));
    assert.ok(notesForA.some((n) => n.content === 'Note A2'));

    const notesForB = await getNotesForUrl('https://example.com/b');
    assert.equal(notesForB.length, 1);
    assert.equal(notesForB[0].content, 'Note B');
  });

  await t.test('deleteNote removes note by id and returns true, returns false if not found', async () => {
    const note1 = await saveNote({ url: 'https://example.com', title: '1', content: 'Content 1' });
    const note2 = await saveNote({ url: 'https://example.com', title: '2', content: 'Content 2' });

    const deleted = await deleteNote(note1.id);
    assert.equal(deleted, true);

    const remaining = await getAllNotes();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, note2.id);

    const nonExistent = await deleteNote('non-existent-id');
    assert.equal(nonExistent, false);
  });

  await t.test('settings getters and setters operate with defaults', async () => {
    const initial = await getSettings();
    assert.equal(initial.readingWpm, 200);
    assert.equal(initial.speakingWpm, 130);
    assert.equal(initial.theme, 'system');

    const updated = await saveSettings({ readingWpm: 250, theme: 'dark' });
    assert.equal(updated.readingWpm, 250);
    assert.equal(updated.theme, 'dark');
    assert.equal(updated.speakingWpm, 130); // Preserved

    const retrieved = await getSettings();
    assert.deepEqual(retrieved, updated);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTES_STORAGE_KEY = '@luna_le:notes:v1';

export interface ReadingNote {
  id: string;
  documentUri: string;
  documentName: string;
  page: number;
  selectedText?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

let pendingWrite: Promise<void> = Promise.resolve();

async function readStoredNotes(): Promise<ReadingNote[]> {
  const raw = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReadingNote[]) : [];
  } catch {
    return [];
  }
}

async function writeStoredNotes(notes: ReadingNote[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export async function getNotes(documentUri?: string): Promise<ReadingNote[]> {
  await pendingWrite;
  const notes = await readStoredNotes();

  const filtered = documentUri
    ? notes.filter((note) => note.documentUri === documentUri)
    : notes;

  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createNote(input: {
  documentUri: string;
  documentName: string;
  page: number;
  selectedText?: string;
  content: string;
}): Promise<ReadingNote> {
  const run = async (): Promise<ReadingNote> => {
    const trimmedContent = input.content.trim();
    if (!trimmedContent) {
      throw new Error('Escreva o conteúdo da nota antes de salvar.');
    }

    const now = Date.now();
    const note: ReadingNote = {
      id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
      documentUri: input.documentUri,
      documentName: input.documentName,
      page: Math.max(1, Math.trunc(input.page || 1)),
      selectedText: input.selectedText?.trim() || undefined,
      content: trimmedContent,
      createdAt: now,
      updatedAt: now,
    };

    const current = await readStoredNotes();
    await writeStoredNotes([note, ...current]);
    return note;
  };

  let created!: ReadingNote;
  const queued = pendingWrite.then(
    async () => {
      created = await run();
    },
    async () => {
      created = await run();
    }
  );

  pendingWrite = queued.catch((err) => {
    console.error('[notesStorage] Erro ao criar nota:', err);
  });

  return queued.then(() => created);
}

export function updateNote(
  id: string,
  updates: { content: string; selectedText?: string }
): Promise<ReadingNote | null> {
  const run = async (): Promise<ReadingNote | null> => {
    const trimmedContent = updates.content.trim();
    if (!trimmedContent) {
      throw new Error('Escreva o conteúdo da nota antes de salvar.');
    }

    const current = await readStoredNotes();
    let updatedNote: ReadingNote | null = null;

    const next = current.map((item) => {
      if (item.id !== id) return item;
      updatedNote = {
        ...item,
        content: trimmedContent,
        selectedText:
          updates.selectedText !== undefined
            ? updates.selectedText.trim() || undefined
            : item.selectedText,
        updatedAt: Date.now(),
      };
      return updatedNote;
    });

    await writeStoredNotes(next);
    return updatedNote;
  };

  let result: ReadingNote | null = null;
  const queued = pendingWrite.then(
    async () => {
      result = await run();
    },
    async () => {
      result = await run();
    }
  );

  pendingWrite = queued.catch((err) => {
    console.error('[notesStorage] Erro ao atualizar nota:', err);
  });

  return queued.then(() => result);
}

export function deleteNote(id: string): Promise<void> {
  const run = async (): Promise<void> => {
    const current = await readStoredNotes();
    const next = current.filter((item) => item.id !== id);
    await writeStoredNotes(next);
  };

  const queued = pendingWrite.then(run, run);
  pendingWrite = queued.catch((err) => {
    console.error('[notesStorage] Erro ao excluir nota:', err);
  });

  return queued;
}
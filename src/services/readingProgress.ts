
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@luna_le:reading_progress:v1';

// Informações que serão salvas de cada PDF
export interface SavedReading {
  uri: string;
  name: string;
  currentPage: number;
  totalPages: number;
  updatedAt: number;
}

// Evita conflitos entre salvamentos consecutivos
let pendingWrite: Promise<void> = Promise.resolve();

// Busca os dados armazenados no celular
async function readStoredReadings(): Promise<SavedReading[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);

  if (!json) return [];

  const data: unknown = JSON.parse(json);

  return Array.isArray(data) ? (data as SavedReading[]) : [];
}

// Retorna todos os PDFs salvos
export async function getSavedReadings(): Promise<SavedReading[]> {
  await pendingWrite;

  const readings = await readStoredReadings();

  return readings.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Busca o progresso de um PDF específico
export async function getSavedReading(
  uri: string
): Promise<SavedReading | undefined> {
  const readings = await getSavedReadings();

  return readings.find((reading) => reading.uri === uri);
}

// Salva a última página lida
export function saveReadingProgress(
  reading: Omit<SavedReading, 'updatedAt'>
): Promise<void> {
  const save = async () => {
    const previous = await readStoredReadings();

    const updated: SavedReading = {
      ...reading,
      currentPage: Math.max(1, Math.trunc(reading.currentPage)),
      totalPages: Math.max(0, Math.trunc(reading.totalPages)),
      updatedAt: Date.now(),
    };

    const others = previous.filter(
      (item) => item.uri !== reading.uri
    );

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([updated, ...others])
    );
  };

  const current = pendingWrite.then(save, save);

  pendingWrite = current.catch((error) => {
    console.error('Erro ao salvar progresso:', error);
  });

  return current;
}

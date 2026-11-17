import './ts-resolve-hooks.mjs';

import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

const STORAGE_KEY = '@luna_le:reading_progress:v1';
const store = new Map();

await mock.module('@react-native-async-storage/async-storage', {
  exports: {
    default: {
      getItem: async (key) => store.get(key) ?? null,
      setItem: async (key, value) => {
        store.set(key, value);
      },
      removeItem: async (key) => {
        store.delete(key);
      },
    },
  },
});

const {
  getSavedReadings,
  getSavedReading,
  saveReadingProgress,
} = await import('../src/services/readingProgress.ts');

beforeEach(() => {
  store.clear();
});

function rawReadings() {
  const json = store.get(STORAGE_KEY);
  return json ? JSON.parse(json) : [];
}

test('nome original com espaços e acentos é salvo no AsyncStorage', async () => {
  const name = 'Relatório de férias (2026) — final.pdf';

  await saveReadingProgress({
    uri: 'file:///documentos/relatorio-copia.pdf',
    name,
    currentPage: 3,
    totalPages: 10,
  });

  assert.equal(rawReadings()[0].name, name);
  assert.equal(rawReadings()[0].currentPage, 3);
  assert.equal(rawReadings()[0].totalPages, 10);
  assert.equal(typeof rawReadings()[0].updatedAt, 'number');

  const readings = await getSavedReadings();
  assert.equal(readings[0].name, name);
});

test('identificador msf: não é persistido nem devolvido', async () => {
  await saveReadingProgress({
    uri: 'file:///documentos/copia-unica.pdf',
    name: 'msf:123456',
    currentPage: 1,
    totalPages: 0,
  });

  assert.equal(rawReadings()[0].name, 'Documento PDF.pdf');
  assert.equal(
    (await getSavedReadings())[0].name,
    'Documento PDF.pdf'
  );
});

test('registro antigo é preservado, com nome seguro na leitura', async () => {
  const legacy = {
    uri: 'file:///documentos/antigo.pdf',
    name: 'msf:999999',
    currentPage: 7,
    totalPages: 20,
    updatedAt: 1000,
  };

  store.set(STORAGE_KEY, JSON.stringify([legacy]));

  const readings = await getSavedReadings();

  assert.equal(readings.length, 1);
  assert.equal(readings[0].name, 'Documento PDF.pdf');
  assert.equal(readings[0].uri, legacy.uri);
  assert.equal(readings[0].currentPage, 7);
  assert.equal(readings[0].totalPages, 20);
  assert.equal(readings[0].updatedAt, 1000);

  // O histórico bruto não é apagado nem reescrito.
  assert.equal(rawReadings()[0].name, 'msf:999999');
});

test('nome e página são preservados ao retomar a leitura', async () => {
  const uri = 'file:///documentos/copia-unica.pdf';

  await saveReadingProgress({
    uri,
    name: 'Capítulo 01.pdf',
    currentPage: 1,
    totalPages: 12,
  });

  await saveReadingProgress({
    uri,
    name: 'Capítulo 01.pdf',
    currentPage: 5,
    totalPages: 12,
  });

  const saved = await getSavedReading(uri);

  assert.equal(saved.name, 'Capítulo 01.pdf');
  assert.equal(saved.currentPage, 5);
  assert.equal(saved.totalPages, 12);
  assert.equal((await getSavedReadings()).length, 1);
});

test('arquivos diferentes com o mesmo nome permanecem separados', async () => {
  await saveReadingProgress({
    uri: 'file:///documentos/copia-A.pdf',
    name: 'Mesmo nome.pdf',
    currentPage: 1,
    totalPages: 4,
  });

  await saveReadingProgress({
    uri: 'file:///documentos/copia-B.pdf',
    name: 'Mesmo nome.pdf',
    currentPage: 2,
    totalPages: 8,
  });

  const readings = await getSavedReadings();

  assert.equal(readings.length, 2);
  assert.equal(
    new Set(readings.map((item) => item.uri)).size,
    2
  );
});

test('histórico continua ordenado pela última atualização', async () => {
  store.set(
    STORAGE_KEY,
    JSON.stringify([
      {
        uri: 'file:///documentos/antigo.pdf',
        name: 'Antigo.pdf',
        currentPage: 1,
        totalPages: 2,
        updatedAt: 1000,
      },
      {
        uri: 'file:///documentos/recente.pdf',
        name: 'Recente.pdf',
        currentPage: 9,
        totalPages: 10,
        updatedAt: 3000,
      },
      {
        uri: 'file:///documentos/meio.pdf',
        name: 'Meio.pdf',
        currentPage: 2,
        totalPages: 5,
        updatedAt: 2000,
      },
    ])
  );

  const readings = await getSavedReadings();

  assert.deepEqual(
    readings.map((item) => item.name),
    ['Recente.pdf', 'Meio.pdf', 'Antigo.pdf']
  );
});

test('nome salvo permanece disponível em leituras posteriores do storage', async () => {
  await saveReadingProgress({
    uri: 'file:///documentos/persistido.pdf',
    name: 'Contrato 2026.pdf',
    currentPage: 2,
    totalPages: 6,
  });

  const storedName = rawReadings()[0].name;

  store.set(
    STORAGE_KEY,
    JSON.stringify([
      {
        ...rawReadings()[0],
        currentPage: 4,
        updatedAt: Date.now() + 1,
      },
    ])
  );

  const saved = await getSavedReading(
    'file:///documentos/persistido.pdf'
  );

  assert.equal(storedName, 'Contrato 2026.pdf');
  assert.equal(saved.name, 'Contrato 2026.pdf');
  assert.equal(saved.currentPage, 4);
});

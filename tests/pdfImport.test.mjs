import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPickedAsset,
  isPdfTooLarge,
  MAX_PDF_SIZE_BYTES,
  shouldCopyPickerFileToCache,
} from '../src/utils/pdfImport.ts';

test('seleção cancelada não retorna arquivo', () => {
  assert.equal(
    getPickedAsset({ canceled: true, assets: null }),
    null
  );
  assert.equal(getPickedAsset(null), null);
  assert.equal(getPickedAsset(undefined), null);
});

test('seleção sem arquivos não retorna arquivo', () => {
  assert.equal(
    getPickedAsset({ canceled: false, assets: [] }),
    null
  );
});

test('arquivo selecionado é devolvido com nome e uri', () => {
  const asset = getPickedAsset({
    canceled: false,
    assets: [
      {
        name: 'Relatório final.pdf',
        uri: 'file:///cache/documento.pdf',
        size: 1024,
      },
    ],
  });

  assert.equal(asset.name, 'Relatório final.pdf');
  assert.equal(asset.uri, 'file:///cache/documento.pdf');
});

test('Android mantém o URI content:// do seletor', () => {
  assert.equal(shouldCopyPickerFileToCache('android'), false);
  assert.equal(shouldCopyPickerFileToCache('ios'), true);
  assert.equal(shouldCopyPickerFileToCache('web'), true);
});

test('limite de 100 MB é respeitado', () => {
  assert.equal(isPdfTooLarge(MAX_PDF_SIZE_BYTES), false);
  assert.equal(isPdfTooLarge(MAX_PDF_SIZE_BYTES - 1), false);
  assert.equal(isPdfTooLarge(MAX_PDF_SIZE_BYTES + 1), true);
  assert.equal(isPdfTooLarge(undefined), false);
  assert.equal(isPdfTooLarge(null), false);
});

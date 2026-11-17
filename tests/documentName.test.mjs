import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isInternalDocumentName,
  resolveDocumentName,
} from '../src/utils/documentName.ts';

test('nome simples é preservado', () => {
  assert.deepEqual(resolveDocumentName('relatorio.pdf'), {
    name: 'relatorio.pdf',
    usedFallback: false,
  });
});

test('espaços, acentos e caracteres especiais são preservados', () => {
  const original = 'Relatório de férias (2026) — versão final.pdf';

  assert.deepEqual(resolveDocumentName(original), {
    name: original,
    usedFallback: false,
  });
});

test('extensão .pdf é acrescentada quando ausente', () => {
  assert.deepEqual(resolveDocumentName('Contrato 2026'), {
    name: 'Contrato 2026.pdf',
    usedFallback: false,
  });
});

test('extensão em maiúsculas é preservada', () => {
  assert.deepEqual(resolveDocumentName('LEITURA.PDF'), {
    name: 'LEITURA.PDF',
    usedFallback: false,
  });
});

test('identificador interno msf: nunca é usado como nome', () => {
  for (const invalid of [
    'msf:123456',
    'MSF:123456',
    'msf%3A123456',
    'msf:123456.pdf',
  ]) {
    const result = resolveDocumentName(invalid);

    assert.equal(result.name, 'Documento PDF.pdf', invalid);
    assert.equal(result.usedFallback, true, invalid);
    assert.doesNotMatch(result.name, /msf/i, invalid);
    assert.equal(isInternalDocumentName(invalid), true, invalid);
  }
});

test('URIs internas nunca são usadas como nome', () => {
  const result = resolveDocumentName(
    'content://com.android.providers/media/documents/msf%3A42'
  );

  assert.equal(result.name, 'Documento PDF.pdf');
  assert.equal(result.usedFallback, true);
});

test('nomes nulos, vazios e inválidos usam fallback seguro', () => {
  for (const invalid of [null, undefined, '', '   ', '.pdf', 123]) {
    const result = resolveDocumentName(invalid);

    assert.equal(result.name, 'Documento PDF.pdf', String(invalid));
    assert.equal(result.usedFallback, true, String(invalid));
  }
});

test('caracteres de controle são removidos sem perder o nome', () => {
  assert.deepEqual(
    resolveDocumentName('C\u0000apítulo 1.pdf'),
    {
      name: 'Capítulo 1.pdf',
      usedFallback: false,
    }
  );
});

test('percentual legítimo no nome não é confundido com identificador', () => {
  assert.deepEqual(resolveDocumentName('Desconto 100%.pdf'), {
    name: 'Desconto 100%.pdf',
    usedFallback: false,
  });
});

test('nomes normais não são classificados como internos', () => {
  assert.equal(isInternalDocumentName('Minuta msf: anotações.pdf'), false);
  assert.equal(isInternalDocumentName('   '), false);
  assert.equal(isInternalDocumentName(undefined), false);
});

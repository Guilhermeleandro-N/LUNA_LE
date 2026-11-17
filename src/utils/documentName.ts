/**
 * Normaliza o nome exibido de um PDF importado.
 *
 * No Android, o seletor de arquivos do `expo-file-system` devolve URIs
 * `content://` cujo último segmento é um identificador opaco do MediaStore
 * (por exemplo, `msf:123456`). Esse identificador nunca deve ser usado como
 * nome visível do documento.
 */

const FALLBACK_NAME = 'Documento PDF.pdf';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // Nomes com '%' que não formam uma sequência válida são mantidos.
    return value;
  }
}

function cleanCandidate(rawName: unknown): string {
  if (typeof rawName !== 'string') {
    return '';
  }

  return rawName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function isInternalIdentifier(candidate: string): boolean {
  const decodedOnce = safeDecode(candidate);
  const decodedTwice = safeDecode(decodedOnce);

  return [candidate, decodedOnce, decodedTwice].some((value) =>
    /^msf:/i.test(value) || /^(?:content|file):\/\//i.test(value)
  );
}

function withPdfExtension(name: string): string {
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

export type DocumentNameResult = {
  name: string;
  usedFallback: boolean;
};

/**
 * Retorna um nome seguro para exibição/persistência.
 * Espaços, acentos e caracteres especiais são preservados.
 */
export function resolveDocumentName(rawName: unknown): DocumentNameResult {
  const candidate = cleanCandidate(rawName);

  if (candidate && !isInternalIdentifier(candidate)) {
    const stem = /\.pdf$/i.test(candidate)
      ? candidate.slice(0, -4)
      : candidate;

    if (stem.trim()) {
      return {
        name: withPdfExtension(candidate),
        usedFallback: false,
      };
    }
  }

  return {
    name: FALLBACK_NAME,
    usedFallback: true,
  };
}

/** Identifica nomes que são, na verdade, identificadores internos. */
export function isInternalDocumentName(rawName: unknown): boolean {
  const candidate = cleanCandidate(rawName);

  return Boolean(candidate) && isInternalIdentifier(candidate);
}

/** Limite máximo aceito na importação de PDFs (100 MB). */
export const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024;

type PickedAssetLike = {
  name?: string | null;
  uri: string;
  size?: number | null;
};

type PickResultLike = {
  canceled: boolean;
  assets?: PickedAssetLike[] | null;
};

/** Retorna o arquivo escolhido ou null quando o seletor é cancelado. */
export function getPickedAsset(
  result: PickResultLike | null | undefined
): PickedAssetLike | null {
  if (!result || result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

  return asset?.uri ? asset : null;
}

/**
 * No Android, o URI original (content://) precisa ser preservado: no Expo Go,
 * a cópia que o seletor grava no cache do host fica fora do sandbox do
 * expo-file-system e não pode ser lida. No iOS, a cópia no cache é necessária
 * para que o arquivo possa ser lido logo após a seleção.
 */
export function shouldCopyPickerFileToCache(platform: string): boolean {
  return platform !== 'android';
}

/** Valida o limite de tamanho mesmo quando o tamanho não é informado. */
export function isPdfTooLarge(
  size: number | null | undefined
): boolean {
  return (
    typeof size === 'number' &&
    Number.isFinite(size) &&
    size > MAX_PDF_SIZE_BYTES
  );
}

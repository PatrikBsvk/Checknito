export interface Operator {
  id: string;
  name: string;
  personal_number: string | null;
  created_at: string;
}

export const TRANSMISSION_MODELS = ['T-590', 'T-450', 'T-590 RS'] as const;
export type TransmissionModel = typeof TRANSMISSION_MODELS[number];

export interface Transmission {
  id: string;
  transmission_number: string;
  model: TransmissionModel | null; // null jen pro historická data před migrací
  operator_id: string;
  // Null = vozíky byly v pořádku. Not-null = HH:MM, kdy to operátor měl hotovo.
  completed_at: string | null;
  carts_missing: boolean;
  has_errors: boolean;
  errors: string[];
  photo_left: string;
  photo_right: string;
  created_by: string;
  created_at: string;
  archived: boolean;
  operators?: Operator;
}

export interface TransmissionForm {
  transmission_number: string;
  model: TransmissionModel | '';
  operator_id: string;
  completed_at: string | null;
  carts_missing: boolean;
  has_errors: boolean;
  errors: string[];
  files: [File, File];
}

/**
 * Katalog typů vad svárů. `code` je písmeno (A–I), `label` celý popisek.
 * DB sloupec `errors` je `string[]` a ukládá serializované entry ve tvaru
 *   "A) Studený svár: 4,5,10"   (s čísly svárů)
 *   "A) Studený svár"            (bez čísel, jen typ)
 *
 * Starší záznamy před touto změnou (např. "Chyba typu A") se zobrazí
 * v tooltipu / exportu as-is — backward compatible.
 */
export const ERROR_TYPES = [
  { code: 'A', label: 'Studený svár' },
  { code: 'B', label: 'Svár mimo' },
  { code: 'C', label: 'Vypórovaný svár' },
  { code: 'D', label: 'Hluboké zápaly kolem sváru' },
  { code: 'E', label: 'Propaly ve sváru' },
  { code: 'F', label: 'Trhliny ve sváru' },
  { code: 'G', label: 'Množství kuliček' },
  { code: 'H', label: 'Velikost sváru' },
  { code: 'I', label: 'Chybí svár' },
] as const;

export type ErrorTypeCode = (typeof ERROR_TYPES)[number]['code'];

/**
 * Normalizace vstupu čísel: "4, 5,  10" → "4,5,10".
 * Nechá jen číslice a čárky, sloučí duplicitní čárky, ořízne ty na kraji.
 */
export function normalizeErrorNumbers(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[^\d,]/g, '')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '');
}

/** Sestaví finální řetězec pro uložení do DB. */
export function formatErrorEntry(code: ErrorTypeCode, numbers: string): string {
  const type = ERROR_TYPES.find((t) => t.code === code);
  if (!type) return code;
  const prefix = `${type.code}) ${type.label}`;
  const nums = normalizeErrorNumbers(numbers);
  return nums ? `${prefix}: ${nums}` : prefix;
}

// Prefisso del sotto-percorso di deploy (GitHub Pages). In dev e su dominio
// root è una stringa vuota: i path pubblici restano identici all'originale.
export const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

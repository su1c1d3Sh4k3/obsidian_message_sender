/**
 * Normaliza uma data de nascimento para o formato YYYY-MM-DD (DATE do PostgreSQL).
 * Aceita formatos comuns: DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD,
 * DD.MM.YYYY, e datas Excel numéricas.
 * Retorna null se não conseguir parsear.
 */
export function normalizeBirthDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial date number
  if (typeof raw === "number") {
    return excelSerialToDate(raw);
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Try YYYY-MM-DD (ISO)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return buildDate(parseInt(isoMatch[1]), parseInt(isoMatch[2]), parseInt(isoMatch[3]));
  }

  // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]);
    const year = parseInt(dmyMatch[3]);
    // If day > 12, it's definitely DD/MM/YYYY
    // If month > 12, it's MM/DD/YYYY
    // Default to DD/MM/YYYY (Brazilian format)
    if (month > 12 && day <= 12) {
      return buildDate(year, day, month); // MM/DD/YYYY
    }
    return buildDate(year, month, day); // DD/MM/YYYY
  }

  // Try DD/MM/YY
  const dmyShortMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (dmyShortMatch) {
    const day = parseInt(dmyShortMatch[1]);
    const month = parseInt(dmyShortMatch[2]);
    let year = parseInt(dmyShortMatch[3]);
    year = year > 50 ? 1900 + year : 2000 + year;
    return buildDate(year, month, day);
  }

  return null;
}

function buildDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function excelSerialToDate(serial: number): string | null {
  if (serial < 1 || serial > 100000) return null;
  // Excel epoch: Jan 0, 1900 (with Lotus 123 bug for Feb 29, 1900)
  const utcDays = serial - 25569; // days from Unix epoch
  const ms = utcDays * 86400 * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  return buildDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para DD/MM/YYYY para exibição.
 */
export function formatDateBR(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

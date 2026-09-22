import Papa from 'papaparse';
export const encodeCsv = (data: Record<string, unknown>[]) => Papa.unparse(data, { escapeFormulae: true, newline: '\r\n' });
export const parseCsv = (text: string): string[][] => {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  return parsed.data;
};

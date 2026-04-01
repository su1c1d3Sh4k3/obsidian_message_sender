/**
 * Aplica máscara DD/MM/AAAA conforme o usuário digita.
 * Aceita apenas dígitos, insere barras automaticamente.
 */
export function applyDateMask(value: string): string {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Converte DD/MM/YYYY do input para o formato que o backend espera.
 * O backend normaliza qualquer formato, mas enviamos DD/MM/YYYY.
 */
export function dateInputToPayload(masked: string): string {
  return masked; // Backend normaliza via normalizeBirthDate()
}

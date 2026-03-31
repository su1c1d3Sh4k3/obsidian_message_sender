/**
 * Resolve spintax: {Olá|Oi|E aí} → sorteia uma opção
 * Resolve variáveis: {{nome}} → substitui pelo valor do contato
 */
export function resolveSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_, options: string) => {
    const choices = options.split("|");
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

export function resolveVariables(
  text: string,
  contact: Record<string, string | undefined>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return contact[key] ?? "";
  });
}

export function renderMessage(
  template: string,
  contact: Record<string, string | undefined>,
  useSpintax: boolean,
): string {
  let result = template;
  if (useSpintax) {
    result = resolveSpintax(result);
  }
  result = resolveVariables(result, contact);
  return result.trim();
}

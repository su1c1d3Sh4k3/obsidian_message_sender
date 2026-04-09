import { api } from "@/lib/api";

interface ExportContact {
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  phone: string;
  city: string | null;
  state: string | null;
  organization: string | null;
  birth_date: string | null;
  contact_tags?: Array<{ tags: { name: string } }>;
}

interface ContactsResponse {
  data: ExportContact[];
  pagination: { total: number; totalPages: number };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Busca todos os contatos e baixa como .xls */
export async function exportContacts() {
  const pageSize = 500;
  const contacts: ExportContact[] = [];
  let page = 1;
  // Loop até receber menos que pageSize (última página)
  // Proteção: máx 500 páginas (250k contatos)
  while (page <= 500) {
    const res = await api.get<ContactsResponse>(`/contacts?page=${page}&limit=${pageSize}`);
    const batch = res.data ?? [];
    contacts.push(...batch);
    console.log(`[export] page ${page}: ${batch.length} (total so far: ${contacts.length} / ${res.pagination?.total})`);
    if (batch.length < pageSize) break;
    page++;
  }

  const headers = [
    "Primeiro Nome",
    "Nome Completo",
    "Empresa",
    "Tag",
    "Número",
    "Cidade/Estado",
    "Data de Nascimento",
  ];

  const rows = contacts.map((c) => {
    const firstName = c.first_name ?? "";
    const fullName = c.display_name ?? [c.first_name, c.last_name].filter(Boolean).join(" ");
    const org = c.organization ?? "";
    const tag = c.contact_tags?.map((ct) => ct.tags.name).join(", ") ?? "";
    const phone = c.phone ?? "";
    const cityState = [c.city, c.state].filter(Boolean).join("/");
    const birth = c.birth_date
      ? new Date(c.birth_date).toLocaleDateString("pt-BR")
      : "";
    return [firstName, fullName, org, tag, phone, cityState, birth];
  });

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Contatos">
    <Table>
      <Row>
        ${headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("\n        ")}
      </Row>
      ${rows
        .map(
          (row) => `<Row>
        ${row.map((v) => `<Cell><Data ss:Type="String">${escapeXml(String(v))}</Data></Cell>`).join("\n        ")}
      </Row>`
        )
        .join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `Contatos_${today}.xls`;
  a.click();
  URL.revokeObjectURL(url);

  return contacts.length;
}

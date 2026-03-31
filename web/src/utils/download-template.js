/** Gera e baixa arquivo .xls com o template de importação */
export function downloadTemplate() {
    const headers = [
        "Primeiro Nome",
        "Nome Completo",
        "Empresa",
        "Tag",
        "Número",
        "Cidade/Estado",
    ];
    // Gera XML Spreadsheet (compatível com .xls)
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Contatos">
    <Table>
      <Row>
        ${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("\n        ")}
      </Row>
      <Row>
        <Cell><Data ss:Type="String">João</Data></Cell>
        <Cell><Data ss:Type="String">João da Silva</Data></Cell>
        <Cell><Data ss:Type="String">Empresa X</Data></Cell>
        <Cell><Data ss:Type="String">Lead Quente</Data></Cell>
        <Cell><Data ss:Type="String">5531999998888</Data></Cell>
        <Cell><Data ss:Type="String">Belo Horizonte/MG</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Modelo_Importacao_Contatos.xls";
    a.click();
    URL.revokeObjectURL(url);
}
//# sourceMappingURL=download-template.js.map
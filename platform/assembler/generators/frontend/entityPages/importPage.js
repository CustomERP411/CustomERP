function buildEntityImportPage({ entity, entityName, fieldDefs, escapeJsString, importBase }) {
  const base = importBase || '..';
  return `import { Link, useNavigate } from 'react-router-dom';
import ImportCsvTool from '${base}/components/tools/ImportCsvTool';

const fieldDefinitions = [
${fieldDefs}
];

export default function ${entityName}ImportPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import CSV — ${escapeJsString(entity.display_name || entityName)}</h1>
          <p className="text-sm text-slate-600">Use the template and follow the rules.</p>
        </div>
        <Link to="/${entity.slug}" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <ImportCsvTool
          entitySlug="${entity.slug}"
          fields={fieldDefinitions as any}
          onCancel={() => navigate('/${entity.slug}')}
          onDone={() => navigate('/${entity.slug}')}
        />
      </div>
    </div>
  );
}
`;
}

module.exports = { buildEntityImportPage };

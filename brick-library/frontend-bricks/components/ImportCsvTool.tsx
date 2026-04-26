import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import api from '../../services/api';
import { useToast } from '../ui/toast';

export interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  widget: string;
  required?: boolean;
  referenceEntity?: string;
  multiple?: boolean;
}

interface ImportCsvToolProps {
  entitySlug: string;
  fields: FieldDefinition[];
  onCancel: () => void;
  onDone?: () => void;
}

interface ImportResult {
  rowNumber: number;
  status: 'success' | 'error';
  action: 'create' | 'update';
  label: string;
  message: string;
}

export default function ImportCsvTool({ entitySlug, fields, onCancel, onDone }: ImportCsvToolProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const expectedHeaders = useMemo(() => {
    const fieldHeaders = fields
      .filter((f) => !['created_at', 'updated_at'].includes(f.name))
      .map((f) => f.name);
    return ['id', ...fieldHeaders];
  }, [fields]);

  const requiredHeaders = useMemo(() => {
    return fields.filter((f) => f.required).map((f) => f.name);
  }, [fields]);

  const failedResults = useMemo(() => importResults.filter((result) => result.status === 'error'), [importResults]);
  const successfulResults = useMemo(() => importResults.filter((result) => result.status === 'success'), [importResults]);
  const failureReport = useMemo(() => {
    if (failedResults.length === 0) return '';
    return [
      'CSV import failed rows for ' + entitySlug + ':',
      ...failedResults.map((result) => {
        return (
          'Row ' +
          result.rowNumber +
          ' (' +
          result.action +
          ', ' +
          result.label +
          '): ' +
          result.message
        );
      }),
    ].join('\n');
  }, [entitySlug, failedResults]);

  const downloadTemplate = () => {
    const header = expectedHeaders.join(',');
    const blob = new Blob([header + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entitySlug + '_template.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onFileSelected = (file: File) => {
    setFileName(file.name);
    setErrors([]);
    setWarnings([]);
    setRows([]);
    setImportResults([]);

    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const newErrors: string[] = [];
        const newWarnings: string[] = [];
        const parsedRows = result.data || [];

        const headers = (result.meta.fields || []).filter(Boolean) as string[];
        const unknownHeaders = headers.filter((h) => !expectedHeaders.includes(h));
        if (unknownHeaders.length > 0) {
          newWarnings.push('Unknown columns (will be ignored): ' + unknownHeaders.join(', '));
        }

        if (result.errors?.length) {
          newErrors.push(...result.errors.map((e) => e.message));
        }

        setErrors(newErrors);
        setWarnings(newWarnings);
        setRows(parsedRows);
      },
    });
  };

  const transformRow = (row: Record<string, any>) => {
    const out: Record<string, any> = {};
    const rawId = row['id'];
    if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
      out.id = String(rawId).trim();
    }

    for (const f of fields) {
      if (!expectedHeaders.includes(f.name)) continue;
      const raw = row[f.name];
      if (raw === undefined || raw === null || raw === '') continue;

      if (f.multiple) {
        out[f.name] = String(raw)
          .split(/[;|,]/g)
          .map((x) => String(x).trim())
          .filter(Boolean);
        continue;
      }

      if (['integer', 'decimal', 'number'].includes(f.type)) {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error('Field ' + f.name + ' must be a number');
        out[f.name] = n;
      } else if (f.type === 'boolean') {
        const v = String(raw).trim().toLowerCase();
        out[f.name] = v === 'true' || v === '1' || v === 'yes';
      } else {
        out[f.name] = raw;
      }
    }

    // Validate required fields for CREATE rows only
    if (!out.id) {
      for (const req of requiredHeaders) {
        const v = out[req];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
          throw new Error('Missing required field: ' + req);
        }
      }
    }

    return out;
  };

  const getRowLabel = (row: Record<string, any>, payload?: Record<string, any>) => {
    const source = payload || row;
    const value = source['sku'] || source['name'] || source['id'] || row['sku'] || row['name'] || row['id'];
    return value ? String(value) : 'no identifier';
  };

  const getErrorMessage = (e: any) => {
    const data = e?.response?.data;
    const fieldErrors = data?.field_errors || data?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      return Object.entries(fieldErrors)
        .map(([field, message]) => field + ': ' + String(message))
        .join('; ');
    }
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.message === 'string') return data.message;
    if (typeof data === 'string') return data;
    if (e?.message) return e.message;
    return 'Unknown error';
  };

  const copyFailureReport = async () => {
    if (!failureReport) return;
    try {
      await navigator.clipboard.writeText(failureReport);
      toast({ title: 'Error report copied', variant: 'success' });
    } catch {
      toast({ title: 'Could not copy error report', variant: 'error' });
    }
  };

  const importRows = async () => {
    if (rows.length === 0) {
      toast({ title: 'No rows to import', variant: 'warning' });
      return;
    }
    if (errors.length > 0) {
      toast({ title: 'Fix CSV errors before importing', variant: 'error' });
      return;
    }

    setIsImporting(true);
    setImportResults([]);
    setProgress({ done: 0, total: rows.length });
    try {
      let done = 0;
      const nextResults: ImportResult[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 2;
        let action: ImportResult['action'] = 'create';
        let label = getRowLabel(row);
        try {
          const payload = transformRow(row);
          action = payload.id ? 'update' : 'create';
          label = getRowLabel(row, payload);
          if (payload.id) {
            const id = String(payload.id);
            delete payload.id;
            try {
              await api.put('/' + entitySlug + '/' + id, payload);
            } catch (e: any) {
              if (e?.response?.status === 404) {
                await api.post('/' + entitySlug, payload);
              } else {
                throw e;
              }
            }
          } else {
            await api.post('/' + entitySlug, payload);
          }
          nextResults.push({ rowNumber, status: 'success', action, label, message: 'Imported' });
        } catch (e: any) {
          nextResults.push({ rowNumber, status: 'error', action, label, message: getErrorMessage(e) });
        }
        done += 1;
        setProgress({ done, total: rows.length });
        setImportResults([...nextResults]);
      }

      const failures = nextResults.filter((result) => result.status === 'error').length;
      const successes = nextResults.length - failures;
      toast({
        title: failures ? 'Import completed with errors' : 'Import completed',
        description: String(successes) + ' imported, ' + String(failures) + ' failed',
        variant: failures ? 'warning' : 'success',
      });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e?.message || 'Unknown error', variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">How to import</div>
        <ul className="mt-1 list-disc pl-5">
          <li>Download the template to get correct column headers.</li>
          <li>
            <code>id</code> column is optional. If present → update; if blank → create.
          </li>
          <li>
            For multi-reference fields (like <code>location_ids</code>), separate IDs with <code>;</code>.
          </li>
        </ul>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-2 inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
        >
          Download Template CSV
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
          }}
          className="mt-1 block w-full text-sm"
        />
        {fileName ? <div className="mt-1 text-xs text-slate-500">Selected: {fileName}</div> : null}
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-semibold">Heads up</div>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-semibold">CSV errors</div>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Preview</div>
            <div className="text-xs text-slate-500">{rows.length} rows</div>
          </div>
          <div className="mt-2 max-h-44 overflow-auto text-xs">
            <pre className="whitespace-pre-wrap">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
          </div>
        </div>
      ) : null}

      {importResults.length > 0 ? (
        <div className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">Import results</div>
              <div className="text-xs text-slate-500">
                {successfulResults.length} imported, {failedResults.length} failed
              </div>
            </div>
            {failedResults.length > 0 ? (
              <button
                type="button"
                onClick={copyFailureReport}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
              >
                Copy error report
              </button>
            ) : null}
          </div>

          <div className="mt-3 max-h-64 overflow-auto rounded-md border">
            {importResults.map((result) => (
              <div
                key={result.rowNumber}
                className={
                  'border-b px-3 py-2 last:border-b-0 ' +
                  (result.status === 'success' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900')
                }
              >
                <div className="font-medium">
                  Row {result.rowNumber}: {result.status === 'success' ? 'Imported' : 'Failed'} ({result.action})
                </div>
                <div className="text-xs">
                  {result.label} - {result.message}
                </div>
              </div>
            ))}
          </div>

          {failedResults.length > 0 ? (
            <textarea
              className="mt-3 h-28 w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800"
              readOnly
              value={failureReport}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        {isImporting ? (
          <div className="text-sm text-slate-600">
            Importing… {progress.done}/{progress.total}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Excel tip: export as CSV, then import here.</div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            disabled={isImporting}
          >
            Cancel
          </button>
          {importResults.length > 0 && !isImporting && onDone ? (
            <button
              type="button"
              onClick={onDone}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Done
            </button>
          ) : null}
          <button
            type="button"
            onClick={importRows}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={isImporting}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}



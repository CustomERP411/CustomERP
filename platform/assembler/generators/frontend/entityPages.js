function buildEntityListPage({
  entity,
  entityName,
  fieldDefs,
  tableColumns,
  enableSearch,
  enableCsvImport,
  enableCsvExport,
  enablePrint,
  enableReceive,
  enableQuickReceive,
  enableAdjust,
  enableIssue,
  enableQuickIssue,
  issueLabel,
  canTransfer,
  enableQrLabels,
  enableBulkActions,
  enableBulkDelete,
  enableBulkUpdate,
  bulkUpdateFields,
  escapeJsString,
  importBase,
}) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import Modal from '${base}/components/ui/Modal';
import { useToast } from '${base}/components/ui/toast';
${enableBulkUpdate ? `import DynamicForm from '${base}/components/DynamicForm';` : ''}

interface ${entityName}Item {
  id: string;
  [key: string]: any;
}

interface DeleteDependentPreview {
  id: string;
  display: string;
}

interface DeleteDependent {
  entity: string;
  via?: string[];
  count: number;
  preview: DeleteDependentPreview[];
}

interface DeleteBlockedState {
  message: string;
  dependents: DeleteDependent[];
}

type SortDirection = 'asc' | 'desc';
interface SortSpec {
  key: string;
  direction: SortDirection;
}

const fieldDefinitions = [
${fieldDefs}
];

const tableColumns = [
${tableColumns}
];

const FIELD_BY_NAME: Record<string, any> = Object.fromEntries(fieldDefinitions.map((f: any) => [f.name, f])) as Record<string, any>;
${enableBulkUpdate ? `const BULK_UPDATE_FIELD_NAMES = ${JSON.stringify(bulkUpdateFields, null, 2)} as const;
const BULK_UPDATE_FIELDS = BULK_UPDATE_FIELD_NAMES
  .map((name) => FIELD_BY_NAME[String(name)])
  .filter(Boolean)
  .map((f: any) => ({ ...f, required: false })) as any[];
` : ''}
const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayField])) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

const ISSUE_LABEL = '${escapeJsString(issueLabel || 'Sell')}' as const;

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<${entityName}Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null);
  const [refMaps, setRefMaps] = useState<Record<string, Record<string, string>>>({});
${enableSearch ? `  const [search, setSearch] = useState('');` : ''}
  const [sorts, setSorts] = useState<SortSpec[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
${enableBulkActions ? `  const [selectedIds, setSelectedIds] = useState<string[]>([]);` : ''}
${enableBulkUpdate ? `  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);` : ''}

  const fetchItems = async () => {
    try {
      const res = await api.get('/${entity.slug}');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      toast({ title: 'Failed to load', description: 'Could not load ${entity.slug}', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const referenceSlugs = useMemo(() => {
    const slugs = tableColumns
      .map((c: any) => FIELD_BY_NAME[c.key]?.referenceEntity)
      .filter(Boolean) as string[];
    return Array.from(new Set(slugs));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (referenceSlugs.length === 0) return;
      const entries = await Promise.all(
        referenceSlugs.map(async (slug) => {
          try {
            const res = await api.get('/' + slug);
            const rows = Array.isArray(res.data) ? res.data : [];
            const map: Record<string, string> = {};
            for (const r of rows) {
              if (!r?.id) continue;
              map[String(r.id)] = getEntityDisplay(slug, r);
            }
            return [slug, map] as const;
          } catch (e) {
            console.error('Failed to load reference list:', slug, e);
            return [slug, {} as Record<string, string>] as const;
          }
        })
      );
      if (cancelled) return;
      setRefMaps(Object.fromEntries(entries));
    };
    run();
    return () => { cancelled = true; };
  }, [referenceSlugs.join('|')]);

  const getCellDisplay = (item: any, key: string) => {
    const def = FIELD_BY_NAME[key];
    const raw = item?.[key];

    if (def?.referenceEntity) {
      const map = refMaps[def.referenceEntity] || {};
      if (def.multiple) {
        const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return arr.map((id: any) => map[String(id)] || String(id)).join(', ');
      }
      return map[String(raw)] || String(raw ?? '');
    }

    if (Array.isArray(raw)) return raw.join('; ');
    return String(raw ?? '');
  };

  const getSortValue = (item: any, key: string) => {
    const def = FIELD_BY_NAME[key];
    const raw = item?.[key];
    const type = String(def?.type || '');

    if (def?.referenceEntity) return getCellDisplay(item, key).toLowerCase();
    if (Array.isArray(raw)) return raw.join('; ');
    if (type === 'boolean') return raw ? 1 : 0;
    if (['integer', 'decimal', 'number'].includes(type)) {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    if (type === 'date' || type === 'datetime') {
      const t = new Date(String(raw)).getTime();
      return Number.isFinite(t) ? t : null;
    }
    return String(raw ?? '');
  };

  const compare = (a: any, b: any) => {
    if (a === b) return 0;
    if (a === null || a === undefined || a === '') return 1;
    if (b === null || b === undefined || b === '') return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  };

${enableSearch ? `  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      tableColumns.some((c: any) => getCellDisplay(item, c.key).toLowerCase().includes(term))
    );
  }, [items, search, refMaps]);` : `  const filteredItems = items;`}

  const sortedItems = useMemo(() => {
    const indexed = filteredItems.map((it: any, idx: number) => ({ it, idx }));
    if (sorts.length === 0) return indexed.map((x) => x.it);
    indexed.sort((a, b) => {
      for (const s of sorts) {
        const cmp = compare(getSortValue(a.it, s.key), getSortValue(b.it, s.key));
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
      }
      return a.idx - b.idx;
    });
    return indexed.map((x) => x.it);
  }, [filteredItems, sorts, refMaps]);

  useEffect(() => {
    setPage(0);
  }, [pageSize${enableSearch ? ', search' : ''}]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedItems.length / pageSize) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [sortedItems.length, pageSize, page]);

  const pageStart = page * pageSize;
  const pageEnd = Math.min(sortedItems.length, pageStart + pageSize);
  const pageItems = useMemo(() => sortedItems.slice(pageStart, pageEnd), [sortedItems, pageStart, pageEnd]);

${enableBulkActions ? `  const selectedSet = new Set(selectedIds);
  const pageAllSelected = pageItems.length > 0 && pageItems.every((it: any) => selectedSet.has(String(it.id)));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectPage = () => {
    const ids = pageItems.map((it: any) => String(it.id));
    setSelectedIds((prev) => {
      const set = new Set(prev);
      const all = ids.every((id) => set.has(id));
      if (all) {
        ids.forEach((id) => set.delete(id));
      } else {
        ids.forEach((id) => set.add(id));
      }
      return Array.from(set);
    });
  };

  const clearSelection = () => setSelectedIds([]);
` : ''}
${enableBulkDelete ? `
  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm('Delete ' + selectedIds.length + ' record(s)?')) return;
    try {
      for (const id of selectedIds) {
        try {
          await api.delete('/${entity.slug}/' + id);
        } catch (err: any) {
          const status = err?.response?.status;
          const payload = err?.response?.data;
          if (status === 409 && payload?.dependents) {
            setDeleteBlocked({
              message: payload.error || 'Cannot delete: record is referenced by other records',
              dependents: payload.dependents,
            });
            toast({ title: 'Cannot delete', description: payload.error || 'This record is referenced by other records', variant: 'warning' });
            return;
          }
          throw err;
        }
      }
      toast({ title: 'Deleted', description: selectedIds.length + ' record(s)', variant: 'success' });
      clearSelection();
      fetchItems();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      toast({ title: 'Bulk delete failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };
` : ''}
${enableBulkUpdate ? `
  const applyBulkUpdate = async (data: any) => {
    if (selectedIds.length === 0) {
      toast({ title: 'No selection', description: 'Select records first', variant: 'warning' });
      return;
    }
    if (!data || Object.keys(data).length === 0) {
      toast({ title: 'Nothing to update', description: 'Fill at least one field', variant: 'warning' });
      return;
    }

    try {
      for (const id of selectedIds) {
        await api.put('/${entity.slug}/' + id, data);
      }
      toast({ title: 'Updated', description: selectedIds.length + ' record(s)', variant: 'success' });
      setBulkUpdateOpen(false);
      clearSelection();
      fetchItems();
    } catch (err: any) {
      console.error('Bulk update failed:', err);
      toast({ title: 'Bulk update failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };
` : ''}

  const toggleSort = (key: string) => {
    setSorts((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return [...prev, { key, direction: 'asc' }];
      const next = [...prev];
      next[idx] = { ...next[idx], direction: next[idx].direction === 'asc' ? 'desc' : 'asc' };
      return next;
    });
  };

  const clearSort = () => setSorts([]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete('/${entity.slug}/' + id);
      toast({ title: 'Deleted', variant: 'success' });
      fetchItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      if (status === 409 && payload?.dependents) {
        setDeleteBlocked({
          message: payload.error || 'Cannot delete: record is referenced by other records',
          dependents: payload.dependents,
        });
        toast({ title: 'Cannot delete', description: payload.error || 'This record is referenced by other records', variant: 'warning' });
        return;
      }
      console.error('Delete failed:', err);
      toast({ title: 'Delete failed', description: payload?.error || 'Could not delete record', variant: 'error' });
    }
  };

${enableCsvExport ? `  const exportCsv = () => {
    const headers = ['id', ...fieldDefinitions.map((f: any) => f.name)];
    const normalize = (val: any) => {
      if (Array.isArray(val)) return val.join(';');
      return val;
    };
    const escapeCsv = (val: any) => {
      const s = String(normalize(val) ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [
      headers.join(','),
      ...sortedItems.map((it: any) => headers.map((h: string) => escapeCsv(it[h])).join(',')),
    ];
    const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '${entity.slug}.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported CSV', variant: 'success' });
  };` : ''}

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${escapeJsString(entity.display_name || entityName)}</h1>
          <p className="text-sm text-slate-600">Manage records with sorting, pagination, and tools.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
${enableCsvImport ? `          <Link
            to="/${entity.slug}/import"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Import CSV
          </Link>` : ''}
${enableCsvExport ? `          <button
            onClick={exportCsv}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Export CSV
          </button>` : ''}
${enablePrint ? `          <button
            onClick={() => window.print()}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Print / PDF
          </button>` : ''}
${enableReceive ? `          <Link
            to="/${entity.slug}/receive"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Receive
          </Link>` : ''}
${enableAdjust ? `          <Link
            to="/${entity.slug}/adjust"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Adjust
          </Link>` : ''}
${enableIssue ? `          <Link
            to="/${entity.slug}/issue"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {ISSUE_LABEL}
          </Link>` : ''}
${canTransfer ? `          <Link
            to="/${entity.slug}/transfer"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Transfer
          </Link>` : ''}
${enableQrLabels ? `          <Link
            to="/${entity.slug}/labels"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Labels
          </Link>` : ''}
          <Link
            to="/${entity.slug}/new"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add New
          </Link>
        </div>
      </div>

${enableSearch ? `      <div className="no-print">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
        />
      </div>` : ''}

${enableBulkActions ? `      <div className="no-print rounded-lg border bg-white p-3 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{selectedIds.length}</span> selected
        </div>
        <div className="flex flex-wrap gap-2">
${enableBulkUpdate ? `          <button
            type="button"
            onClick={() => setBulkUpdateOpen(true)}
            disabled={selectedIds.length === 0}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Bulk update
          </button>` : ''}
${enableBulkDelete ? `          <button
            type="button"
            onClick={bulkDelete}
            disabled={selectedIds.length === 0}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            Bulk delete
          </button>` : ''}
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedIds.length === 0}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>` : ''}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{sortedItems.length === 0 ? 0 : pageStart + 1}</span>
          {' '}to <span className="font-medium text-slate-900">{pageEnd}</span> of{' '}
          <span className="font-medium text-slate-900">{sortedItems.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sorts.length ? (
            <button
              type="button"
              onClick={clearSort}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Clear sorting
            </button>
          ) : null}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border px-2 py-2 text-sm"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(Math.ceil(sortedItems.length / pageSize) - 1, p + 1))}
              disabled={pageEnd >= sortedItems.length}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!deleteBlocked}
        title="Cannot delete"
        onClose={() => setDeleteBlocked(null)}
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-700">{deleteBlocked?.message}</div>
          <div className="space-y-3">
            {deleteBlocked?.dependents?.map((d) => (
              <div key={d.entity} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-900">{d.entity}</div>
                  <div className="text-xs text-slate-500">{d.count} record(s)</div>
                </div>
                {d.via?.length ? (
                  <div className="mt-1 text-xs text-slate-500">via {d.via.join(', ')}</div>
                ) : null}
                {d.preview?.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                    {d.preview.map((p) => (
                      <li key={p.id}>{p.display}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </Modal>

${enableBulkUpdate ? `      <Modal
        isOpen={bulkUpdateOpen}
        title="Bulk update"
        onClose={() => setBulkUpdateOpen(false)}
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-700">
            Updating <span className="font-semibold text-slate-900">{selectedIds.length}</span> record(s). Leave a field blank to keep it unchanged.
          </div>
          <DynamicForm
            fields={BULK_UPDATE_FIELDS as any}
            initialData={{}}
            onSubmit={applyBulkUpdate}
            onCancel={() => setBulkUpdateOpen(false)}
          />
        </div>
      </Modal>
` : ''}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
${enableBulkActions ? `              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase no-print">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={toggleSelectPage}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all on this page"
                />
              </th>` : ''}
              {tableColumns.map((col: any) => {
                const sortIndex = sorts.findIndex((s) => s.key === col.key);
                const dir = sortIndex >= 0 ? sorts[sortIndex].direction : null;
                return (
                  <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                      title="Click to add/toggle sorting. Earlier sorts have higher priority."
                    >
                      <span>{col.label}</span>
                      {sortIndex >= 0 ? (
                        <span className="text-[10px] text-slate-400">
                          {dir === 'asc' ? '▲' : '▼'}{sortIndex + 1}
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th className="px-6 py-3 text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pageItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
${enableBulkActions ? `                <td className="px-6 py-4 whitespace-nowrap text-sm no-print">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(String(item.id))}
                    onChange={() => toggleSelectOne(String(item.id))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={'Select ' + String(item.id)}
                  />
                </td>` : ''}
                {tableColumns.map((col: any) => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getCellDisplay(item, col.key)}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm no-print">
                  <div className="flex justify-end gap-3">
${enableQuickReceive ? `                    <Link
                      to={'/${entity.slug}/receive?itemId=' + item.id}
                      className="text-emerald-700 hover:underline"
                    >
                      Receive
                    </Link>` : ''}
${enableQuickIssue ? `                    <Link
                      to={'/${entity.slug}/issue?itemId=' + item.id}
                      className="text-emerald-700 hover:underline"
                    >
                      {ISSUE_LABEL}
                    </Link>` : ''}
                    <Link to={'/${entity.slug}/' + item.id + '/edit'} className="text-blue-600 hover:underline">Edit</Link>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedItems.length === 0 && (
              <tr><td colSpan={tableColumns.length + 1${enableBulkActions ? ' + 1' : ''}} className="px-6 py-6 text-center text-gray-500">No items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}

function buildEntityFormPage({ entity, entityName, fieldDefs, childSections, escapeJsString, importBase }) {
  const hasChildren = Array.isArray(childSections) && childSections.length > 0;
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '${base}/services/api';
import DynamicForm from '${base}/components/DynamicForm';
import Modal from '${base}/components/ui/Modal';
import { useToast } from '${base}/components/ui/toast';
import { ENTITIES } from '${base}/config/entities';

const fieldDefinitions = [
${fieldDefs}
];

const CHILD_SECTIONS = ${JSON.stringify(childSections || [], null, 2)} as const;
const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayField])) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}FormPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id;
  const isEdit = !!id;
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [initialData, setInitialData] = useState<Record<string, any>>({});
  const [childItemsBySlug, setChildItemsBySlug] = useState<Record<string, any[]>>({});
  const [childLoading, setChildLoading] = useState(false);
  const [childRefMaps, setChildRefMaps] = useState<Record<string, Record<string, string>>>({});
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [childModalSection, setChildModalSection] = useState<any | null>(null);
  const [childModalMode, setChildModalMode] = useState<'create' | 'edit'>('create');
  const [childModalInitial, setChildModalInitial] = useState<any>({});

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/${entity.slug}/' + id);
        if (cancelled) return;
        setInitialData(res.data || {});
      } catch (e) {
        toast({ title: 'Failed to load', description: 'Could not load record', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const loadChildRefs = async (sections: any[]) => {
    const refSlugs = new Set<string>();
    for (const s of sections) {
      const cols = Array.isArray(s?.columns) ? s.columns : [];
      for (const c of cols) {
        if (typeof c?.referenceEntity === 'string' && c.referenceEntity.trim()) refSlugs.add(c.referenceEntity.trim());
      }
    }
    if (refSlugs.size === 0) return;
    try {
      const entries = await Promise.all(
        Array.from(refSlugs).map(async (slug) => {
          try {
            const res = await api.get('/' + slug);
            const rows = Array.isArray(res.data) ? res.data : [];
            const map: Record<string, string> = {};
            for (const r of rows) {
              if (!r?.id) continue;
              map[String(r.id)] = getEntityDisplay(slug, r);
            }
            return [slug, map] as const;
          } catch {
            return [slug, {} as Record<string, string>] as const;
          }
        })
      );
      setChildRefMaps(Object.fromEntries(entries));
    } catch {
      // ignore
    }
  };

  const fetchChildItems = async () => {
    if (!isEdit) return;
    if (!CHILD_SECTIONS.length) return;
    setChildLoading(true);
    try {
      const results = await Promise.all(
        CHILD_SECTIONS.map(async (s: any) => {
          const slug = String(s.childSlug || '');
          const fk = String(s.foreignKey || '');
          if (!slug || !fk) return [slug, []] as const;
          const res = await api.get('/' + slug, { params: { [fk]: id } });
          return [slug, Array.isArray(res.data) ? res.data : []] as const;
        })
      );
      setChildItemsBySlug(Object.fromEntries(results));
      await loadChildRefs(CHILD_SECTIONS as any);
    } catch (e) {
      toast({ title: 'Failed to load line items', variant: 'error' });
    } finally {
      setChildLoading(false);
    }
  };

  useEffect(() => {
    fetchChildItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const handleSubmit = async (data: any) => {
    try {
      if (isEdit) {
        await api.put('/${entity.slug}/' + id, data);
        toast({ title: 'Saved', description: 'Record updated', variant: 'success' });
      } else {
        await api.post('/${entity.slug}', data);
        toast({ title: 'Created', description: 'Record created', variant: 'success' });
      }
      navigate('/${entity.slug}');
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    }
  };

  const getChildCellDisplay = (section: any, item: any, col: any) => {
    const key = String(col?.key || '');
    const raw = item?.[key];
    const refEntity = col?.referenceEntity;
    if (refEntity) {
      const map = childRefMaps[String(refEntity)] || {};
      if (col?.multiple) {
        const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return arr.map((v: any) => map[String(v)] || String(v)).join(', ');
      }
      return map[String(raw)] || String(raw ?? '');
    }
    if (Array.isArray(raw)) return raw.join('; ');
    return String(raw ?? '');
  };

  const openChildCreate = (section: any) => {
    setChildModalSection(section);
    setChildModalMode('create');
    setChildModalInitial({});
    setChildModalOpen(true);
  };

  const openChildEdit = (section: any, item: any) => {
    setChildModalSection(section);
    setChildModalMode('edit');
    setChildModalInitial(item || {});
    setChildModalOpen(true);
  };

  const submitChild = async (data: any) => {
    const section = childModalSection;
    if (!section) return;
    const childSlug = String(section.childSlug || '');
    const fk = String(section.foreignKey || '');
    if (!childSlug || !fk) return;
    try {
      const payload: any = { ...data };
      // Always enforce FK to the parent
      payload[fk] = id;

      if (childModalMode === 'edit') {
        const childId = childModalInitial?.id;
        await api.put('/' + childSlug + '/' + childId, payload);
        toast({ title: 'Saved', description: 'Line item updated', variant: 'success' });
      } else {
        await api.post('/' + childSlug, payload);
        toast({ title: 'Created', description: 'Line item added', variant: 'success' });
      }
      setChildModalOpen(false);
      setChildModalSection(null);
      await fetchChildItems();
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  const deleteChild = async (section: any, childId: string) => {
    const childSlug = String(section?.childSlug || '');
    if (!childSlug) return;
    if (!confirm('Delete this line item?')) return;
    try {
      await api.delete('/' + childSlug + '/' + childId);
      toast({ title: 'Deleted', variant: 'success' });
      await fetchChildItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || 'Delete failed';
      if (status === 409) {
        toast({ title: 'Cannot delete', description: msg, variant: 'warning' });
      } else {
        toast({ title: 'Delete failed', description: msg, variant: 'error' });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit' : 'Create'} ${escapeJsString(entity.display_name || entityName)}</h1>
          <p className="text-sm text-slate-600">Fill in the fields and save.</p>
        </div>
        <Link to="/${entity.slug}" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <DynamicForm
              fields={fieldDefinitions as any}
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/${entity.slug}')}
            />
          </div>

          {CHILD_SECTIONS.length ? (
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Line items</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Add and manage child rows linked to this record.
                  </div>
                </div>
                {!isEdit ? (
                  <div className="text-xs text-slate-500">Save this record first to add line items.</div>
                ) : childLoading ? (
                  <div className="text-xs text-slate-500">Loading…</div>
                ) : null}
              </div>

              {CHILD_SECTIONS.map((section: any) => {
                const childSlug = String(section.childSlug || '');
                const rows = childItemsBySlug[childSlug] || [];
                const cols = Array.isArray(section.columns) ? section.columns : [];
                return (
                  <div key={childSlug} className="rounded-lg border bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                      <button
                        type="button"
                        onClick={() => openChildCreate(section)}
                        disabled={!isEdit}
                        className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            {cols.map((c: any) => (
                              <th key={String(c.key)} className="px-4 py-2 text-left font-semibold">
                                {c.label}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((r: any) => (
                            <tr key={String(r.id)}>
                              {cols.map((c: any) => (
                                <td key={String(c.key)} className="px-4 py-2">
                                  {getChildCellDisplay(section, r, c)}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                <div className="flex justify-end gap-3">
                                  <button type="button" onClick={() => openChildEdit(section, r)} className="text-blue-600 hover:underline">
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => deleteChild(section, String(r.id))} className="text-red-600 hover:underline">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={cols.length + 1} className="px-4 py-4 text-center text-slate-500">
                                No line items yet
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {childModalOpen && childModalSection ? (
        <Modal isOpen={childModalOpen} onClose={() => setChildModalOpen(false)} title={(childModalMode === 'edit' ? 'Edit' : 'Add') + ' ' + String(childModalSection.label || 'Item')}>
          <DynamicForm
            fields={(childModalSection.formFields || []) as any}
            initialData={childModalMode === 'edit' ? childModalInitial : {}}
            onSubmit={submitChild}
            onCancel={() => setChildModalOpen(false)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
`;
}

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

function buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}ReceivePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    const pre = searchParams.get('itemId');
    if (pre) setItemId(String(pre));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    try {
      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      movement[INV.fields.type] = INV.movement_types.receive;
      movement[INV.fields.qty] = quantity;
      if (locationId) movement[INV.fields.location] = locationId;
      if (movementDate) movement[INV.fields.date] = movementDate;
      if (referenceNumber) movement[INV.fields.reference_number] = referenceNumber;
      if (note) movement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, movement);

      // Update cached quantity on the main entity (if it exists)
      const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
      const patch: any = {};
      patch[INV.quantity_field] = current + quantity;

      if (locationId && ENTITY_LOCATION_FIELD) {
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(locationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = locationId;
        }
      }

      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: 'Stock received', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Receive failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receive stock</h1>
          <p className="text-sm text-slate-600">Creates a movement + updates quantity.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference # (optional)</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Receive
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildIssuePage({ entity, entityName, invCfg, entityLocationField, issueLabel, escapeJsString, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;
const ISSUE_LABEL = '${escapeJsString(issueLabel || 'Sell')}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}IssuePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    const pre = searchParams.get('itemId');
    if (pre) setItemId(String(pre));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
    const nextQty = current - quantity;
    if (!(INV.issue && INV.issue.allow_negative_stock) && nextQty < 0) {
      toast({
        title: 'Insufficient stock',
        description: 'This would make stock negative. Adjust stock or enable negative stock for this operation.',
        variant: 'warning',
      });
      return;
    }

    try {
      const mode = String((INV as any).quantity_mode || 'delta');
      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      movement[INV.fields.type] = INV.movement_types.issue || 'OUT';
      movement[INV.fields.qty] = mode === 'delta' ? -quantity : quantity;
      if (locationId) movement[INV.fields.location] = locationId;
      if (movementDate) movement[INV.fields.date] = movementDate;
      if (referenceNumber) movement[INV.fields.reference_number] = referenceNumber;
      if (note) movement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, movement);

      const patch: any = {};
      patch[INV.quantity_field] = nextQty;

      if (locationId && ENTITY_LOCATION_FIELD) {
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(locationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = locationId;
        }
      }

      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: ISSUE_LABEL + ' recorded', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: ISSUE_LABEL + ' failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ISSUE_LABEL}</h1>
          <p className="text-sm text-slate-600">Creates a movement + updates quantity.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference # (optional)</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {ISSUE_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildAdjustPage({ entity, entityName, invCfg, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}AdjustPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [qtyChange, setQtyChange] = useState<number>(0);
  const [reasonCode, setReasonCode] = useState<string>(INV.adjust.reason_codes?.[0] || 'COUNT');
  const [note, setNote] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/' + ENTITY_SLUG);
        if (cancelled) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      toast({ title: 'Quantity change must be non-zero', description: 'Use + for increase, - for decrease', variant: 'warning' });
      return;
    }

    try {
      const mode = String((INV as any).quantity_mode || 'delta');
      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      let movementType = INV.movement_types.adjust;
      let movementQty: number = qtyChange;
      if (mode !== 'delta') {
        movementQty = Math.abs(qtyChange);
        if (qtyChange >= 0) {
          movementType = (INV.movement_types.adjust_in || INV.movement_types.receive);
        } else {
          movementType = (INV.movement_types.adjust_out || INV.movement_types.issue || INV.movement_types.transfer_out || 'OUT');
        }
      }
      movement[INV.fields.type] = movementType;
      movement[INV.fields.qty] = movementQty;
      movement[INV.fields.date] = movementDate;
      movement[INV.fields.reason] = reasonCode + (note ? (': ' + note) : '');

      await api.post('/' + INV.movement_entity, movement);

      const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
      const patch: any = {};
      patch[INV.quantity_field] = current + qtyChange;
      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: 'Stock adjusted', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Adjust failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adjust stock</h1>
          <p className="text-sm text-slate-600">Use a quantity change (+/-) and a reason code (for non-sales corrections).</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity change</label>
            <input type="number" value={qtyChange} onChange={(e) => setQtyChange(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
            <div className="mt-1 text-xs text-slate-500">Example: -5 (shrinkage), +10 (found stock)</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason code</label>
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full rounded border px-3 py-2">
              {(INV.adjust.reason_codes || []).map((rc) => (
                <option key={rc} value={rc}>{rc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Apply adjustment
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}TransferPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!fromLocationId || !toLocationId) {
      toast({ title: 'Select both locations', variant: 'warning' });
      return;
    }
    if (String(fromLocationId) === String(toLocationId)) {
      toast({ title: 'Invalid transfer', description: 'From and To locations must be different', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    try {
      const mode = String((INV as any).quantity_mode || 'delta');
      const outMovement: any = {};
      outMovement[INV.fields.item_ref] = itemId;
      outMovement[INV.fields.type] = INV.movement_types.transfer_out;
      outMovement[INV.fields.qty] = mode === 'delta' ? -quantity : quantity;
      outMovement[INV.fields.location] = fromLocationId;
      outMovement[INV.fields.from_location] = fromLocationId;
      outMovement[INV.fields.to_location] = toLocationId;
      outMovement[INV.fields.date] = movementDate;
      if (note) outMovement[INV.fields.reason] = note;

      const inMovement: any = {};
      inMovement[INV.fields.item_ref] = itemId;
      inMovement[INV.fields.type] = INV.movement_types.transfer_in;
      inMovement[INV.fields.qty] = quantity;
      inMovement[INV.fields.location] = toLocationId;
      inMovement[INV.fields.from_location] = fromLocationId;
      inMovement[INV.fields.to_location] = toLocationId;
      inMovement[INV.fields.date] = movementDate;
      if (note) inMovement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, outMovement);
      await api.post('/' + INV.movement_entity, inMovement);

      // Keep location references updated (best-effort)
      if (ENTITY_LOCATION_FIELD) {
        const patch: any = {};
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(fromLocationId), String(toLocationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = toLocationId;
        }
        await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);
      }

      toast({ title: 'Transfer recorded', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Transfer failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transfer stock</h1>
          <p className="text-sm text-slate-600">Records an OUT and an IN movement (net zero).</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From location</label>
            <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To location</label>
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildLabelsPage({ entity, entityName, labelsCfg, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const LABELS = ${JSON.stringify(labelsCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}LabelsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/' + ENTITY_SLUG);
        if (cancelled) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => {
    const set = new Set(selectedIds.map(String));
    return items.filter((it) => set.has(String(it.id)));
  }, [items, selectedIds]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Record<string, string> = {};
      for (const it of selected) {
        const raw = it?.[LABELS.value_field] ?? it?.id;
        const value = String(raw ?? '');
        try {
          next[String(it.id)] = await QRCode.toDataURL(value, { margin: 1, width: LABELS.size });
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      setDataUrls(next);
    };
    run();
    return () => { cancelled = true; };
  }, [selected.map((x) => x.id).join('|')]);

  const startScan = async () => {
    if (!LABELS.scan) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Scanner not supported',
        description:
          'Camera scanning is not available in this browser/environment. It usually requires a secure context (https or http://localhost) and camera permission. Try the latest Chrome/Edge (desktop or mobile) and open the app via http://localhost. You can still print labels without scanning.',
        variant: 'warning',
      });
      return;
    }
    try {
      setScannedValue('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const anyWindow: any = window as any;
      const detector = anyWindow.BarcodeDetector ? new anyWindow.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      setScanning(true);

      const tick = async () => {
        if (!videoRef.current) return;
        try {
          if (detector) {
            const res = await detector.detect(videoRef.current);
            if (res && res.length) {
              const value = String(res[0].rawValue || '');
              if (value) {
                setScannedValue(value);
                stopScan();
                return;
              }
            }
          } else if (ctx) {
            const w = videoRef.current.videoWidth || 0;
            const h = videoRef.current.videoHeight || 0;
            if (w && h) {
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                setScannedValue(String(code.data));
                stopScan();
                return;
              }
            }
          }
        } catch {
          // ignore
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      toast({ title: 'Camera error', description: e?.message || 'Could not access camera', variant: 'error' });
      stopScan();
    }
  };

  const stopScan = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => stopScan();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QR Labels</h1>
          <p className="text-sm text-slate-600">Print-friendly label sheet. Field: <span className="font-semibold">{LABELS.value_field}</span></p>
        </div>
        <div className="flex gap-2 no-print">
          <button type="button" onClick={() => window.print()} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Print
          </button>
          <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Back
          </Link>
        </div>
      </div>

      <div className="no-print rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select records</label>
          <select
            multiple
            value={selectedIds}
            onChange={(e) => setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
            className="w-full rounded border px-3 py-2 min-h-[120px]"
          >
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
          <div className="mt-1 text-xs text-slate-500">Tip: use Ctrl/⌘ to select multiple.</div>
        </div>

        {LABELS.scan ? (
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Scan (optional)</div>
                <div className="text-xs text-slate-500">Uses your PC camera if supported.</div>
              </div>
              {scanning ? (
                <button type="button" onClick={stopScan} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
                  Stop
                </button>
              ) : (
                <button type="button" onClick={startScan} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
                  Start
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <video ref={videoRef} className="w-full rounded bg-black" playsInline muted />
              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Scanned value</div>
                <div className="mt-1 break-all rounded bg-slate-50 p-2 text-xs">{scannedValue || '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(' + String(LABELS.columns) + ', minmax(0, 1fr))' }}
      >
        {selected.map((it) => (
          <div key={it.id} className="break-inside-avoid rounded-lg border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              {dataUrls[String(it.id)] ? (
                <img src={dataUrls[String(it.id)]} alt="QR" className="h-[96px] w-[96px]" />
              ) : (
                <div className="h-[96px] w-[96px] rounded bg-slate-100" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{getEntityDisplay(ENTITY_SLUG, it)}</div>
                {LABELS.text_fields && LABELS.text_fields.length ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {LABELS.text_fields.map((k) => (
                      <div key={k} className="truncate"><span className="font-semibold">{k}:</span> {String(it?.[k] ?? '')}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          Select at least one record to generate labels.
        </div>
      ) : null}
    </div>
  );
}
`;
}

module.exports = {
  buildEntityListPage,
  buildEntityFormPage,
  buildEntityImportPage,
  buildReceivePage,
  buildIssuePage,
  buildAdjustPage,
  buildTransferPage,
  buildLabelsPage,
};



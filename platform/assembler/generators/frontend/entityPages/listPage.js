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
  hasReservationFields,
  hasStatusField,
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

const getStatusBadgeClass = (status: string) => {
  const s = status.toLowerCase().replace(/[_\s]+/g, '');
  if (s === 'active' || s === 'approved' || s === 'paid') return 'inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700';
  if (s === 'pending' || s === 'draft' || s === 'sent') return 'inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700';
  if (s === 'rejected' || s === 'cancelled' || s === 'terminated') return 'inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-rose-100 text-rose-700';
  if (s === 'onleave' || s === 'overdue' || s === 'obsolete') return 'inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700';
  return 'inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700';
};

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
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                {tableColumns.map((col: any) => {
                  const value = getCellDisplay(item, col.key);
                  const isStatusCol = col.key === 'status' && hasStatusField;
                  return (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {isStatusCol ? (
                        <span className={getStatusBadgeClass(String(value))}>
                          {value}
                        </span>
                      ) : (
                        <span>{value}</span>
                      )}
                    </td>
                  );
                })}
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

module.exports = { buildEntityListPage };

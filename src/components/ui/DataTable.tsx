import React, { useState, useMemo } from 'react';
import { Input } from './Input';
import { Search } from '../icons';
import { EmptyState } from './EmptyState';

interface DataTableProps<T extends Record<string, any>> {
    columns: { accessorKey: string; header: string }[];
    data: T[];
    onRowClick?: (row: { original: T }) => void;
    cellRenderers?: Record<string, (info: any) => React.ReactNode>;
}

export function DataTable<T extends Record<string, any>>({
    columns,
    data,
    onRowClick,
    cellRenderers = {}
}: DataTableProps<T>) {
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const filteredAndSortedData = useMemo(() => {
        let filtered = data;
        if (filter) {
            filtered = data.filter(row =>
                Object.values(row).some(value =>
                    String(value).toLowerCase().includes(filter.toLowerCase())
                )
            );
        }

        if (sort) {
            filtered.sort((a, b) => {
                const aValue = a[sort.key];
                const bValue = b[sort.key];
                if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [data, filter, sort]);

    const handleSort = (key: string) => {
        if (sort?.key === key) {
            setSort({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setSort({ key, direction: 'asc' });
        }
    };

    const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 flex-shrink-0">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter results..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full !pl-9 !h-8 bg-background"
                    />
                </div>
            </div>
            <div className="flex-grow overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10">
                        <tr>
                            {columns.map(col => (
                                <th key={col.accessorKey} className="px-4 py-2 font-semibold cursor-pointer" onClick={() => handleSort(col.accessorKey)}>
                                    <div className="flex items-center gap-2">
                                        {col.header}
                                        {sort?.key === col.accessorKey && (
                                            <span>{sort.direction === 'asc' ? '▲' : '▼'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredAndSortedData.map((row, rowIndex) => (
                            <tr
                                key={row.id ?? rowIndex}
                                onClick={() => onRowClick?.({ original: row })}
                                className="hover:bg-muted cursor-pointer"
                            >
                                {columns.map(col => {
                                    const cellValue = getNestedValue(row, col.accessorKey);
                                    const CellRenderer = cellRenderers[col.accessorKey];
                                    return (
                                        <td key={col.accessorKey} className="px-4 py-2 font-mono">
                                            {CellRenderer ? CellRenderer({ getValue: () => cellValue, row: { original: row } }) : String(cellValue ?? '')}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredAndSortedData.length === 0 && (
                    <div className="mt-8">
                        <EmptyState message={data.length > 0 ? "No results match your filter." : "No results to display."} />
                    </div>
                 )}
            </div>
        </div>
    );
}

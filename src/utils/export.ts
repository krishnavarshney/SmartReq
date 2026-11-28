const cellToString = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const escapeCsvValue = (value: any): string => {
    const stringValue = cellToString(value);
    // If the value contains a comma, newline, or a double quote, enclose it in double quotes.
    if (/[",\r\n]/.test(stringValue)) {
        // Within a quoted value, any double quote must be escaped by another double quote.
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

const isPlainObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Normalize JSON-ish data into rows + columns:
 * - array of objects -> one row per object, columns = union of keys
 * - array of primitives/arrays -> { value } rows
 * - object -> { key, value } rows
 */
export const toTableRows = (data: any): { headers: string[]; rows: Record<string, any>[] } | null => {
    if (data === null || data === undefined) return null;
    let rows: Record<string, any>[];
    if (Array.isArray(data)) {
        rows = data.every(isPlainObject) ? data : data.map((value) => (isPlainObject(value) ? value : { value }));
    } else if (isPlainObject(data)) {
        rows = Object.entries(data).map(([key, value]) => ({ key, value }));
    } else {
        rows = [{ value: data }];
    }
    if (rows.length === 0) return null;
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return { headers, rows };
};

const triggerDownload = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    if (link.download === undefined) return;
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Build CSV text for the given data (see toTableRows for the accepted shapes). */
export const toCsv = (data: any): string => {
    const table = toTableRows(data);
    if (!table) return '';
    return [
        table.headers.map(escapeCsvValue).join(','),
        ...table.rows.map((row) => table.headers.map((header) => escapeCsvValue(row[header])).join(',')),
    ].join('\r\n');
};

export const exportDataAsCsv = (data: any, filename: string): void => {
    if (!data) return;
    const csvContent = toCsv(data);
    if (!csvContent) {
        if (typeof data !== 'object') console.error('Unsupported data type for CSV export.');
        return;
    }
    // BOM so Excel opens UTF-8 correctly.
    triggerDownload(new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
};

const xmlEscape = (s: string) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        // Strip characters that are illegal in XML 1.0.
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/**
 * Export as an Excel 2003 XML Spreadsheet (.xls). Opens natively in Excel,
 * LibreOffice and Numbers without any extra dependency; numbers and booleans
 * keep their types.
 */
export const exportDataAsXls = (data: any, filename: string, sheetName = 'Response'): void => {
    const table = toTableRows(data);
    if (!table) return;
    const cell = (value: any) => {
        if (typeof value === 'number' && isFinite(value)) return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
        if (typeof value === 'boolean') return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
        return `<Cell><Data ss:Type="String">${xmlEscape(cellToString(value))}</Data></Cell>`;
    };
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?mso-application progid="Excel.Sheet"?>',
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
        '<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>',
        `<Worksheet ss:Name="${xmlEscape(sheetName).slice(0, 31)}"><Table>`,
        `<Row>${table.headers.map((h) => `<Cell ss:StyleID="h"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>`,
        ...table.rows.map((row) => `<Row>${table.headers.map((h) => cell(row[h])).join('')}</Row>`),
        '</Table></Worksheet></Workbook>',
    ].join('\n');
    triggerDownload(new Blob([xml], { type: 'application/vnd.ms-excel' }), filename);
};

const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    
    let stringValue = String(value);
    
    if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
    }
    
    // If the value contains a comma, newline, or a double quote, enclose it in double quotes.
    if (/[",\n]/.test(stringValue)) {
        // Within a quoted value, any double quote must be escaped by another double quote.
        stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
};

export const exportDataAsCsv = (data: any, filename: string): void => {
    if (!data) return;

    let rows: Record<string, any>[];
    if (Array.isArray(data)) {
        rows = data;
    } else if (typeof data === 'object' && data !== null) {
        rows = Object.entries(data).map(([key, value]) => ({ key, value }));
    } else {
        console.error("Unsupported data type for CSV export.");
        return;
    }

    if (rows.length === 0) {
        return;
    }

    const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => 
            headers.map(header => escapeCsvValue(row[header])).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

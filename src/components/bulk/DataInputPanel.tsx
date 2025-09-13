import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Trash2, Plus, Copy, Import, GripVertical } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';
import Papa from 'papaparse';

interface DataInputPanelProps {
    data: Record<string, string>[];
    onDataChange: (data: Record<string, string>[]) => void;
}

export const DataInputPanel: React.FC<DataInputPanelProps> = ({ data, onDataChange }) => {
    const { addToast } = useToast();
    const [pasteData, setPasteData] = useState('');
    const [showPaste, setShowPaste] = useState(false);
    
    const [headerOrder, setHeaderOrder] = useState<string[]>([]);
    const [draggedHeader, setDraggedHeader] = useState<string | null>(null);
    const [editingHeader, setEditingHeader] = useState<string | null>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const newHeaders = data.length > 0 ? Object.keys(data[0]) : [];
        setHeaderOrder(currentOrder => {
            const newHeadersSet = new Set(newHeaders);
            const preservedOrder = currentOrder.filter(header => newHeadersSet.has(header));
            const preservedHeaderSet = new Set(preservedOrder);
            const addedHeaders = newHeaders.filter(header => !preservedHeaderSet.has(header));
            const finalOrder = [...preservedOrder, ...addedHeaders];
            
            if (finalOrder.length !== newHeaders.length || !finalOrder.every(h => newHeadersSet.has(h))) {
              return newHeaders;
            }
            
            return finalOrder;
        });
    }, [data]);

    useEffect(() => {
        if (editingHeader && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingHeader]);
    
    const handleFileParse = (file: File) => {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    onDataChange(results.data as Record<string, string>[]);
                    addToast(`Loaded ${results.data.length} rows from ${file.name}`, 'success');
                },
                error: (error: any) => addToast(`CSV parse error: ${error.message}`, 'error'),
            });
        } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target?.result as string);
                    if (Array.isArray(json) && json.every(item => typeof item === 'object')) {
                         onDataChange(json.map(row => Object.entries(row).reduce((acc, [key, value]) => ({...acc, [key]: String(value)}), {})));
                         addToast(`Loaded ${json.length} rows from ${file.name}`, 'success');
                    } else {
                        addToast('JSON file must be an array of objects.', 'error');
                    }
                } catch (err: any) {
                    addToast(`JSON parse error: ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
        } else {
            addToast('Unsupported file type. Please use CSV or JSON.', 'error');
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileParse(file);
        e.target.value = ''; // Reset file input
    };

    // FIX: Renamed handleDrop to handleFileDrop to avoid naming conflicts.
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileParse(file);
    };

    const handlePasteData = () => {
        try {
            const parsedJson = JSON.parse(pasteData);
            if(Array.isArray(parsedJson)) {
                onDataChange(parsedJson);
                addToast(`Pasted ${parsedJson.length} JSON rows`, 'success');
                setShowPaste(false);
                setPasteData('');
                return;
            }
        } catch (e) {}

        Papa.parse(pasteData, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length) {
                    addToast(`Paste error: ${results.errors[0].message}`, 'error');
                    return;
                }
                onDataChange(results.data as Record<string, string>[]);
                addToast(`Pasted ${results.data.length} CSV rows`, 'success');
                setShowPaste(false);
                setPasteData('');
            }
        });
    };
    
    const handleCellChange = (rowIndex: number, header: string, value: string) => {
        const newData = [...data];
        newData[rowIndex] = { ...newData[rowIndex], [header]: value };
        onDataChange(newData);
    };

    const handleAddRow = () => {
        const newRow = headerOrder.reduce((acc, h) => ({...acc, [h]: ''}), {});
        onDataChange([...data, newRow]);
    };
    
    const handleDeleteRow = (rowIndex: number) => {
        onDataChange(data.filter((_, i) => i !== rowIndex));
    };
    
    const handleClearAll = () => {
        if (window.confirm('Are you sure you want to clear all data rows?')) {
            onDataChange([]);
            setShowPaste(false);
        }
    }

     const handleAddColumn = () => {
        const newHeader = prompt("Enter new column name:");
        if (newHeader && !headerOrder.includes(newHeader.trim())) {
            const trimmedHeader = newHeader.trim();
            setHeaderOrder([...headerOrder, trimmedHeader]);
            onDataChange(data.map(row => ({ ...row, [trimmedHeader]: '' })));
        } else if (newHeader) {
            addToast(`Column "${newHeader.trim()}" already exists.`, 'error');
        }
    }

    const handleDeleteColumn = (headerToDelete: string) => {
        if (!window.confirm(`Are you sure you want to delete the "${headerToDelete}" column? This cannot be undone.`)) return;
        
        const newOrder = headerOrder.filter(h => h !== headerToDelete);
        setHeaderOrder(newOrder);

        const newData = data.map(row => {
            const { [headerToDelete]: _, ...rest } = row;
            return rest;
        });
        onDataChange(newData);
    }

    const handleRenameColumn = (oldName: string, newName: string) => {
        const trimmedNewName = newName.trim();
        if (!trimmedNewName || trimmedNewName === oldName) {
            setEditingHeader(null);
            return;
        }
        if (headerOrder.includes(trimmedNewName)) {
            addToast(`Column "${trimmedNewName}" already exists.`, 'error');
            return; 
        }

        const newOrder = headerOrder.map(h => h === oldName ? trimmedNewName : h);
        setHeaderOrder(newOrder);

        const newData = data.map(row => {
            const newRow: Record<string, string> = {};
            newOrder.forEach(header => {
                const keyInOldRow = header === trimmedNewName ? oldName : header;
                newRow[header] = row[keyInOldRow];
            });
            return newRow;
        });
        onDataChange(newData);
        setEditingHeader(null);
    }

    const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, oldName: string) => {
        if (e.key === 'Enter') {
            handleRenameColumn(oldName, e.currentTarget.value);
        } else if (e.key === 'Escape') {
            setEditingHeader(null);
        }
    }
    
    const handleDragStart = (e: React.DragEvent, header: string) => {
        setDraggedHeader(header);
        e.dataTransfer.effectAllowed = 'move';
    };

    // FIX: Renamed handleDrop to handleHeaderDrop to resolve naming conflict.
    const handleHeaderDrop = (e: React.DragEvent, targetHeader: string) => {
        e.preventDefault();
        if (!draggedHeader || draggedHeader === targetHeader) {
            setDraggedHeader(null);
            return;
        }
        
        const currentIndex = headerOrder.indexOf(draggedHeader);
        const targetIndex = headerOrder.indexOf(targetHeader);
        
        const newOrder = [...headerOrder];
        const [removed] = newOrder.splice(currentIndex, 1);
        newOrder.splice(targetIndex, 0, removed);
        
        setHeaderOrder(newOrder);
        setDraggedHeader(null);
    };
    
    const renderTable = () => (
         <div className="flex flex-col h-full">
            <div className="p-2 border-b border-border flex items-center justify-between bg-muted/30 flex-shrink-0">
                <p className="text-sm font-semibold px-2">Data Source <span className="text-muted-foreground font-normal">({data.length} rows)</span></p>
                <div className="flex items-center gap-1">
                    <input id="file-upload-hidden" type="file" className="hidden" accept=".csv,.json" onChange={handleFileChange} />
                    <Tooltip content="Import from File">
                        <label htmlFor="file-upload-hidden" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 cursor-pointer hover:bg-accent text-muted-foreground hover:text-accent-foreground">
                           <Import className="h-4 w-4" />
                        </label>
                    </Tooltip>
                     <Tooltip content="Add Row">
                        <IconButton size="sm" variant="ghost" onClick={handleAddRow}><Plus className="h-4 w-4" /></IconButton>
                    </Tooltip>
                    <Tooltip content="Clear All">
                        <IconButton size="sm" variant="ghost" onClick={handleClearAll} className="hover:!text-destructive"><Trash2 className="h-4 w-4" /></IconButton>
                    </Tooltip>
                </div>
            </div>
             <div className="flex-grow overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-2 py-2 font-semibold w-10 text-center">#</th>
                            {headerOrder.map(header => (
                                <th 
                                    key={header} 
                                    className={`px-2 py-2 font-semibold group relative transition-colors ${draggedHeader ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, header)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleHeaderDrop(e, header)}
                                    onDragEnd={() => setDraggedHeader(null)}
                                >
                                    <div className={`flex items-center gap-1 ${draggedHeader === header ? 'opacity-40' : ''}`}>
                                        <GripVertical className="h-4 w-4 text-muted-foreground/50"/>
                                        {editingHeader === header ? (
                                            <Input
                                                ref={renameInputRef}
                                                defaultValue={header}
                                                onBlur={(e) => handleRenameColumn(header, e.target.value)}
                                                onKeyDown={(e) => handleHeaderKeyDown(e, header)}
                                                className="!h-6 !text-xs"
                                            />
                                        ) : (
                                            <span onDoubleClick={() => setEditingHeader(header)} className="flex-grow">{header}</span>
                                        )}
                                        <IconButton size="sm" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:!text-destructive" onClick={() => handleDeleteColumn(header)}>
                                            <Trash2 className="h-3 w-3"/>
                                        </IconButton>
                                    </div>
                                </th>
                            ))}
                            <th className="px-2 py-2 w-10">
                                <Tooltip content="Add Column">
                                    <IconButton size="sm" variant="ghost" onClick={handleAddColumn}>
                                        <Plus className="h-4 w-4"/>
                                    </IconButton>
                                </Tooltip>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="group hover:bg-muted">
                                <td className="px-2 py-1 text-center text-muted-foreground text-xs">{rowIndex + 1}</td>
                                {headerOrder.map(header => (
                                    <td key={header} className="px-2 py-0.5">
                                        <Input
                                            type="text"
                                            value={row[header] || ''}
                                            onChange={(e) => handleCellChange(rowIndex, header, e.target.value)}
                                            className="w-full bg-transparent border-0 focus:bg-input focus:ring-1 !h-7 font-mono"
                                        />
                                    </td>
                                ))}
                                <td className="px-2 py-1 text-center">
                                    <IconButton size="sm" variant="ghost" onClick={() => handleDeleteRow(rowIndex)} className="!opacity-0 group-hover:!opacity-100 hover:!text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </IconButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
    );

    const renderEmptyState = () => (
         <div className="p-4 flex flex-col h-full items-center justify-center gap-4 text-center">
            <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="flex justify-center items-center w-full"
            >
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag & drop</p>
                        <p className="text-xs text-muted-foreground">CSV or JSON file</p>
                    </div>
                    <input id="file-upload" type="file" className="hidden" accept=".csv,.json" onChange={handleFileChange} />
                </label>
            </div>
            <div className="text-xs text-muted-foreground">OR</div>
             <Button variant="secondary" size="sm" onClick={() => setShowPaste(true)}>
                <Copy className="h-4 w-4 mr-2" /> Paste from Clipboard
             </Button>
         </div>
    );

    const renderPasteView = () => (
        <div className="p-4 flex flex-col h-full gap-2">
            <h3 className="text-sm font-semibold">Paste Data</h3>
            <p className="text-xs text-muted-foreground">Paste raw CSV or JSON (array of objects) data below.</p>
            <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                className="w-full flex-grow bg-muted border border-border rounded-md text-sm text-foreground font-mono p-2 focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={`"id","name"\n"1","Product A"`}
            />
            <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => {setShowPaste(false); setPasteData('');}}>Cancel</Button>
                <Button size="sm" onClick={handlePasteData} disabled={!pasteData}>Import Data</Button>
            </div>
        </div>
    );

    if (showPaste) return renderPasteView();
    return data.length > 0 ? renderTable() : renderEmptyState();
};

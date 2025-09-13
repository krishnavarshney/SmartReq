import React, { useState, useRef, useEffect } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { Table as TableIcon, ChevronRight } from '../icons';
import { JsonNode } from './JsonNode';
import { Tooltip } from '../ui/Tooltip';
import { IconButton } from '../ui/Button';

interface TableViewProps {
    data: any;
    onDrillDown?: (segments: string[]) => void;
    nestingLevel?: number;
}

const CollapsibleRenderer: React.FC<{
    data: any;
    onDrillDown?: () => void;
    isDrillable: boolean;
}> = ({ data, onDrillDown, isDrillable }) => {
    const [isOpen, setIsOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    
    const isArray = Array.isArray(data);
    const summary = isArray ? `Array [${data.length}]` : `Object {${Object.keys(data).length}}`;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const element = contentRef.current;
        if (!element) return;
        
        // If it's open and height is auto, we need to set a pixel height to animate from
        if (isOpen) {
            if (element.style.height === 'auto') {
                element.style.height = `${element.scrollHeight}px`;
                // Force reflow before changing state to animate
                element.getBoundingClientRect();
            }
        }
        setIsOpen(prev => !prev);
    };

    useEffect(() => {
        const element = contentRef.current;
        if (!element) return;
        
        if (isOpen) {
            // Animate to scrollHeight
            element.style.height = `${element.scrollHeight}px`;
        } else {
            // Animate to 0
            element.style.height = '0px';
        }
    }, [isOpen]);

    const handleTransitionEnd = () => {
        const element = contentRef.current;
        if (element && isOpen) {
            // After opening, set to auto to allow nested items to expand it
            element.style.height = 'auto';
        }
    };

    return (
        <div>
            <div className="flex items-center gap-1 cursor-pointer group select-none" onClick={handleToggle}>
                <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                <span className="text-muted-foreground group-hover:text-foreground">{summary}</span>
                {isDrillable && onDrillDown && (
                     <Tooltip content="View as Table">
                         <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDrillDown();
                            }}
                            className="h-6 w-6 !opacity-0 group-hover:!opacity-100"
                        >
                            <TableIcon className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
            <div
                className="overflow-hidden transition-[height] duration-200 ease-in-out"
                ref={contentRef}
                style={{ height: '0px' }} // Initial height
                onTransitionEnd={handleTransitionEnd}
            >
                <div className="pt-1 pl-4 border-l border-border ml-1">
                    <TableView data={data} nestingLevel={1} onDrillDown={onDrillDown as any} />
                </div>
            </div>
        </div>
    );
}

export const TableView: React.FC<TableViewProps> = ({ data, onDrillDown, nestingLevel = 0 }) => {
    const isArrayOfObjects = Array.isArray(data) && data.length > 0 && data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
    const isSingleObject = typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length > 0;

    if (!isArrayOfObjects && !isSingleObject) {
        if (nestingLevel === 0) {
            return (
                <EmptyState 
                    icon={<TableIcon className="h-12 w-12 text-muted-foreground mb-4 stroke-1" />}
                    title="Unsupported Data for Table View"
                    message="Table view supports JSON arrays of objects or a single JSON object."
                />
            );
        }
        return <JsonNode data={data} />;
    }
    
    const isTopLevel = nestingLevel === 0;

    if (isSingleObject) {
        const entries = Object.entries(data);
        return (
            <div className={isTopLevel ? 'p-4 overflow-auto' : ''}>
                <table className="w-full text-sm text-left">
                    {isTopLevel && (
                        <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-4 py-2 font-semibold">Key</th>
                                <th scope="col" className="px-4 py-2 font-semibold">Value</th>
                            </tr>
                        </thead>
                    )}
                    <tbody className={`${isTopLevel ? 'divide-y divide-border' : ''} text-foreground`}>
                        {entries.map(([key, value]) => {
                            const isNestedTable = value !== null && typeof value === 'object' && Object.keys(value).length > 0;
                            return (
                                <tr key={key} className={isTopLevel ? 'hover:bg-muted' : ''}>
                                    <td className={`font-mono align-top ${isTopLevel ? 'px-4 py-2 font-medium text-foreground' : 'px-1 py-0.5'}`}>
                                        {isTopLevel ? key : <><span className="token key">{`"${key}"`}</span><span className="token punctuation">:</span></>}
                                    </td>
                                    <td className={`font-mono align-top ${isTopLevel ? 'px-4 py-2' : 'px-1 py-0.5'}`}>
                                        {isNestedTable ? (
                                            <CollapsibleRenderer 
                                                data={value}
                                                isDrillable={isTopLevel && !!onDrillDown}
                                                onDrillDown={isTopLevel && onDrillDown ? () => onDrillDown([key]) : undefined}
                                            />
                                        ) : (
                                            <JsonNode data={value} />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    if (isArrayOfObjects) {
        const headers = Array.from(new Set((data as any[]).flatMap(item => Object.keys(item))));
        return (
            <div className={isTopLevel ? 'overflow-auto h-full' : 'w-full'}>
                <table className="w-full text-sm text-left">
                    <thead className={isTopLevel ? "text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10" : "text-xs text-muted-foreground"}>
                        <tr>
                            <th scope="col" className={`font-semibold ${isTopLevel ? 'px-4 py-2' : 'px-1 py-0.5'}`}>#</th>
                            {headers.map(header => <th key={header} scope="col" className={`font-semibold ${isTopLevel ? 'px-4 py-2' : 'px-1 py-0.5'}`}>{header}</th>)}
                        </tr>
                    </thead>
                    <tbody className={`${isTopLevel ? 'divide-y divide-border' : ''} text-foreground`}>
                        {data.map((row: any, rowIndex: number) => (
                            <tr key={rowIndex} className={isTopLevel ? "hover:bg-muted" : ""}>
                                <td className={`align-top text-muted-foreground ${isTopLevel ? 'px-4 py-2' : 'px-1 py-0.5'}`}>{isTopLevel ? rowIndex + 1 : rowIndex}</td>
                                {headers.map(header => {
                                    const cellData = row[header];
                                    const isNestedTable = cellData !== null && typeof cellData === 'object' && Object.keys(cellData).length > 0;
                                    return (
                                        <td key={header} className={`font-mono align-top ${isTopLevel ? 'px-4 py-2' : 'px-1 py-0.5'}`}>
                                           {isNestedTable ? (
                                                <CollapsibleRenderer 
                                                    data={cellData}
                                                    isDrillable={isTopLevel && !!onDrillDown}
                                                    onDrillDown={isTopLevel && onDrillDown ? () => onDrillDown([String(rowIndex), header]) : undefined}
                                                />
                                            ) : (
                                                <JsonNode data={cellData} />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    
    return null;
};
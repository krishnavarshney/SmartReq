import React, { useState, useEffect } from 'react';

interface KeyValueNodeProps {
  property: string;
  value: any;
  startExpanded: boolean;
}

const KeyValueNode: React.FC<KeyValueNodeProps> = ({ property, value, startExpanded }) => {
  return (
    <div className="flex items-start gap-2 py-px">
      <span className="token key flex-shrink-0">"{property}"</span><span className="token punctuation">:</span>
      <div className="flex-grow">
        <JsonNode data={value} startExpanded={startExpanded} />
      </div>
    </div>
  );
};

interface JsonNodeProps {
  data: any;
  startExpanded?: boolean;
}

const getDataType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value === undefined) return 'undefined';
    return typeof value;
};

const PrimitiveNode: React.FC<{ data: any; dataType: string }> = ({ data, dataType }) => {
    const classes: { [key: string]: string } = {
        string: "token string",
        number: "token number",
        boolean: "token boolean",
        null: "token null",
        undefined: "token null italic",
    };
    const value = dataType === 'string' ? `"${data}"` : String(data);
    return <span className={classes[dataType]}>{value}</span>;
}

const CollapsibleNode: React.FC<{
    data: any;
    type: 'array' | 'object';
    startExpanded?: boolean;
}> = ({ data, type, startExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(startExpanded);

    useEffect(() => {
        setIsExpanded(startExpanded);
    }, [startExpanded]);

    const isArray = type === 'array';
    const entries = isArray ? data : Object.entries(data);
    
    if (entries.length === 0) {
        return <span className="text-muted-foreground">{isArray ? '[]' : '{}'}</span>;
    }

    const summary = isArray 
        ? `Array(${entries.length})`
        : `Object(${Object.keys(data).length})`;

    const brackets = isArray ? ('[' as const) : ('{' as const);
    const closingBracket = isArray ? ']' : '}';

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="font-mono text-sm">
            <button onClick={toggle} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer w-full text-left">
                <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} text-xs`}>▶</span>
                <span className="token punctuation">{brackets}</span>
                {!isExpanded && (
                    <>
                        <span className="ml-1">{summary}</span>
                        <span className="ml-1 token punctuation">{closingBracket}</span>
                    </>
                )}
            </button>
            <div 
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <div className="pl-4 border-l border-border ml-2 pt-1">
                        {isArray
                            ? entries.map((item: any, index: number) => (
                                <div key={index} className="flex items-start gap-2 py-px">
                                    <span className="text-muted-foreground">{index}:</span>
                                    <JsonNode data={item} startExpanded={startExpanded} />
                                </div>
                            ))
                            : (entries as [string, any][]).map(([key, value]) => (
                                <KeyValueNode key={key} property={key} value={value} startExpanded={startExpanded} />
                            ))
                        }
                    </div>
                     {isExpanded && <span className="text-muted-foreground token punctuation">{closingBracket}</span>}
                </div>
            </div>
        </div>
    );
};


export const JsonNode: React.FC<JsonNodeProps> = ({ data, startExpanded = false }) => {
    const dataType = getDataType(data);

    if (['string', 'number', 'boolean', 'null', 'undefined'].includes(dataType)) {
        return <PrimitiveNode data={data} dataType={dataType} />;
    }

    if (dataType === 'array') {
        return <CollapsibleNode data={data} type="array" startExpanded={startExpanded} />;
    }
    
    if (dataType === 'object') {
        return <CollapsibleNode data={data} type="object" startExpanded={startExpanded} />;
    }

    return <span>{String(data)}</span>;
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ClipboardPaste, FileJson } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Badge } from '../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { UploadCloud, Link, Import, AlertTriangle, X } from '../icons';
import { detectImportFormat, ImportFormat, openApiToCollection, parseOpenApiSpec } from '../../utils/openapi';
import { parsePostmanCollection } from '../../utils/postman';
import { parseCurl } from '../../utils/curl';
import { countRequests, createDefaultRequest } from '../../utils/collection';
import { Collection, ApiRequest, RequestItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface ImportModalProps {
  onImport: (collection: Collection) => void;
}

const FORMAT_LABEL: Record<ImportFormat, string> = {
  curl: 'cURL command',
  openapi: 'OpenAPI / Swagger',
  postman: 'Postman collection',
  unknown: 'Unrecognized format',
};

const PLACEHOLDER = `Paste any of:

curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"name":"Ada"}'

{ "openapi": "3.0.0", "info": { … }, "paths": { … } }        (JSON or YAML)

{ "info": { "name": "…", "schema": "…/collection/v2.1.0/…" }, "item": [ … ] }`;

export const ImportModal: React.FC<ImportModalProps> = ({ onImport }) => {
  const { isImportModalOpen, setIsImportModalOpen, revealSidebarPanel, isMobile, setMode } = useApp();
  const { setWorkspace, addNode, workspace, handleGlobalsChange, globals } = useWorkspace();
  const { openTab } = useTabs();
  const { addToast } = useToast();

  const [tab, setTab] = useState('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isImportModalOpen) {
      setError(null);
      setIsLoading(false);
    }
  }, [isImportModalOpen]);
  useEffect(() => setError(null), [tab, text, file, url]);

  const pastedFormat = useMemo(() => detectImportFormat(text), [text]);
  const fileFormat = useMemo(() => (file ? detectImportFormat(file.text) : 'unknown'), [file]);

  const close = () => setIsImportModalOpen(false);

  const finishCollection = (collection: Collection, extra = '') => {
    onImport(collection);
    const n = countRequests(collection);
    addToast(`Imported ${n} request${n === 1 ? '' : 's'} into “${collection.name}”${extra}`, 'success');
    if (!isMobile) revealSidebarPanel('collections');
    setText('');
    setFile(null);
    setUrl('');
    close();
  };

  const importCurl = (command: string) => {
    const partial = parseCurl(command.trim());
    const request: ApiRequest = { ...createDefaultRequest(), queryParams: [], headers: [], ...partial };
    const collectionName = 'cURL Imports';
    let target = workspace.collections.find((c) => c.name === collectionName);
    if (!target) {
      target = { id: uuidv4(), type: 'collection', name: collectionName, children: [] };
      const created = target;
      setWorkspace((ws) => ({ ...ws, collections: [...ws.collections, created] }));
    }
    let name = request.url;
    try {
      const u = new URL(request.url);
      name = `${request.method} ${u.pathname === '/' ? u.host : u.pathname}`;
    } catch {
      /* keep raw */
    }
    const item: RequestItem = { id: uuidv4(), type: 'request', name: name || 'cURL import', request, responses: [] };
    addNode(item, target.id);
    openTab(item);
    setMode('single');
    addToast('cURL command imported', 'success');
    setText('');
    close();
  };

  const importPostman = (json: unknown) => {
    const { collection, variables } = parsePostmanCollection(json);
    const existing = new Set(globals.map((g) => g.key));
    const added = variables.filter((v) => v.key && !existing.has(v.key));
    if (added.length) handleGlobalsChange([...globals.filter((g) => g.key || g.value), ...added]);
    finishCollection(collection, added.length ? `. ${added.length} collection variable${added.length === 1 ? ' was' : 's were'} added to globals.` : '');
  };

  const importText = async (content: string, format: ImportFormat) => {
    if (format === 'curl') return importCurl(content);
    if (format === 'postman') return importPostman(JSON.parse(content));
    if (format === 'openapi') return finishCollection(await parseOpenApiSpec(content));
    throw new Error('Could not recognize this content. Paste a cURL command, an OpenAPI / Swagger document (JSON or YAML) or a Postman v2 collection.');
  };

  const importUrl = async (target: string) => {
    if (!/^https?:\/\//i.test(target)) throw new Error('Enter a full URL starting with http:// or https://');
    let body: string;
    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`The server responded with ${res.status} ${res.statusText}.`);
      body = await res.text();
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error('Could not download the file. The server may block cross-origin requests (CORS); download it and use the File tab instead.');
      }
      throw e;
    }
    const format = detectImportFormat(body);
    if (format === 'postman') return importPostman(JSON.parse(body));
    if (format === 'openapi') {
      // Parse from the URL so relative $refs and server URLs resolve.
      return finishCollection(await parseOpenApiSpec(target).catch(async () => openApiToCollection(JSON.parse(body), target)));
    }
    throw new Error('The URL did not return an OpenAPI / Swagger document or a Postman collection.');
  };

  const canImport = tab === 'paste' ? !!text.trim() : tab === 'file' ? !!file : !!url.trim();

  const handleImport = async () => {
    if (!canImport || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      if (tab === 'paste') await importText(text, pastedFormat);
      else if (tab === 'file' && file) await importText(file.text, fileFormat);
      else await importUrl(url.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('That file is larger than 10 MB.');
      return;
    }
    setFile({ name: f.name, text: await f.text() });
  };

  return (
    <Modal
      show={isImportModalOpen}
      onClose={close}
      size="2xl"
      title="Import"
      description="Bring in requests from a cURL command, an OpenAPI / Swagger spec or a Postman collection."
      icon={<Import />}
      dismissible={!isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!canImport} isLoading={isLoading}>
            Import
          </Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList aria-label="Import source">
          <TabsTrigger value="paste" icon={<ClipboardPaste />}>
            Paste
          </TabsTrigger>
          <TabsTrigger value="file" icon={<FileJson />}>
            File
          </TabsTrigger>
          <TabsTrigger value="url" icon={<Link />}>
            URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                void handleImport();
              }
            }}
            placeholder={PLACEHOLDER}
            aria-label="Content to import"
            spellCheck={false}
            data-autofocus
            className="h-56 resize-none font-mono text-xs leading-relaxed sm:h-64"
          />
          <div className="flex h-5 items-center gap-2 text-xs text-muted-foreground">
            {text.trim() ? (
              <>
                Detected
                <Badge tone={pastedFormat === 'unknown' ? 'warning' : 'primary'}>{FORMAT_LABEL[pastedFormat]}</Badge>
              </>
            ) : (
              'The format is detected automatically.'
            )}
          </div>
        </TabsContent>

        <TabsContent value="file" className="flex flex-col gap-2">
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                <FileJson className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={fileFormat === 'unknown' || fileFormat === 'curl' ? 'warning' : 'primary'}>{FORMAT_LABEL[fileFormat]}</Badge>
                  {Math.max(1, Math.round(file.text.length / 1024))} KB
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFile(null)} aria-label="Remove file">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void readFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center transition-colors focus-ring sm:h-64 ${
                isDragging ? 'border-primary bg-primary/5' : 'border-input bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <span className="text-[13px] text-foreground">
                <span className="font-medium text-primary">Choose a file</span> or drop it here
              </span>
              <span className="text-xs text-muted-foreground">OpenAPI / Swagger (.json, .yaml) or Postman collection (.json)</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </TabsContent>

        <TabsContent value="url" className="flex flex-col gap-2">
          <label htmlFor="import-url" className="text-xs font-medium text-foreground">
            Spec or collection URL
          </label>
          <Input
            id="import-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleImport()}
            placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
            className="font-mono"
            data-autofocus
          />
          <p className="text-xs text-muted-foreground">
            The file is downloaded by your browser, so the server must allow cross-origin requests. If it doesn’t, download the file and use the File tab.
          </p>
        </TabsContent>
      </Tabs>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-bg px-3 py-2 text-[13px] text-destructive-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
    </Modal>
  );
};

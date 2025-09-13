import { useEffect, useRef } from 'react';
import { ApiRequest, KeyValueItem } from '../types';

/**
 * Custom hook to synchronize the URL's query string with the query parameters editor.
 * It handles two-way data binding:
 * 1. URL input changes -> update params editor.
 * 2. Params editor changes -> update URL input.
 * A ref-based lock is used to prevent infinite update loops.
 */
export const useUrlSync = (
    request: ApiRequest | undefined,
    updateRequest: (updates: Partial<ApiRequest>) => void
) => {
    const isSyncing = useRef(false);
    const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync from URL search params TO KeyValueEditor state
    useEffect(() => {
        if (!request || isSyncing.current) return;

        try {
            const url = new URL(request.url, window.location.origin); // Add base for relative URLs
            const paramsFromUrl: KeyValueItem[] = [];
            let idCounter = Date.now();
            url.searchParams.forEach((value, key) => {
                paramsFromUrl.push({ id: idCounter++, key, value, enabled: true });
            });

            // Create a canonical string representation of active params for comparison
            const paramsFromUrlString = JSON.stringify(paramsFromUrl.map(p => [p.key, p.value]));
            const currentParamsString = JSON.stringify(request.queryParams.filter(p => p.enabled && p.key).map(p => [p.key, p.value]));
            
            if (paramsFromUrlString !== currentParamsString) {
                isSyncing.current = true;
                // Preserve any disabled params from the editor
                const disabledParams = request.queryParams.filter(p => !p.enabled && p.key);
                const newParams = [...paramsFromUrl, ...disabledParams];
                
                // Ensure there's always an empty row for user input
                if (newParams.length === 0 || newParams[newParams.length - 1].key || newParams[newParams.length - 1].value) {
                    newParams.push({ id: idCounter++, key: '', value: '', enabled: true });
                }
                
                updateRequest({ queryParams: newParams });
                
                // Release the lock after a short delay to allow React state to update
                setTimeout(() => { isSyncing.current = false; }, 50);
            }
        } catch (e) {
            // Invalid URL, do nothing
        }
    }, [request?.url]); // Dependency: only the URL string itself

    // Sync from KeyValueEditor state TO URL search params
    useEffect(() => {
        if (!request || isSyncing.current) return;

        // Debounce the update to prevent rapid URL changes while typing
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(() => {
            try {
                const baseUrl = request.url.split('?')[0];
                const newSearchParams = new URLSearchParams();
                request.queryParams
                    .filter(p => p.enabled && p.key)
                    .forEach(p => newSearchParams.append(p.key, p.value));
                
                const newSearchString = newSearchParams.toString();
                const newUrl = newSearchString ? `${baseUrl}?${newSearchString}` : baseUrl;

                if (newUrl !== request.url) {
                    isSyncing.current = true;
                    updateRequest({ url: newUrl });
                    setTimeout(() => { isSyncing.current = false; }, 50);
                }
            } catch (e) {
                 // Invalid base URL, do nothing
            }
        }, 200); // 200ms debounce

        return () => {
             if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        }

    }, [request?.queryParams]); // Dependency: only the query params array
};
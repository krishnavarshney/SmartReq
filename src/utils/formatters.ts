export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes || !isFinite(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const getStatusDescription = (status: number): string => {
    switch (true) {
        case status >= 100 && status < 200:
            return "An informational response indicates that the request was received and understood.";
        case status >= 200 && status < 300:
            return "The request was successful. The server has responded as required.";
        case status >= 300 && status < 400:
            return "A redirection message indicates further action is needed to complete the request.";
        case status >= 400 && status < 500:
            return "A client error indicates that the request contains bad syntax or cannot be fulfilled.";
        case status >= 500:
            return "A server error indicates that the server failed to fulfill an apparently valid request.";
        default:
            return "An unknown status code. Could be a network error or a custom status."
    }
}

/** "84 ms", "1.24 s", "2 m 5 s". */
export const formatDuration = (ms: number): string => {
  if (!isFinite(ms) || ms < 0) return '0 ms';
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} m ${s} s`;
};

/** Precise variant for breakdown tables: "12.34 ms". */
export const formatMs = (ms: number): string => `${(isFinite(ms) ? ms : 0).toFixed(ms >= 100 ? 0 : ms >= 10 ? 1 : 2)} ms`;

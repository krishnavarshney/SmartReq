export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

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

export const interpolateString = (template: string, variables: Record<string, string>): string => {
    if(!template) return '';
    // Replace {{key}} case-insensitively.
    return template.replace(/\{\{(.+?)\}\}/g, (match, key) => {
        const trimmedKey = key.trim().toLowerCase();
        const value = variables[trimmedKey];
        return value !== undefined ? value : match;
    });
};
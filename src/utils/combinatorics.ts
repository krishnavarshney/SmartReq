export const generateCombinations = (
  variables: Record<string, string[]>
): Record<string, string>[] => {
  const keys = Object.keys(variables);
  if (keys.length === 0) {
    return [{}];
  }

  const nonEmptyVariables = Object.entries(variables)
    .filter(([, values]) => values.length > 0)
    .reduce((acc, [key, values]) => {
        acc[key] = values;
        return acc;
    }, {} as Record<string, string[]>);

  const nonEmptyKeys = Object.keys(nonEmptyVariables);
  if (nonEmptyKeys.length === 0) {
      return [{}];
  }

  let result: Record<string, string>[] = [{}];

  for (const key of nonEmptyKeys) {
    const values = nonEmptyVariables[key];
    const nextResult: Record<string, string>[] = [];
    for (const res of result) {
      for (const value of values) {
        nextResult.push({ ...res, [key]: value });
      }
    }
    result = nextResult;
  }

  return result;
};

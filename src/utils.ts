

export const withErrorHandling = (fn: (...args: any[]) => any) => async (...args: any[]) => {
  let result;
  try {
    result = await fn(...args);
  } catch (e) {
    // TODO: Proper logging
    // console.error(e);
  }
  return result;
};

export function exponentialBackOff(attempt: number) {
  if (attempt === 0) return 0;
  return 500 * Math.pow(2, attempt);
}

export function tryTimes(retryTimes: number, fn: (...args: any[]) => any) {
  return async (...args: any[]) => {
    let error;
    for (let i = 0; i <= retryTimes; i++) {
      await new Promise((resolve) => setTimeout(resolve, exponentialBackOff(i)));
      let result;

      try {
        result = await fn(...args);
      } catch (e) {
        error = e;
        continue;
      }

      return result;
    }

    throw error;
  };
}
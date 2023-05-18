

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
  let backoffTime = attempt === 0 ? 0 : 500 * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, backoffTime));
}

export function tryTimes(retryTimes: number, fn: (...args: any[]) => any) {
  return async (...args: any[]) => {
    let error;
    for (let i = 0; i <= retryTimes; i++) {
      await exponentialBackOff(i);
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
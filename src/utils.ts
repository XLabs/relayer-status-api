import { Logger } from 'winston';


export const withErrorHandling = <Args extends Array<T>, Res, T>(logger: Logger, fn: (...args: Args) => Res) => async (...args: Args) => {
  let result;
  try {
    result = await fn(...args);
  } catch (e) {
    // TODO: Proper logging
    logger.error(`There was an error writing to the database: Error: ${e}`);
  }
  return result;
};

export function exponentialBackOff(attempt: number) {
  let backoffTime = attempt === 0 ? 0 : 500 * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, backoffTime));
}

export async function tryTimes(retryTimes: number, fn: () => any) {
  let error;
  for (let i = 0; i <= retryTimes; i++) {
    await exponentialBackOff(i);
    let result;

    try {
      result = await fn();
    } catch (e) {
      error = e;
      continue;
    }

    return result;
  }

  throw error;
}

export function pick (obj: any, keys: string[]) {
  return keys.reduce((acc: any, key) => {
    if (obj[key]) acc[key] = obj[key];
    return acc;
  }, {});
}
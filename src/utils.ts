import { Logger } from 'winston';


export const withErrorHandling = (logger?: Logger) => (fn: (...args: any[]) => any) => async (...args: any[]) => {
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
      console.log('Retrying due to error', e.message);
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
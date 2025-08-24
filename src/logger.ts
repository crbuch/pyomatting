/**
 * Simple logger utility for pyomatting package
 */

let isVerbose = false;

export function setVerbose(verbose: boolean): void {
  isVerbose = verbose;
}

export function getVerbose(): boolean {
  return isVerbose;
}

export const logger = {
  log: (...args: any[]) => {
    if (isVerbose) {
      console.log('[pyomatting]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isVerbose) {
      console.info('[pyomatting]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isVerbose) {
      console.warn('[pyomatting]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isVerbose) {
      console.error('[pyomatting]', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isVerbose) {
      console.debug('[pyomatting]', ...args);
    }
  }
};

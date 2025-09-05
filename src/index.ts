// Import worker as inline module - this creates a Blob URL that works in any environment
import PyWorker from "./pyodide.worker.ts?worker&inline&module";
import { logger, setVerbose, getVerbose } from "./logger";

export interface PyomattingIMData {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
}

interface WorkerResponse {
  type: "matting_complete" | "matting_error" | "init_progress" | "processing_progress" | "init_complete";
  data?: {
    resultData: Uint8Array;
    width: number;
    height: number;
  };
  error?: string;
  progress?: {
    stage: string;
    message: string;
    percentage: number;
  };
}

// Global progress callback
let progressCallback: ((stage: string, progress: number, message?: string) => void) | null = null;

// Global worker instance
let worker: Worker | null = null;

/**
 * Initialize the web worker if not already initialized
 */
function initializeWorker(): Worker {
  if (!worker) {
    worker = new PyWorker(); // Worker is already module-type from &module
  }
  return worker!; // We know it's not null after the check above
}

/**
 * Process matting in web worker and wait for initialization if needed
 */
async function processInWorker(
  imageData: PyomattingIMData,
  trimapData: PyomattingIMData
): Promise<{ resultData: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const worker = initializeWorker();

    const handleMessage = (evt: MessageEvent<WorkerResponse>) => {
      switch (evt.data.type) {
        case "init_progress":
          logger.log(
            `${evt.data.progress?.stage}: ${evt.data.progress?.message}`
          );
          if (progressCallback && evt.data.progress) {
            progressCallback(evt.data.progress.stage, evt.data.progress.percentage, evt.data.progress.message);
          }
          break;
        case "processing_progress":
          if (progressCallback && evt.data.progress) {
            progressCallback(evt.data.progress.stage, evt.data.progress.percentage, evt.data.progress.message);
          }
          break;
        case "matting_complete":
          worker.removeEventListener("message", handleMessage);
          resolve(evt.data.data!);
          break;
        case "matting_error":
          worker.removeEventListener("message", handleMessage);
          reject(new Error(evt.data.error));
          break;
      }
    };

    worker.addEventListener("message", handleMessage);

    // Send processing request with transferable objects for zero-copy transfer
    worker.postMessage({
      type: "process_matting",
      data: { 
        imageData,
        trimapData
      },
    }, { transfer: [imageData.data.buffer, trimapData.data.buffer] });
  });
}

/**
 * Initialize Pyodide runtime and packages in advance
 * This is optional - the runtime will be initialized automatically when needed,
 * but calling this function early can reduce latency for the first processing call
 * @returns Promise that resolves when initialization is complete
 */
export async function initializePyodide(): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = initializeWorker();

    const handleMessage = (evt: MessageEvent<WorkerResponse>) => {
      switch (evt.data.type) {
        case "init_progress":
          logger.log(
            `${evt.data.progress?.stage}: ${evt.data.progress?.message}`
          );
          if (progressCallback && evt.data.progress) {
            progressCallback(evt.data.progress.stage, evt.data.progress.percentage, evt.data.progress.message);
          }
          break;
        case "init_complete":
          worker.removeEventListener("message", handleMessage);
          resolve();
          break;
        case "matting_error":
          worker.removeEventListener("message", handleMessage);
          reject(new Error(evt.data.error));
          break;
      }
    };

    worker.addEventListener("message", handleMessage);

    // Send initialization request
    worker.postMessage({
      type: "initialize_only",
    });
  });
}

/**
 * Add a progress callback function to receive updates during initialization and processing
 * @param fn - Callback function that receives stage name, progress percentage (0-100), and optional message
 */
export function addProgressCallback(fn: (stage: string, progress: number, message?: string) => void): void {
  progressCallback = fn;
}

/**
 * Remove the progress callback
 */
export function removeProgressCallback(): void {
  progressCallback = null;
}

/**
 * Enable or disable verbose logging
 * @param verbose - Whether to enable verbose logging
 */
export function setVerboseLogging(verbose: boolean): void {
  setVerbose(verbose);
}

/**
 * Check if verbose logging is enabled
 * @returns Whether verbose logging is enabled
 */
export function isVerboseLogging(): boolean {
  return getVerbose();
}

/**
 * Performs closed-form alpha matting exactly like rembg's alpha_matting_cutout function
 * @param imageData - PyomattingIMData containing RGB image (3 channels)
 * @param trimapData - PyomattingIMData containing trimap/mask (1 channel) - direct U^2-Net output
 * @returns PyomattingIMData containing RGBA result (4 channels) with background removed and alpha matted
 */
export async function closedFormMatting(
  imageData: PyomattingIMData,
  trimapData: PyomattingIMData
): Promise<PyomattingIMData> {
  try {
    // Validate inputs
    if (imageData.channels !== 3) {
      throw new Error("imageData must have exactly 3 channels (RGB)");
    }
    if (trimapData.channels !== 1) {
      throw new Error("trimapData must have exactly 1 channel");
    }
    if (imageData.width !== trimapData.width || imageData.height !== trimapData.height) {
      throw new Error("imageData and trimapData must have the same dimensions");
    }

    logger.log(`Processing image ${imageData.width}x${imageData.height} with closed-form alpha matting`);

    // Process in web worker using rembg-compatible algorithm
    const { resultData, width, height } = await processInWorker(imageData, trimapData);

    return {
      data: resultData,
      width,
      height,
      channels: 4 // RGBA
    };
  } catch (error) {
    logger.error("Error in closed-form matting:", error);
    throw error;
  }
}

/**
 * Terminate the web worker (useful for cleanup)
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/**
 * Clean up resources and reset state
 */
export function cleanup(): void {
  terminateWorker();
  progressCallback = null;
}

// Import worker as inline module - this creates a Blob URL that works in any environment
import PyWorker from "./pyodide.worker.ts?worker&inline&module";
import { logger, setVerbose, getVerbose } from "./logger";

interface ImageBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

interface WorkerResponse {
  type: "matting_complete" | "matting_error" | "init_progress" | "processing_progress" | "init_complete";
  data?: {
    alphaData: Float32Array;
    foregroundData: Float32Array;
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
  imageBuffer: ImageBuffer,
  trimapBuffer: ImageBuffer
): Promise<{ alphaData: Float32Array; foregroundData: Float32Array; width: number; height: number }> {
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
        imageBuffer: {
          data: imageBuffer.data,
          width: imageBuffer.width,
          height: imageBuffer.height,
          channels: imageBuffer.channels
        },
        trimapBuffer: {
          data: trimapBuffer.data,
          width: trimapBuffer.width,
          height: trimapBuffer.height,
          channels: trimapBuffer.channels
        }
      },
    }, { transfer: [imageBuffer.data.buffer, trimapBuffer.data.buffer] });
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
 * Performs closed-form alpha matting on a single image with trimap and returns RGBA image
 * @param imageData - ImageData from canvas containing the source image
 * @param trimapData - ImageData from canvas containing the trimap
 * @returns ImageData containing the RGBA result image (with foreground colors and alpha)
 */
export async function closedFormMatting(
  imageData: ImageData,
  trimapData: ImageData
): Promise<ImageData> {
  try {
    if (imageData.width !== trimapData.width || imageData.height !== trimapData.height) {
      throw new Error("Image and trimap must have the same dimensions");
    }

    // Create efficient ImageBuffer objects with TypedArrays
    // Use the original data directly to avoid copying
    const imageBuffer: ImageBuffer = {
      data: imageData.data, // Direct reference, no copy
      width: imageData.width,
      height: imageData.height,
      channels: 4 // RGBA
    };

    const trimapBuffer: ImageBuffer = {
      data: trimapData.data, // Direct reference, no copy
      width: trimapData.width,
      height: trimapData.height,
      channels: 4 // RGBA
    };

    logger.log(`Processing single image ${imageData.width}x${imageData.height} using web worker`);

    // Process in web worker
    const { alphaData, foregroundData, width, height } = await processInWorker(
      imageBuffer,
      trimapBuffer
    );

    // Create RGBA ImageData with foreground colors and alpha
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const alphaValue = Math.round(alphaData[i] * 255);
      const baseIndex = i * 4;
      const fgBaseIndex = i * 3;

      // RGB from foreground, alpha from alpha matte
      rgbaData[baseIndex] = Math.round(foregroundData[fgBaseIndex] * 255); // R
      rgbaData[baseIndex + 1] = Math.round(foregroundData[fgBaseIndex + 1] * 255); // G
      rgbaData[baseIndex + 2] = Math.round(foregroundData[fgBaseIndex + 2] * 255); // B
      rgbaData[baseIndex + 3] = alphaValue; // A
    }

    return new ImageData(rgbaData, width, height);
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

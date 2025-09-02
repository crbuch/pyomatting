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
  combinedBuffer: ImageBuffer
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
        combinedBuffer: {
          data: combinedBuffer.data,
          width: combinedBuffer.width,
          height: combinedBuffer.height,
          channels: combinedBuffer.channels
        }
      },
    }, { transfer: [combinedBuffer.data.buffer] });
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
 * Performs closed-form alpha matting on a single image with trimap encoded in alpha channel
 * @param imageData - ImageData from canvas containing the source image with trimap in alpha channel:
 *   - RGB channels: Original image colors
 *   - Alpha channel: Trimap where 0=background, 255=foreground, 128=unknown (to be solved)
 * @param maxDimension - Maximum dimension (width or height) for processing. Images larger than this will be downscaled for processing and then upscaled back. Default: 1024
 * @returns ImageData containing the RGBA result image (with foreground colors and computed alpha)
 */
export async function closedFormMatting(
  imageData: ImageData,
  maxDimension: number = 1024
): Promise<ImageData> {
  try {
    const originalWidth = imageData.width;
    const originalHeight = imageData.height;
    const maxOriginalDimension = Math.max(originalWidth, originalHeight);
    
    let processedImageData = imageData;
    let scaleFactor = 1;
    
    // Check if image needs downscaling
    if (maxOriginalDimension > maxDimension) {
      scaleFactor = maxDimension / maxOriginalDimension;
      const scaledWidth = Math.round(originalWidth * scaleFactor);
      const scaledHeight = Math.round(originalHeight * scaleFactor);
      
      logger.log(`Downscaling image from ${originalWidth}x${originalHeight} to ${scaledWidth}x${scaledHeight} (scale factor: ${scaleFactor.toFixed(3)})`);
      
      // Create canvas to resize the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas to original size and draw the image
      canvas.width = originalWidth;
      canvas.height = originalHeight;
      ctx.putImageData(imageData, 0, 0);
      
      // Create a new canvas for the scaled image
      const scaledCanvas = document.createElement('canvas');
      const scaledCtx = scaledCanvas.getContext('2d')!;
      scaledCanvas.width = scaledWidth;
      scaledCanvas.height = scaledHeight;
      
      // Use high-quality scaling
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';
      
      // Draw scaled image
      scaledCtx.drawImage(canvas, 0, 0, originalWidth, originalHeight, 0, 0, scaledWidth, scaledHeight);
      
      // Get the scaled image data
      processedImageData = scaledCtx.getImageData(0, 0, scaledWidth, scaledHeight);
    }

    // Create a single ImageBuffer that contains both image and trimap data
    const combinedBuffer: ImageBuffer = {
      data: processedImageData.data, // Direct reference, no copy
      width: processedImageData.width,
      height: processedImageData.height,
      channels: 4 // RGBA
    };

    logger.log(`Processing image ${processedImageData.width}x${processedImageData.height} with trimap in alpha channel using web worker`);

    // Process in web worker
    const { alphaData, foregroundData, width, height } = await processInWorker(
      combinedBuffer
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

    let resultImageData = new ImageData(rgbaData, width, height);

    // If we downscaled, upscale the result back to original resolution
    if (scaleFactor < 1) {
      logger.log(`Upscaling result from ${width}x${height} back to ${originalWidth}x${originalHeight}`);
      
      // Create canvas with the processed result
      const resultCanvas = document.createElement('canvas');
      const resultCtx = resultCanvas.getContext('2d')!;
      resultCanvas.width = width;
      resultCanvas.height = height;
      resultCtx.putImageData(resultImageData, 0, 0);
      
      // Create canvas for the final upscaled result
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCanvas.width = originalWidth;
      finalCanvas.height = originalHeight;
      
      // Use high-quality scaling for upscaling
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      
      // Draw upscaled result
      finalCtx.drawImage(resultCanvas, 0, 0, width, height, 0, 0, originalWidth, originalHeight);
      
      // Get the final upscaled image data
      resultImageData = finalCtx.getImageData(0, 0, originalWidth, originalHeight);
    }

    return resultImageData;
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

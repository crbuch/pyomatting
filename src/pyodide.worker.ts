/// <reference lib="webworker" />
import { loadPyodide, type PyodideInterface } from 'pyodide';

// Import Python code as raw strings
import laplacianCode from './python/laplacian.py?raw';
import mattingCode from './python/matting.py?raw';
import foregroundBackgroundCode from './python/foreground_background.py?raw';
import processMattingCode from './python/process_matting.py?raw';

let pyodideInstance: PyodideInterface | null = null;

interface WorkerMessage {
  type: 'process_matting';
  data: {
    imageData: number[][];
    trimapData: number[][];
    widths: number[];
    heights: number[];
  };
}

interface WorkerResponse {
  type: 'matting_complete' | 'matting_error' | 'init_progress';
  data?: {
    batchAlphaLists: number[][];
    batchForegroundLists: number[][];
  };
  error?: string;
  progress?: {
    stage: string;
    message: string;
  };
}

/**
 * Initialize Pyodide if not already initialized
 */
async function initializePyodide(): Promise<PyodideInterface> {
  if (!pyodideInstance) {
    // Send progress updates
    (self as unknown as Worker).postMessage({
      type: 'init_progress',
      progress: { stage: 'loading', message: 'Loading Pyodide...' }
    } as WorkerResponse);
    
    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
    });
    
    (self as unknown as Worker).postMessage({
      type: 'init_progress',
      progress: { stage: 'packages', message: 'Installing required packages...' }
    } as WorkerResponse);
    
    await pyodideInstance.loadPackage(['numpy', 'scipy', 'opencv-python']);
    
    (self as unknown as Worker).postMessage({
      type: 'init_progress',
      progress: { stage: 'modules', message: 'Loading Python modules...' }
    } as WorkerResponse);
    
    // Load Python modules as inline strings
    pyodideInstance.runPython(laplacianCode);
    pyodideInstance.runPython(mattingCode);
    pyodideInstance.runPython(foregroundBackgroundCode);
    
    (self as unknown as Worker).postMessage({
      type: 'init_progress',
      progress: { stage: 'ready', message: 'Pyodide loaded successfully!' }
    } as WorkerResponse);
  }
  return pyodideInstance;
}

self.onmessage = async (evt: MessageEvent<WorkerMessage>) => {
  try {
    if (evt.data.type === 'process_matting') {
      const { imageData, trimapData, widths, heights } = evt.data.data;
      
      if (imageData.length !== trimapData.length) {
        throw new Error('Number of images and trimaps must match');
      }
      
      if (imageData.length === 0) {
        throw new Error('At least one image is required');
      }
      
      const pyodide = await initializePyodide();
      
      // Set the batch data in Python
      pyodide.globals.set("batch_image_data", imageData);
      pyodide.globals.set("batch_trimap_data", trimapData);
      pyodide.globals.set("batch_widths", widths);
      pyodide.globals.set("batch_heights", heights);
      
      // Execute the batch matting algorithm using the inline Python code
      pyodide.runPython(processMattingCode);
      
      // Get the results back as lists
      const batchAlphaLists = pyodide.globals.get('batch_alpha_lists');
      const batchForegroundLists = pyodide.globals.get('batch_foreground_lists');
      
      // Convert Python objects to plain JavaScript arrays to ensure they can be cloned
      const serializedAlphaLists: number[][] = [];
      const serializedForegroundLists: number[][] = [];
      
      for (let i = 0; i < batchAlphaLists.length; i++) {
        serializedAlphaLists.push(Array.from(batchAlphaLists[i]));
        serializedForegroundLists.push(Array.from(batchForegroundLists[i]));
      }
      
      (self as unknown as Worker).postMessage({
        type: 'matting_complete',
        data: {
          batchAlphaLists: serializedAlphaLists,
          batchForegroundLists: serializedForegroundLists
        }
      } as WorkerResponse);
    }
  } catch (error) {
    (self as unknown as Worker).postMessage({
      type: 'matting_error',
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
};

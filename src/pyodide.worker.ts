import { loadPyodide, type PyodideInterface } from "pyodide";
import { logger } from "./logger";

// Import Python code as raw strings
import laplacianCode from "./python/laplacian.py?raw";
import mattingCode from "./python/matting.py?raw";
import foregroundBackgroundCode from "./python/foreground_background.py?raw";
import processMattingCode from "./python/process_matting.py?raw";

let pyodideInstance: PyodideInterface | null = null;

/**
 * Initialize Pyodide if not already initialized
 */
async function initializePyodide(): Promise<PyodideInterface> {
  if (!pyodideInstance) {
    // Send progress updates
    self.postMessage({
      type: "init_progress",
      progress: { stage: "loading", message: "Loading/initializing Pyodide with cache...", percentage: 0 },
    });

    pyodideInstance = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    });

    self.postMessage({
      type: "init_progress",
      progress: {
        stage: "loading",
        message: "Pyodide loaded successfully!",
        percentage: 25,
      },
    });

    self.postMessage({
      type: "init_progress",
      progress: {
        stage: "packages",
        message: "Loading packages with cache (numpy, scipy, opencv-python)...",
        percentage: 25,
      },
    });

    await pyodideInstance.loadPackage(["numpy", "scipy", "opencv-python"]);

    self.postMessage({
      type: "init_progress",
      progress: {
        stage: "packages",
        message: "Packages loaded successfully!",
        percentage: 75,
      },
    });

    self.postMessage({
      type: "init_progress",
      progress: { stage: "modules", message: "Initializing Pyomatting runtime...", percentage: 75 },
    });

    // Load Python modules as inline strings
    pyodideInstance.runPython(laplacianCode);
    pyodideInstance.runPython(mattingCode);
    pyodideInstance.runPython(foregroundBackgroundCode);

    self.postMessage({
      type: "init_progress",
      progress: { stage: "ready", message: "Pyomatting ready!", percentage: 100 },
    });
  }
  return pyodideInstance;
}

self.onmessage = async (evt) => {
  try {
    if (evt.data.type === "initialize_only") {
      // Just initialize Pyodide and send completion signal
      await initializePyodide();
      self.postMessage({
        type: "init_complete",
      });
    } else if (evt.data.type === "process_matting") {
      const { imageBuffer, trimapBuffer } = evt.data.data;

      if (!imageBuffer || !trimapBuffer) {
        throw new Error("Image buffer and trimap buffer are required");
      }

      if (imageBuffer.width !== trimapBuffer.width || imageBuffer.height !== trimapBuffer.height) {
        throw new Error("Image and trimap must have the same dimensions");
      }

      const pyodide = await initializePyodide();

      // Signal start of processing phase
      self.postMessage({
        type: "processing_progress",
        progress: { 
          stage: "processing", 
          message: `Starting processing of ${imageBuffer.width}x${imageBuffer.height} image...`, 
          percentage: 0 
        },
      });

      // Use the TypedArrays directly for efficient memoryview conversion
      // No need to create new Uint8Array, use the data directly
      pyodide.globals.set("image_data_buffer", imageBuffer.data);
      pyodide.globals.set("trimap_data_buffer", trimapBuffer.data);
      pyodide.globals.set("image_width", imageBuffer.width);
      pyodide.globals.set("image_height", imageBuffer.height);
      pyodide.globals.set("image_channels", imageBuffer.channels);
      pyodide.globals.set("trimap_width", trimapBuffer.width);
      pyodide.globals.set("trimap_height", trimapBuffer.height);
      pyodide.globals.set("trimap_channels", trimapBuffer.channels);

      // Create a callback function that Python can call to send progress updates
      const sendProgressCallback = (percentage: number, message: string) => {
        self.postMessage({
          type: "processing_progress",
          progress: { 
            stage: "processing", 
            message, 
            percentage 
          },
        });
      };
      
      // Create a logging function that Python can call
      const pyLogger = (message: string) => {
        logger.log(message);
      };
      
      pyodide.globals.set("send_progress_callback", sendProgressCallback);
      pyodide.globals.set("py_logger", pyLogger);

      // Execute the matting algorithm using the inline Python code
      pyodide.runPython(processMattingCode);

      // Get the results back as TypedArrays for efficient transfer
      const alphaResult = pyodide.globals.get("alpha_result");
      const foregroundResult = pyodide.globals.get("foreground_result");
      const resultWidth = pyodide.globals.get("result_width");
      const resultHeight = pyodide.globals.get("result_height");

      // Convert Python arrays to TypedArrays for efficient transfer
      // Use try-catch for more robust error handling during conversion
      let alphaData: Float32Array;
      let foregroundData: Float32Array;
      
      try {
        const alphaArray = alphaResult.toJs();
        const foregroundArray = foregroundResult.toJs();
        
        // Create TypedArrays directly from the converted arrays
        alphaData = alphaArray instanceof Float32Array ? alphaArray : new Float32Array(alphaArray);
        foregroundData = foregroundArray instanceof Float32Array ? foregroundArray : new Float32Array(foregroundArray);
      } catch (conversionError) {
        // Fallback: convert to regular arrays first, then to TypedArrays
        alphaData = new Float32Array(Array.from(alphaResult.toJs()));
        foregroundData = new Float32Array(Array.from(foregroundResult.toJs()));
      }

      // Signal completion
      self.postMessage({
        type: "processing_progress",
        progress: { 
          stage: "processing", 
          message: "Processing completed!", 
          percentage: 100 
        },
      });

      // Send results with transferable objects for zero-copy transfer
      self.postMessage({
        type: "matting_complete",
        data: {
          alphaData,
          foregroundData,
          width: resultWidth,
          height: resultHeight,
        },
      }, { transfer: [alphaData.buffer, foregroundData.buffer] });
    }
  } catch (error) {
    self.postMessage({
      type: "matting_error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

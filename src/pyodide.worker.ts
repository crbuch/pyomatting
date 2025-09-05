import { loadPyodide, type PyodideInterface } from "pyodide";
import { logger } from "./logger";

// Import Python code as raw strings
import mainCode from "./python/main.py?raw";
import closedFormMattingCode from "./python/closed_form_matting/closed_form_matting.py?raw";
import solveForegroundBackgroundCode from "./python/closed_form_matting/solve_foreground_background.py?raw";

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

    // Load the closed-form matting modules first
    pyodideInstance.runPython(closedFormMattingCode);
    pyodideInstance.runPython(solveForegroundBackgroundCode);
    
    // Load main processing module
    pyodideInstance.runPython(mainCode);

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
      const { imageData, trimapData } = evt.data.data;

      if (!imageData || !trimapData) {
        throw new Error("Both imageData and trimapData are required");
      }

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

      const pyodide = await initializePyodide();

      // Signal start of processing phase
      self.postMessage({
        type: "processing_progress",
        progress: { 
          stage: "processing", 
          message: `Starting rembg-compatible alpha matting of ${imageData.width}x${imageData.height} image...`, 
          percentage: 0 
        },
      });

      // Pass image and trimap data to Python global variables
      pyodide.globals.set("image_data_buffer_global", imageData.data);
      pyodide.globals.set("trimap_data_buffer_global", trimapData.data);
      pyodide.globals.set("image_width_global", imageData.width);
      pyodide.globals.set("image_height_global", imageData.height);

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
        logger.log("[Python] " + message);
      };
      
      pyodide.globals.set("send_progress_callback", sendProgressCallback);
      pyodide.globals.set("py_logger", pyLogger);

      // Execute the main processing function which will handle the entire rembg workflow
      pyodide.runPython(`
# Call the main processing function directly
process_alpha_matting()
`);

      // Get the results back as TypedArrays for efficient transfer
      const resultData = pyodide.globals.get("result_data_global");
      const resultWidth = pyodide.globals.get("result_width_global");
      const resultHeight = pyodide.globals.get("result_height_global");

      // Convert Python array to TypedArray for efficient transfer
      const resultUint8Array = new Uint8Array(resultData.toJs());

      // Signal completion
      self.postMessage({
        type: "processing_progress",
        progress: { 
          stage: "processing", 
          message: "Alpha matting completed!", 
          percentage: 100 
        },
      });

      // Send results with transferable objects for zero-copy transfer
      self.postMessage({
        type: "matting_complete",
        data: {
          resultData: resultUint8Array,
          width: resultWidth,
          height: resultHeight,
        },
      }, { transfer: [resultUint8Array.buffer] });
    }
  } catch (error) {
    self.postMessage({
      type: "matting_error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

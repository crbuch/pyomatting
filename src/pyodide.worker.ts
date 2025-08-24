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
      const { imageData, trimapData, widths, heights } = evt.data.data;

      if (imageData.length !== trimapData.length) {
        throw new Error("Number of images and trimaps must match");
      }

      if (imageData.length === 0) {
        throw new Error("At least one image is required");
      }

      const pyodide = await initializePyodide();

      // Signal start of processing phase
      self.postMessage({
        type: "processing_progress",
        progress: { 
          stage: "processing", 
          message: `Starting batch processing of ${imageData.length} images...`, 
          percentage: 0 
        },
      });

      // Set the batch data in Python
      pyodide.globals.set("batch_image_data", imageData);
      pyodide.globals.set("batch_trimap_data", trimapData);
      pyodide.globals.set("batch_widths", widths);
      pyodide.globals.set("batch_heights", heights);

      // Create a callback function that Python can call to send progress updates
      const sendProgressCallback = (currentImage: number, totalImages: number) => {
        const percentage = Math.round((currentImage / totalImages) * 100);
        self.postMessage({
          type: "processing_progress",
          progress: { 
            stage: "processing", 
            message: `Processing image ${currentImage + 1} of ${totalImages}...`, 
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

      // Execute the batch matting algorithm using the inline Python code
      pyodide.runPython(processMattingCode);

      // Get the results back as lists
      const batchAlphaLists = pyodide.globals.get("batch_alpha_lists");
      const batchForegroundLists = pyodide.globals.get(
        "batch_foreground_lists"
      );

      // Convert Python objects to plain JavaScript arrays to ensure they can be cloned
      const serializedAlphaLists: number[][] = [];
      const serializedForegroundLists: number[][] = [];

      for (let i = 0; i < batchAlphaLists.length; i++) {
        serializedAlphaLists.push(Array.from(batchAlphaLists[i]));
        serializedForegroundLists.push(Array.from(batchForegroundLists[i]));
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

      self.postMessage({
        type: "matting_complete",
        data: {
          batchAlphaLists: serializedAlphaLists,
          batchForegroundLists: serializedForegroundLists,
        },
      });
    }
  } catch (error) {
    self.postMessage({
      type: "matting_error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

# Pyomatting

A TypeScript package that implements closed-form alpha matting using Pyodide to run Python algorithms in the browser. This package brings the power of the closed-form matting algorithm from [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting) to web browsers via WebAssembly with optimized memory usage through TypedArrays and efficient data transfer.

## Features

- 🎭 **Closed-Form Alpha Matting**: State-of-the-art alpha matting algorithm based on Levin et al. (2007)
- 🐍 **Python in the Browser**: Leverages Pyodide to run NumPy, SciPy, and OpenCV in WebAssembly
- 📦 **TypeScript Support**: Full type definitions and modern ES modules
- 🛠️ **Modular Architecture**: Clean separation of Python algorithms in separate files
- ⚡ **Pre-initialization**: Optional runtime pre-loading for reduced latency
- 🧠 **Memory Efficient**: Uses TypedArrays and transferable objects for zero-copy data transfer
- 📊 **Progress Callbacks**: Real-time progress updates during initialization and processing
- 🔧 **Configurable Logging**: Verbose logging support for debugging
- 🎨 **Interactive Demo**: Complete web interface for testing the algorithms
- 📱 **Single Image Processing**: Efficient processing of individual images with optimized memory usage

## Installation

```bash
npm install pyomatting
```

## Quick Start

```typescript
import { closedFormMatting } from 'pyomatting';

// Perform alpha matting on ImageData with trimap in alpha channel
const alphaImageData = await closedFormMatting(combinedImageData);
```

## API Reference

### Core Functions

#### `closedFormMatting(imageData: ImageData): Promise<ImageData>`

Performs closed-form alpha matting on a single image with trimap encoded in the alpha channel.

**Parameters:**
- `imageData`: ImageData from canvas containing both the source image and trimap:
  - RGB channels: Original image colors (0-255)
  - Alpha channel: Trimap values where 0=background, 255=foreground, 128=unknown

**Returns:** ImageData containing the computed RGBA result image (with foreground colors and computed alpha)

#### `initializePyodide(): Promise<void>`

Pre-initializes the Pyodide runtime and packages. This is optional but recommended for better user experience.

```typescript
import { initializePyodide } from 'pyomatting';

// Pre-initialize to reduce latency for first processing call
await initializePyodide();
```

### Progress & Logging

#### `addProgressCallback(fn: (stage: string, progress: number, message?: string) => void): void`

Add a callback to receive progress updates during initialization and processing.

```typescript
import { addProgressCallback } from 'pyomatting';

addProgressCallback((stage, progress, message) => {
  console.log(`${stage}: ${progress}% - ${message}`);
});
```

#### `setVerboseLogging(verbose: boolean): void`

Enable or disable verbose logging for debugging.

```typescript
import { setVerboseLogging } from 'pyomatting';

setVerboseLogging(true); // Enable detailed logging
```

#### `removeProgressCallback(): void`

Remove the current progress callback.

#### `terminateWorker(): void`

Terminate the web worker (useful for cleanup).

## Example Usage

```typescript
import { 
  closedFormMatting, 
  addProgressCallback, 
  setVerboseLogging,
  initializePyodide 
} from 'pyomatting';

// Enable logging for development
setVerboseLogging(true);

// Set up progress tracking
addProgressCallback((stage, progress, message) => {
  document.getElementById('progress').textContent = `${message} (${progress}%)`;
});

// Optional: Pre-initialize for faster first run
await initializePyodide();

// Combine image and trimap into single ImageData
function combineImageWithTrimap(sourceImg: HTMLImageElement, trimapImg: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = sourceImg.width;
  canvas.height = sourceImg.height;
  
  // Draw source image to get RGB data
  ctx.drawImage(sourceImg, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Draw trimap to get alpha data
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(trimapImg, 0, 0);
  const trimapData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Combine: RGB from source, Alpha from trimap
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i + 3] = trimapData.data[i]; // Alpha from trimap's red channel
  }
  
  return imageData;
}

// Process image
const combinedData = combineImageWithTrimap(sourceImage, trimapImage);
const result = await closedFormMatting(combinedData);
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run example demo
npm run example
```

The `examples` folder contains a complete interactive demo with:
- Drag & drop image upload interface
- Interactive trimap editor
- Real-time progress tracking
- Sequential processing of multiple images for memory efficiency
- Side-by-side result comparison

## Algorithm

This package implements the closed-form alpha matting algorithm described in:

> **"A Closed-Form Solution to Natural Image Matting"** by Levin, Lischinski, and Weiss (2007)

The implementation is based on the Python version from [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting), adapted to run in the browser using Pyodide.

### How it works:

1. **Laplacian Computation**: Builds a sparse matting Laplacian matrix from local image neighborhoods
2. **Quadratic Optimization**: Formulates alpha estimation as a constrained quadratic optimization problem
3. **Sparse Solving**: Uses sparse linear algebra (SciPy) to solve for alpha values efficiently
4. **Foreground Estimation**: Computes separated foreground colors using additional constraints

## Performance

- **First Run**: ~10-30 seconds (downloads and initializes Pyodide + packages)
- **Subsequent Runs**: ~1-5 seconds per image (cached runtime)
- **Memory**: ~200-500MB (depending on image size and browser)

Use `initializePyodide()` to pre-load the runtime during app initialization for better UX.

## Browser Requirements

- Modern browser with WebAssembly support
- Internet connection (for loading Pyodide and packages from CDN on first run)
- Sufficient memory for image processing (recommend 4GB+ RAM for large images)

## Credits

- **Original Algorithm**: Levin, Lischinski, and Weiss (2007)
- **Python Implementation**: [MarcoForte/closed-form-matting](https://github.com/MarcoForte/closed-form-matting)
- **Web Adaptation**: This package (Pyodide + TypeScript wrapper)

## License

MIT

## Contributing

Issues and pull requests are welcome! Please ensure any changes maintain compatibility with the existing API.

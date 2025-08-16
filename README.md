# Pyomatting

A TypeScript package that implements closed-form alpha matting using Pyodide to run Python algorithms in the browser.

## Features

- 🎭 **Closed-Form Alpha Matting**: State-of-the-art alpha matting algorithm
- 🐍 **Python in the Browser**: Leverages Pyodide to run NumPy, SciPy, and OpenCV
- 📦 **TypeScript Support**: Full type definitions and modern ES modules
- �️ **Modular Architecture**: Clean separation of Python algorithms in separate files
- ⚡ **Vite-Powered**: Modern bundling with optimized builds
- 🎨 **Interactive Demo**: Complete web interface for testing the algorithms

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

```typescript
import { closedFormMatting } from 'pyomatting';

// Perform alpha matting on ImageData from canvas
const alphaImageData = await closedFormMatting(imageData, trimapData);
```

## API

### `closedFormMatting(imageData: ImageData[], trimapData: ImageData[]): Promise<ImageData[]>`

Performs closed-form alpha matting on multiple images using trimaps.

**Parameters:**
- `imageData`: Array of ImageData from canvas containing the source images (RGB)
- `trimapData`: Array of ImageData from canvas containing the trimaps where:
  - Black (0) = definitely background
  - White (255) = definitely foreground  
  - Gray (128) = unknown regions to be computed

**Returns:** Array of ImageData containing the computed RGBA result images (with foreground colors and alpha)

## Example

The `examples` folder contains a complete interactive demo:

1. Build the main package:
   ```bash
   npm run build
   ```

2. Run the example:
   ```bash
   npm run example
   ```

3. Open `http://localhost:5173` in your browser

The demo provides:
- Drag & drop image upload interface
- Interactive trimap editor
- Real-time alpha matting processing
- Side-by-side result comparison

## Project Structure

```
src/
├── python/
│   ├── laplacian.py       # Laplacian matrix computation
│   ├── matting.py         # Core matting algorithms
│   └── process_matting.py # Image processing pipeline
├── index.ts              # Main TypeScript entry point
└── types.d.ts            # Type declarations for Python imports
```

## Algorithm

This package implements the closed-form alpha matting algorithm described in:

> "A Closed-Form Solution to Natural Image Matting" by Levin et al. (2007)

The algorithm:
1. Computes a matting Laplacian matrix from the input image
2. Formulates alpha estimation as a quadratic optimization problem
3. Solves for alpha values in unknown regions using sparse linear algebra
4. Produces smooth, accurate alpha mattes

## Requirements

- Modern browser with WebAssembly support
- Internet connection (for loading Pyodide and packages from CDN)
- Images and trimaps should have matching dimensions

## How it works

1. Loads Pyodide with NumPy, SciPy, and OpenCV packages
2. Imports modular Python algorithm files as strings via Vite
3. Converts JavaScript ImageData to NumPy arrays
4. Executes closed-form matting algorithm in Python
5. Returns results as ImageData for display in browser

## License

MIT

# Pyomatting

A TypeScript package that uses Pyodide to run Python code in the browser.

## Features

- 🐍 Run Python code in the browser via Pyodide
- 📦 TypeScript support with full type definitions
- 🚀 Simple API with `callPyodide()` function
- 📝 Example implementation included

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
import { callPyodide } from 'pyomatting';

// This will print "Hello World" from Python via Pyodide
await callPyodide();
```

## API

### `callPyodide(): Promise<void>`

Executes Python code that prints "Hello World" to the console.

### `getPyodideInstance(): Promise<PyodideInterface>`

Returns the Pyodide instance for advanced usage.

## Example

The `examples` folder contains a working demo:

1. Build the main package:
   ```bash
   npm run build
   ```

2. Run the example:
   ```bash
   npm run example
   ```

This will start a Vite development server at `http://localhost:3000` with a demo page that shows how to use the package.

## How it works

1. The package loads Pyodide from the CDN
2. Initializes a Python runtime in the browser
3. Executes Python code that prints "Hello World"
4. The output appears in the browser console

## Requirements

- Modern browser with WebAssembly support
- Internet connection (for loading Pyodide from CDN)

## License

MIT

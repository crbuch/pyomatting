
// Worker module declarations
declare module '*?worker&inline&module' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module '*?worker&url' {
  const workerUrl: string;
  export default workerUrl;
}

// Raw file imports
declare module '*.py?raw' {
  const content: string;
  export default content;
}

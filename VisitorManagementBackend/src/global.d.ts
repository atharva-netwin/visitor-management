/// <reference types="node" />

declare global {
  var process: NodeJS.Process;
  var global: NodeJS.Global;
  var __dirname: string;
  var __filename: string;
  var require: NodeRequire;
  var module: NodeModule;
  var exports: any;
  var Buffer: BufferConstructor;
}

export {};
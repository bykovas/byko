#!/usr/bin/env node
/* website/app227 is generator-owned. Hand-edits there will be overwritten. */

import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(appRoot, "dist/client");
const websiteRoot = resolve(appRoot, "../website");
const targetDir = resolve(websiteRoot, "app227");

if (relative(websiteRoot, targetDir) !== "app227") {
  throw new Error(`refusing to empty unexpected export target: ${targetDir}`);
}

const source = await stat(sourceDir);
if (!source.isDirectory()) {
  throw new Error(`build output is not a directory: ${sourceDir}`);
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });

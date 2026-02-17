import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

export interface FileReadOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface FileWriteOptions {
  encoding?: BufferEncoding;
  mode?: number;
  flag?: string;
}

export interface DirOptions {
  recursive?: boolean;
  mode?: number;
}

export async function readFileAsync(
  filePath: string,
  options: FileReadOptions = {}
): Promise<string> {
  const { encoding = 'utf-8', flag } = options;
  return fsPromises.readFile(filePath, { encoding, flag });
}

export async function writeFileAsync(
  filePath: string,
  data: string | Buffer,
  options: FileWriteOptions = {}
): Promise<void> {
  const { encoding = 'utf-8', mode, flag } = options;
  await fsPromises.writeFile(filePath, data, { encoding, mode, flag });
}

export async function appendFileAsync(
  filePath: string,
  data: string | Buffer,
  options: FileWriteOptions = {}
): Promise<void> {
  const { encoding = 'utf-8', mode } = options;
  await fsPromises.appendFile(filePath, data, { encoding, mode });
}

export async function existsAsync(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function mkdirAsync(
  dirPath: string,
  options: DirOptions = {}
): Promise<void> {
  const { recursive = true, mode } = options;
  await fsPromises.mkdir(dirPath, { recursive, mode });
}

export async function readdirAsync(
  dirPath: string,
  withFileTypes?: false
): Promise<string[]>;
export async function readdirAsync(
  dirPath: string,
  withFileTypes: true
): Promise<fs.Dirent[]>;
export async function readdirAsync(
  dirPath: string,
  withFileTypes?: boolean
): Promise<string[] | fs.Dirent[]> {
  if (withFileTypes) {
    return fsPromises.readdir(dirPath, { withFileTypes: true });
  }
  return fsPromises.readdir(dirPath);
}

export async function statAsync(filePath: string): Promise<fs.Stats> {
  return fsPromises.stat(filePath);
}

export async function lstatAsync(filePath: string): Promise<fs.Stats> {
  return fsPromises.lstat(filePath);
}

export async function unlinkAsync(filePath: string): Promise<void> {
  await fsPromises.unlink(filePath);
}

export async function rmdirAsync(dirPath: string): Promise<void> {
  await fsPromises.rmdir(dirPath);
}

export async function rmAsync(
  targetPath: string,
  options: { recursive?: boolean; force?: boolean } = {}
): Promise<void> {
  const { recursive = false, force = false } = options;
  await fsPromises.rm(targetPath, { recursive, force });
}

export async function copyFileAsync(
  src: string,
  dest: string,
  mode?: number
): Promise<void> {
  await fsPromises.copyFile(src, dest, mode);
}

export async function renameAsync(oldPath: string, newPath: string): Promise<void> {
  await fsPromises.rename(oldPath, newPath);
}

export async function readJsonAsync<T = unknown>(filePath: string): Promise<T> {
  const content = await readFileAsync(filePath);
  return JSON.parse(content);
}

export async function writeJsonAsync<T>(
  filePath: string,
  data: T,
  pretty: boolean = true
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFileAsync(filePath, content);
}

export async function ensureDirAsync(dirPath: string): Promise<void> {
  const exists = await existsAsync(dirPath);
  if (!exists) {
    await mkdirAsync(dirPath, { recursive: true });
  }
}

export async function ensureFileAsync(filePath: string): Promise<void> {
  const exists = await existsAsync(filePath);
  if (!exists) {
    const dir = path.dirname(filePath);
    await ensureDirAsync(dir);
    await writeFileAsync(filePath, '');
  }
}

export async function readLinesAsync(filePath: string): Promise<string[]> {
  const content = await readFileAsync(filePath);
  return content.split(/\r?\n/);
}

export async function writeLinesAsync(
  filePath: string,
  lines: string[]
): Promise<void> {
  await writeFileAsync(filePath, lines.join('\n'));
}

export async function walkDirAsync(
  dirPath: string,
  callback: (filePath: string, stats: fs.Stats) => Promise<void>,
  options: { recursive?: boolean } = {}
): Promise<void> {
  const { recursive = true } = options;
  const entries = await readdirAsync(dirPath, true);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stats = await lstatAsync(fullPath);

    if (stats.isDirectory() && recursive) {
      await walkDirAsync(fullPath, callback, options);
    } else if (stats.isFile()) {
      await callback(fullPath, stats);
    }
  }
}

export async function findFilesAsync(
  dirPath: string,
  pattern: RegExp | string
): Promise<string[]> {
  const results: string[] = [];
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  await walkDirAsync(dirPath, async (filePath) => {
    if (regex.test(filePath)) {
      results.push(filePath);
    }
  });

  return results;
}

export async function getFileSizeAsync(filePath: string): Promise<number> {
  const stats = await statAsync(filePath);
  return stats.size;
}

export async function isDirectoryAsync(filePath: string): Promise<boolean> {
  try {
    const stats = await lstatAsync(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function isFileAsync(filePath: string): Promise<boolean> {
  try {
    const stats = await lstatAsync(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export const asyncFs = {
  readFile: readFileAsync,
  writeFile: writeFileAsync,
  appendFile: appendFileAsync,
  exists: existsAsync,
  mkdir: mkdirAsync,
  readdir: readdirAsync,
  stat: statAsync,
  lstat: lstatAsync,
  unlink: unlinkAsync,
  rmdir: rmdirAsync,
  rm: rmAsync,
  copyFile: copyFileAsync,
  rename: renameAsync,
  readJson: readJsonAsync,
  writeJson: writeJsonAsync,
  ensureDir: ensureDirAsync,
  ensureFile: ensureFileAsync,
  readLines: readLinesAsync,
  writeLines: writeLinesAsync,
  walkDir: walkDirAsync,
  findFiles: findFilesAsync,
  getFileSize: getFileSizeAsync,
  isDirectory: isDirectoryAsync,
  isFile: isFileAsync,
};

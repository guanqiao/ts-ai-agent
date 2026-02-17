import {
  readFileAsync,
  writeFileAsync,
  existsAsync,
  mkdirAsync,
  readdirAsync,
  unlinkAsync,
  readJsonAsync,
  writeJsonAsync,
  ensureDirAsync,
  isDirectoryAsync,
  isFileAsync,
  asyncFs,
} from '@utils/async-fs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('async-fs', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'async-fs-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('writeFileAsync & readFileAsync', () => {
    it('should write and read a file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, World!';

      await writeFileAsync(filePath, content);
      const result = await readFileAsync(filePath);

      expect(result).toBe(content);
    });

    it('should write and read with custom encoding', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, UTF-8!';

      await writeFileAsync(filePath, content, { encoding: 'utf-8' });
      const result = await readFileAsync(filePath, { encoding: 'utf-8' });

      expect(result).toBe(content);
    });
  });

  describe('existsAsync', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await writeFileAsync(filePath, 'test');

      const result = await existsAsync(filePath);

      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const result = await existsAsync(path.join(tempDir, 'nonexistent.txt'));

      expect(result).toBe(false);
    });
  });

  describe('mkdirAsync', () => {
    it('should create directory', async () => {
      const dirPath = path.join(tempDir, 'new-dir');

      await mkdirAsync(dirPath);

      expect(await existsAsync(dirPath)).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      const dirPath = path.join(tempDir, 'a', 'b', 'c');

      await mkdirAsync(dirPath, { recursive: true });

      expect(await existsAsync(dirPath)).toBe(true);
    });
  });

  describe('readdirAsync', () => {
    it('should read directory contents', async () => {
      await writeFileAsync(path.join(tempDir, 'file1.txt'), 'content1');
      await writeFileAsync(path.join(tempDir, 'file2.txt'), 'content2');

      const result = await readdirAsync(tempDir);

      expect(result).toContain('file1.txt');
      expect(result).toContain('file2.txt');
    });

    it('should read directory with file types', async () => {
      await writeFileAsync(path.join(tempDir, 'file.txt'), 'content');
      await mkdirAsync(path.join(tempDir, 'subdir'));

      const result = await readdirAsync(tempDir, true);

      expect(result.some(e => e.name === 'file.txt' && e.isFile())).toBe(true);
      expect(result.some(e => e.name === 'subdir' && e.isDirectory())).toBe(true);
    });
  });

  describe('unlinkAsync', () => {
    it('should delete a file', async () => {
      const filePath = path.join(tempDir, 'to-delete.txt');
      await writeFileAsync(filePath, 'content');

      await unlinkAsync(filePath);

      expect(await existsAsync(filePath)).toBe(false);
    });
  });

  describe('readJsonAsync & writeJsonAsync', () => {
    it('should write and read JSON', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const data = { name: 'test', value: 123 };

      await writeJsonAsync(filePath, data);
      const result = await readJsonAsync(filePath);

      expect(result).toEqual(data);
    });

    it('should write compact JSON when pretty is false', async () => {
      const filePath = path.join(tempDir, 'compact.json');
      const data = { a: 1 };

      await writeJsonAsync(filePath, data, false);
      const content = await readFileAsync(filePath);

      expect(content).toBe('{"a":1}');
    });
  });

  describe('ensureDirAsync', () => {
    it('should create directory if not exists', async () => {
      const dirPath = path.join(tempDir, 'ensured');

      await ensureDirAsync(dirPath);

      expect(await existsAsync(dirPath)).toBe(true);
    });

    it('should not throw if directory exists', async () => {
      const dirPath = path.join(tempDir, 'existing');
      await mkdirAsync(dirPath);

      await expect(ensureDirAsync(dirPath)).resolves.not.toThrow();
    });
  });

  describe('isDirectoryAsync', () => {
    it('should return true for directory', async () => {
      const dirPath = path.join(tempDir, 'dir');
      await mkdirAsync(dirPath);

      const result = await isDirectoryAsync(dirPath);

      expect(result).toBe(true);
    });

    it('should return false for file', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      await writeFileAsync(filePath, 'content');

      const result = await isDirectoryAsync(filePath);

      expect(result).toBe(false);
    });
  });

  describe('isFileAsync', () => {
    it('should return true for file', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      await writeFileAsync(filePath, 'content');

      const result = await isFileAsync(filePath);

      expect(result).toBe(true);
    });

    it('should return false for directory', async () => {
      const dirPath = path.join(tempDir, 'dir');
      await mkdirAsync(dirPath);

      const result = await isFileAsync(dirPath);

      expect(result).toBe(false);
    });
  });

  describe('asyncFs', () => {
    it('should expose all async functions', () => {
      expect(asyncFs.readFile).toBe(readFileAsync);
      expect(asyncFs.writeFile).toBe(writeFileAsync);
      expect(asyncFs.exists).toBe(existsAsync);
      expect(asyncFs.mkdir).toBe(mkdirAsync);
      expect(asyncFs.readdir).toBe(readdirAsync);
      expect(asyncFs.unlink).toBe(unlinkAsync);
      expect(asyncFs.readJson).toBe(readJsonAsync);
      expect(asyncFs.writeJson).toBe(writeJsonAsync);
      expect(asyncFs.ensureDir).toBe(ensureDirAsync);
      expect(asyncFs.isDirectory).toBe(isDirectoryAsync);
      expect(asyncFs.isFile).toBe(isFileAsync);
    });
  });
});

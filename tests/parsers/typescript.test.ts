import { TypeScriptParser } from '../../src/parsers/typescript';
import { SymbolKind, Language, CodeSymbol } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_TS_CODE = `
import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';

/**
 * Represents a user in the system
 */
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

/**
 * Service for managing users
 */
@Injectable()
export class UserManager {
  private users: Map<string, User> = new Map();

  constructor(private userService: UserService) {}

  /**
   * Add a new user
   * @param user - The user to add
   * @returns The added user
   */
  addUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  /**
   * Get a user by ID
   * @param id - The user ID
   */
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Delete a user
   */
  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }
}

export type UserRole = 'admin' | 'user' | 'guest';

export const DEFAULT_PAGE_SIZE = 10;

export function formatDate(date: Date): string {
  return date.toISOString();
}
`;

describe('TypeScriptParser', () => {
  let parser: TypeScriptParser;
  let tempFile: string;

  beforeAll(() => {
    parser = new TypeScriptParser();
    tempFile = path.join(__dirname, 'sample.test.ts');
    fs.writeFileSync(tempFile, SAMPLE_TS_CODE);
  });

  afterAll(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  describe('isSupported', () => {
    it('should support .ts files', () => {
      expect(parser.isSupported('test.ts')).toBe(true);
    });

    it('should support .tsx files', () => {
      expect(parser.isSupported('test.tsx')).toBe(true);
    });

    it('should support .js files', () => {
      expect(parser.isSupported('test.js')).toBe(true);
    });

    it('should not support .java files', () => {
      expect(parser.isSupported('test.java')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse a TypeScript file', async () => {
      const result = await parser.parse(tempFile);

      expect(result.path).toBe(tempFile);
      expect(result.language).toBe(Language.TypeScript);
      expect(result.symbols.length).toBeGreaterThan(0);
    });

    it('should extract interface', async () => {
      const result = await parser.parse(tempFile);
      const userInterface = result.symbols.find((s: CodeSymbol) => s.name === 'User');

      expect(userInterface).toBeDefined();
      expect(userInterface?.kind).toBe(SymbolKind.Interface);
      expect(userInterface?.description).toContain('user in the system');
      expect(userInterface?.members).toBeDefined();
      expect(userInterface?.members?.length).toBe(4);
    });

    it('should extract class with decorators', async () => {
      const result = await parser.parse(tempFile);
      const userManager = result.symbols.find((s: CodeSymbol) => s.name === 'UserManager');

      expect(userManager).toBeDefined();
      expect(userManager?.kind).toBe(SymbolKind.Class);
      expect(userManager?.decorators).toBeDefined();
      expect(userManager?.decorators?.length).toBeGreaterThan(0);
      expect(userManager?.decorators?.[0].name).toBe('Injectable');
    });

    it('should extract class methods', async () => {
      const result = await parser.parse(tempFile);
      const userManager = result.symbols.find((s: CodeSymbol) => s.name === 'UserManager');

      expect(userManager?.members).toBeDefined();

      const addUser = userManager?.members?.find((m: CodeSymbol) => m.name === 'addUser');
      expect(addUser).toBeDefined();
      expect(addUser?.kind).toBe(SymbolKind.Method);
      expect(addUser?.parameters).toBeDefined();
      expect(addUser?.parameters?.length).toBe(1);
    });

    it('should extract type alias', async () => {
      const result = await parser.parse(tempFile);
      const userRole = result.symbols.find((s: CodeSymbol) => s.name === 'UserRole');

      expect(userRole).toBeDefined();
      expect(userRole?.kind).toBe(SymbolKind.TypeAlias);
    });

    it('should extract constant', async () => {
      const result = await parser.parse(tempFile);
      const defaultPageSize = result.symbols.find((s: CodeSymbol) => s.name === 'DEFAULT_PAGE_SIZE');

      expect(defaultPageSize).toBeDefined();
      expect(defaultPageSize?.kind).toBe(SymbolKind.Constant);
    });

    it('should extract function', async () => {
      const result = await parser.parse(tempFile);
      const formatDate = result.symbols.find((s: CodeSymbol) => s.name === 'formatDate');

      expect(formatDate).toBeDefined();
      expect(formatDate?.kind).toBe(SymbolKind.Function);
      expect(formatDate?.parameters).toBeDefined();
      expect(formatDate?.parameters?.length).toBe(1);
    });

    it('should extract imports', async () => {
      const result = await parser.parse(tempFile);

      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.imports.some((i) => i.source === '@nestjs/common')).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(parser.parse('/non/existent/file.ts')).rejects.toThrow();
    });
  });
});

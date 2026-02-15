import { JavaParser } from '../../src/parsers/java';
import { SymbolKind, Language, CodeSymbol } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_JAVA_CODE = `
package com.example.demo;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.ArrayList;

/**
 * User entity representing a system user
 */
public class User {
    private String id;
    private String name;
    private String email;
    
    public User() {}
    
    public User(String id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }
    
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}

/**
 * Service for managing users
 */
@Service
public class UserService {
    private List<User> users = new ArrayList<>();
    
    /**
     * Add a new user
     * @param user the user to add
     * @return the added user
     */
    public User addUser(User user) {
        users.add(user);
        return user;
    }
    
    /**
     * Find user by ID
     * @param id the user ID
     * @return the user or null
     */
    public User findById(String id) {
        return users.stream()
            .filter(u -> u.getId().equals(id))
            .findFirst()
            .orElse(null);
    }
    
    public List<User> getAllUsers() {
        return new ArrayList<>(users);
    }
}

interface UserRepository {
    User save(User user);
    User findById(String id);
    List<User> findAll();
    void delete(String id);
}
`;

describe('JavaParser', () => {
  let parser: JavaParser;
  let tempFile: string;

  beforeAll(() => {
    parser = new JavaParser();
    tempFile = path.join(__dirname, 'Sample.java');
    fs.writeFileSync(tempFile, SAMPLE_JAVA_CODE);
  });

  afterAll(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  describe('isSupported', () => {
    it('should support .java files', () => {
      expect(parser.isSupported('Test.java')).toBe(true);
    });

    it('should not support .ts files', () => {
      expect(parser.isSupported('Test.ts')).toBe(false);
    });

    it('should not support .js files', () => {
      expect(parser.isSupported('Test.js')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse a Java file', async () => {
      const result = await parser.parse(tempFile);

      expect(result.path).toBe(tempFile);
      expect(result.language).toBe(Language.Java);
      expect(result.symbols.length).toBeGreaterThan(0);
    });

    it('should extract classes', async () => {
      const result = await parser.parse(tempFile);
      const classes = result.symbols.filter((s: CodeSymbol) => s.kind === SymbolKind.Class);

      expect(classes.length).toBeGreaterThan(0);
      expect(classes.some((c: CodeSymbol) => c.name === 'User')).toBe(true);
      expect(classes.some((c: CodeSymbol) => c.name === 'UserService')).toBe(true);
    });

    it('should extract interfaces', async () => {
      const result = await parser.parse(tempFile);
      const interfaces = result.symbols.filter((s: CodeSymbol) => s.kind === SymbolKind.Interface);

      expect(interfaces.length).toBeGreaterThan(0);
      expect(interfaces.some((i: CodeSymbol) => i.name === 'UserRepository')).toBe(true);
    });

    it('should extract class members', async () => {
      const result = await parser.parse(tempFile);
      const userClass = result.symbols.find((s: CodeSymbol) => s.name === 'User' && s.kind === SymbolKind.Class);

      expect(userClass?.members).toBeDefined();
      expect(userClass?.members?.length).toBeGreaterThan(0);
    });

    it('should extract imports', async () => {
      const result = await parser.parse(tempFile);

      expect(result.imports.length).toBeGreaterThan(0);
      expect(result.imports.some((i) => i.source.includes('springframework'))).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(parser.parse('/non/existent/File.java')).rejects.toThrow();
    });
  });
});

import { CommandRegistry, Command, CommandContext } from '@cli/commands';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register', () => {
    it('should register a command', () => {
      const command: Command = {
        name: 'test',
        description: 'Test command',
        execute: jest.fn(),
      };

      registry.register(command);

      expect(registry.has('test')).toBe(true);
    });

    it('should throw error for duplicate command', () => {
      const command1: Command = {
        name: 'test',
        description: 'Test command 1',
        execute: jest.fn(),
      };
      const command2: Command = {
        name: 'test',
        description: 'Test command 2',
        execute: jest.fn(),
      };

      registry.register(command1);

      expect(() => registry.register(command2)).toThrow();
    });
  });

  describe('get', () => {
    it('should return registered command', () => {
      const command: Command = {
        name: 'test',
        description: 'Test command',
        execute: jest.fn(),
      };

      registry.register(command);

      expect(registry.get('test')).toBe(command);
    });

    it('should return undefined for unregistered command', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should execute registered command', async () => {
      const mockExecute = jest.fn().mockResolvedValue('result');
      const command: Command = {
        name: 'test',
        description: 'Test command',
        execute: mockExecute,
      };

      registry.register(command);
      const context: CommandContext = { args: ['arg1', 'arg2'], options: {} };
      const result = await registry.execute('test', context);

      expect(mockExecute).toHaveBeenCalledWith(context);
      expect(result).toBe('result');
    });

    it('should throw error for unregistered command', async () => {
      const context: CommandContext = { args: [], options: {} };

      await expect(registry.execute('unknown', context)).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should return all registered commands', () => {
      const command1: Command = {
        name: 'test1',
        description: 'Test command 1',
        execute: jest.fn(),
      };
      const command2: Command = {
        name: 'test2',
        description: 'Test command 2',
        execute: jest.fn(),
      };

      registry.register(command1);
      registry.register(command2);

      const commands = registry.list();

      expect(commands).toHaveLength(2);
      expect(commands.map((c: Command) => c.name)).toContain('test1');
      expect(commands.map((c: Command) => c.name)).toContain('test2');
    });
  });
});

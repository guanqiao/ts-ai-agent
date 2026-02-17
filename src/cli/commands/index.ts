export interface CommandContext {
  args: string[];
  options: Record<string, unknown>;
  cwd?: string;
}

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
  execute(context: CommandContext): Promise<unknown>;
}

export interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type?: 'string' | 'boolean' | 'number';
  default?: unknown;
  required?: boolean;
}

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }

    this.commands.set(command.name, command);

    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.commands.has(alias)) {
          throw new Error(`Command alias '${alias}' is already registered`);
        }
        this.commands.set(alias, command);
      }
    }
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  async execute(name: string, context: CommandContext): Promise<unknown> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command '${name}' not found`);
    }
    return command.execute(context);
  }

  list(): Command[] {
    const uniqueCommands = new Set<Command>();
    for (const command of this.commands.values()) {
      uniqueCommands.add(command);
    }
    return Array.from(uniqueCommands);
  }

  getHelpText(): string {
    const commands = this.list();
    const lines: string[] = ['Available commands:', ''];

    for (const command of commands) {
      lines.push(`  ${command.name.padEnd(15)} ${command.description}`);
      if (command.options) {
        for (const opt of command.options) {
          const optText = opt.alias ? `-${opt.alias}, --${opt.name}` : `--${opt.name}`;
          lines.push(`    ${optText.padEnd(20)} ${opt.description}`);
        }
      }
    }

    return lines.join('\n');
  }
}

export function createCommand(
  config: Omit<Command, 'execute'> & { execute: (context: CommandContext) => Promise<unknown> }
): Command {
  return config;
}

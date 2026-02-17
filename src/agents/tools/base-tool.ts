import { Tool, ToolParameter, ToolContext, ToolResult, ValidationResult } from './types';

export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameter[];
  abstract execute(context: ToolContext): Promise<ToolResult>;

  validateParameters(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const validatedParams: Record<string, unknown> = { ...params };

    for (const param of this.parameters) {
      const value = params[param.name];

      if (value === undefined || value === null) {
        if (param.required) {
          if (param.defaultValue !== undefined) {
            validatedParams[param.name] = param.defaultValue;
          } else {
            errors.push(`Missing required parameter: ${param.name}`);
          }
        } else if (param.defaultValue !== undefined) {
          validatedParams[param.name] = param.defaultValue;
        }
        continue;
      }

      const typeError = this.validateType(param.name, value, param.type);
      if (typeError) {
        errors.push(typeError);
      }

      if (param.enum && !param.enum.includes(value as string)) {
        errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateType(name: string, value: unknown, type: string): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    switch (type) {
      case 'string':
        if (actualType !== 'string') {
          return `Parameter ${name} must be of type string, got ${actualType}`;
        }
        break;
      case 'number':
        if (actualType !== 'number') {
          return `Parameter ${name} must be of type number, got ${actualType}`;
        }
        break;
      case 'boolean':
        if (actualType !== 'boolean') {
          return `Parameter ${name} must be of type boolean, got ${actualType}`;
        }
        break;
      case 'object':
        if (actualType !== 'object' || Array.isArray(value)) {
          return `Parameter ${name} must be of type object, got ${actualType}`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Parameter ${name} must be of type array, got ${actualType}`;
        }
        break;
    }

    return null;
  }

  getDefinition(): { name: string; description: string; parameters: ToolParameter[] } {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }
}

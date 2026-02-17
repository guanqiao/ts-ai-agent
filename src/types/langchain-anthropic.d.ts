declare module '@langchain/anthropic' {
  export class ChatAnthropic {
    constructor(config: {
      modelName?: string;
      temperature?: number;
      maxTokens?: number;
      anthropicApiKey?: string;
    });
    invoke(messages: Array<{ role: string; content: string }>): Promise<{ content: string }>;
    stream(messages: Array<{ role: string; content: string }>): AsyncIterable<{ content: string }>;
    temperature: number;
    maxTokens: number;
  }
}

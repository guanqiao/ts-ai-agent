import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import {
  LLMConfig,
  AgentMessage,
  AgentResult,
  AgentContext,
} from '../types';

export class LLMService {
  private config: LLMConfig;
  private model: ChatOpenAI | null = null;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.model = new ChatOpenAI({
      modelName: this.config.model || 'gpt-4',
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      openAIApiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      configuration: this.config.baseUrl
        ? {
            baseURL: this.config.baseUrl,
          }
        : undefined,
    });
  }

  async complete(messages: AgentMessage[]): Promise<string> {
    if (!this.model) {
      await this.initialize();
    }

    const formattedMessages = messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return SystemMessagePromptTemplate.fromTemplate(msg.content);
        case 'user':
          return HumanMessagePromptTemplate.fromTemplate(msg.content);
        default:
          return HumanMessagePromptTemplate.fromTemplate(msg.content);
      }
    });

    const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
    const chain = RunnableSequence.from([prompt, this.model!, new StringOutputParser()]);

    return await chain.invoke({});
  }

  async *stream(messages: AgentMessage[]): AsyncIterable<string> {
    if (!this.model) {
      await this.initialize();
    }

    const formattedMessages = messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return SystemMessagePromptTemplate.fromTemplate(msg.content);
        case 'user':
          return HumanMessagePromptTemplate.fromTemplate(msg.content);
        default:
          return HumanMessagePromptTemplate.fromTemplate(msg.content);
      }
    });

    const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
    const chain = RunnableSequence.from([prompt, this.model!, new StringOutputParser()]);

    const stream = await chain.stream({});

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  getModel(): ChatOpenAI {
    if (!this.model) {
      throw new Error('LLM service not initialized');
    }
    return this.model;
  }
}

export abstract class BaseAgent {
  abstract readonly name: string;
  protected llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected createSuccessResult(output: string, metadata?: Record<string, unknown>): AgentResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  protected createErrorResult(error: string): AgentResult {
    return {
      success: false,
      error,
    };
  }
}

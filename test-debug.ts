import { NodeExtractor } from './src/wiki/knowledge/node-extractor';
import { WikiPage } from './src/wiki/types';
import { DocumentFormat, Language } from './src/types';

const extractor = new NodeExtractor();

const pages: WikiPage[] = [
  {
    id: 'page-1',
    title: 'Test Page',
    slug: 'test-page',
    content: 'This is about **KeyConcept** and **MainAPI**.',
    format: DocumentFormat.Markdown,
    metadata: {
      tags: ['test'],
      category: 'overview',
      sourceFiles: [],
      language: Language.TypeScript,
    },
    sections: [],
    links: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
];

const concepts = extractor.extractConcepts(pages);
console.log('Extracted concepts:', concepts);
console.log('Has KeyConcept:', concepts.some(c => c.name === 'KeyConcept'));
console.log('Has MainAPI:', concepts.some(c => c.name === 'MainAPI'));

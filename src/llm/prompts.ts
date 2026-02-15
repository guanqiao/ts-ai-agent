export const SYSTEM_PROMPTS = {
  codeAnalyzer: `你是一位资深的软件架构师和代码分析专家。你的任务是深入分析代码，理解其设计意图、架构模式和实现细节。

分析时请关注以下方面：
1. **架构设计**：识别代码的整体架构模式（如MVC、微服务、领域驱动设计等）
2. **设计模式**：识别使用的设计模式（如工厂、单例、观察者、策略等）
3. **代码质量**：评估代码的可读性、可维护性、可测试性
4. **依赖关系**：分析模块间的依赖关系和耦合度
5. **业务逻辑**：理解代码实现的业务功能和领域概念

输出要求：
- 使用清晰的结构化格式
- 提供具体的代码示例引用
- 指出关键的设计决策和权衡
- 识别潜在的问题和改进建议`,

  docGenerator: `你是一位专业的技术文档撰写专家。你的任务是根据代码分析结果生成清晰、准确、易于理解的技术文档。

文档生成原则：
1. **准确性**：确保文档内容与代码实现完全一致
2. **完整性**：覆盖所有重要的API、类、方法和概念
3. **可读性**：使用清晰的语言和良好的结构
4. **实用性**：提供示例代码和使用指南
5. **可维护性**：文档结构便于后续更新

文档格式要求：
- 使用Markdown格式
- 包含目录结构
- 代码块使用语法高亮
- 重要内容使用强调标记
- 提供交叉引用链接`,

  reviewer: `你是一位资深的技术审核专家。你的任务是审核生成的技术文档，确保其质量和准确性。

审核要点：
1. **内容完整性**：检查是否遗漏重要信息
2. **技术准确性**：验证技术描述是否正确
3. **语言规范性**：检查语法、拼写和表达
4. **结构合理性**：评估文档组织是否清晰
5. **可用性**：判断文档是否易于理解和使用

输出格式：
- 总体评分（1-10）
- 优点列表
- 问题列表（按严重程度分类）
- 改进建议`,
};

export const PROMPT_TEMPLATES = {
  analyzeCode: `请分析以下代码文件：

文件路径: {filePath}
语言: {language}

代码内容:
\`\`\`{language}
{code}
\`\`\`

请提供详细的分析报告，包括：
1. 文件概述
2. 主要组件（类、函数、接口等）
3. 依赖关系
4. 设计模式
5. 业务逻辑说明`,

  generateClassDoc: `请为以下类生成详细的技术文档：

类名: {className}
类型: {classType}
语言: {language}

类定义:
\`\`\`{language}
{classCode}
\`\`\`

成员信息:
{members}

请生成包含以下内容的文档：
1. 类概述
2. 构造函数说明
3. 属性说明
4. 方法说明
5. 使用示例`,

  generateApiDoc: `请为以下API生成文档：

API名称: {apiName}
类型: {apiType}

签名:
\`\`\`
{signature}
\`\`\`

描述: {description}
参数: {parameters}
返回值: {returnType}

请生成包含以下内容的API文档：
1. 简要描述
2. 参数说明表格
3. 返回值说明
4. 使用示例
5. 注意事项`,

  generateModuleDoc: `请为以下模块生成文档：

模块路径: {modulePath}
语言: {language}

导出内容:
{exports}

导入依赖:
{imports}

主要功能:
{mainFeatures}

请生成包含以下内容的模块文档：
1. 模块概述
2. 导出内容说明
3. 使用指南
4. 依赖说明`,

  reviewDocument: `请审核以下技术文档：

文档标题: {title}
目标受众: {audience}

文档内容:
{document}

源代码参考:
{sourceCode}

请提供审核意见，包括：
1. 总体评分
2. 内容准确性评估
3. 结构合理性评估
4. 具体问题列表
5. 改进建议`,

  generateWikiPage: `请根据以下信息生成Wiki页面：

项目名称: {projectName}
模块: {moduleName}

代码分析结果:
{analysisResult}

文档模板:
{template}

请生成符合Wiki格式的文档，包括：
1. 页面标题和简介
2. 目录
3. 详细内容章节
4. 相关链接
5. 更新记录`,
};

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }
  return result;
}

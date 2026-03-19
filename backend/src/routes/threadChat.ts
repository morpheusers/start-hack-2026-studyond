import { Router, type Request, type Response } from 'express';
import { mistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';

export const threadChatRouter = Router();

/**
 * POST /api/thread-chat
 *
 * Dedicated endpoint for deep-dive thread conversations. Uses generateText
 * (non-streaming) for simplicity and reliability. Returns plain JSON.
 */
threadChatRouter.post('/', async (req: Request, res: Response) => {
  const { message, threadContext, systemContext, suggestQuestions } = req.body as {
    message?: string;
    suggestQuestions?: boolean;
    threadContext?: {
      entityName: string;
      entityType: string;
      topicTitle?: string;
      description: string;
      tags: string[];
      compatibilityScore?: number;
    };
    systemContext?: string;
  };

  if (!threadContext) {
    res.status(400).json({ error: 'threadContext is required' });
    return;
  }

  console.log(`[ThreadChat] ${suggestQuestions ? 'Generating questions' : 'User message'} for "${threadContext.entityName}" (${threadContext.entityType})`);

  try {
    if (suggestQuestions) {
      // Generate 4 context-aware suggested questions
      const questionsPrompt = `You are helping a student explore a thesis opportunity.

Entity: ${threadContext.entityName} (${threadContext.entityType})
${threadContext.topicTitle ? `Topic: ${threadContext.topicTitle}` : ''}
Description: ${threadContext.description}
Tags: ${threadContext.tags.join(', ')}

Generate exactly 4 short, specific follow-up questions a student would ask when exploring this opportunity.
Questions must be directly relevant to this specific entity and its tags.
Return ONLY a JSON array of 4 strings. No explanation. No markdown.
Example: ["What is the expected timeline?", "What data will I have access to?", "Is remote work possible?", "What technical stack is used?"]`;

      const result = await generateText({
        model: mistral('mistral-small-latest'),
        messages: [{ role: 'user', content: questionsPrompt }],
        maxOutputTokens: 200,
      });

      console.log(`[ThreadChat] Questions raw response: ${result.text.slice(0, 100)}`);

      const match = result.text.match(/\[[\s\S]*\]/);
      const questions: string[] = match ? JSON.parse(match[0]) : [
        `What technical skills are most important for this ${threadContext.entityType}?`,
        'What is the expected thesis timeline?',
        'How should I reach out or apply?',
        'What does the research process look like?',
      ];

      res.json({ questions: questions.slice(0, 4) });
      return;
    }

    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const systemPrompt = `You are Studyond's AI thesis advisor in a focused one-on-one conversation with a student about a specific thesis opportunity.

## The Opportunity
Entity: ${threadContext.entityName} (${threadContext.entityType === 'supervisor' ? 'Academic Supervisor' : threadContext.entityType === 'company' ? 'Company Partner' : 'Thesis Topic'})
${threadContext.topicTitle ? `Topic: ${threadContext.topicTitle}` : ''}
Description: ${threadContext.description}
Tags: ${threadContext.tags.join(', ')}
${threadContext.compatibilityScore ? `Match Score: ${threadContext.compatibilityScore}/5.0` : ''}

## Instructions
- Answer the student's question specifically about this opportunity
- Be helpful, concise, and direct — aim for 3-5 sentences
- Reference specific details from the opportunity (tags, domain, type)
- Do NOT generate match cards or JSON blocks — this is a focused conversation
- Tone: warm, knowledgeable, peer-like${systemContext ? `\n\n## Student Context\n${systemContext}` : ''}`;

    console.log(`[ThreadChat] Calling Mistral for: "${message.slice(0, 80)}..."`);

    const result = await generateText({
      model: mistral('mistral-large-latest'),
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      maxOutputTokens: 600,
    });

    console.log(`[ThreadChat] Response: ${result.text.slice(0, 100)}...`);

    res.json({ text: result.text });
  } catch (error) {
    console.error('[ThreadChat] Error:', error);
    res.status(500).json({ error: 'Failed to generate response', text: null });
  }
});

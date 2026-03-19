import { Router, type Request, type Response } from 'express';
import { mistral } from '@ai-sdk/mistral';
import {
  streamText,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { Student } from '../models/Student.js';
import { Thread } from '../models/Thread.js';
import { searchDatabaseTool, getEntityDetailsTool } from '../tools/searchDatabase.js';

export const chatRouter = Router();

// ---- System prompts ----

const SEARCH_SYSTEM_PROMPT = `You are Studyond's AI thesis advisor — warm, direct, and knowledgeable about Swiss academia and industry.

## Your Role
Help students find the perfect thesis topic, company partner, or academic supervisor.

## Workflow
1. When the student asks about thesis opportunities, ALWAYS call the searchDatabase tool first.
2. Use only entity IDs returned by searchDatabase — never invent IDs.
3. After searching, generate a short encouraging 1-2 sentence response, then output the match cards JSON block.
4. If you need more details about a specific entity, call getEntityDetails.
5. Be efficient — one or two tool calls is enough. Don't over-search.

## Match Card Format
After your text response, output a fenced JSON block like this:

\`\`\`json
{
  "matches": [
    {
      "id": "match-<unique-suffix>",
      "entityType": "topic",
      "entityId": "topic-07",
      "name": "Swisscom",
      "subtitle": "Telecommunications · IT Services",
      "imageUrl": null,
      "compatibilityScore": 4.8,
      "description": "2-3 sentences explaining why this is a great match based on the student's profile and query...",
      "tags": ["#FederatedLearning", "#Hybrid", "#Privacy", "#Python"],
      "topicTitle": "Federated Learning for Telecom Network Optimization",
      "university": null
    }
  ]
}
\`\`\`

## Match Card Rules
- Generate 5-8 match cards per response, sorted by compatibilityScore descending
- compatibilityScore: 1.0 to 5.0 (float, one decimal)
- entityType must be "topic", "supervisor", or "company"
- entityId MUST be a real ID from searchDatabase results
- For topic cards: name = company/university behind the topic; topicTitle = the actual thesis title
- For supervisor cards: name = "Prof. Dr. Firstname Lastname"; university = university name
- For company cards: name = company name; topicTitle = null
- tags: specific hashtags like #NLP, #Remote, #Fintech, #Python — no workplace type as a separate field, include it as a tag like #Hybrid, #Remote, #OnSite
- descriptions must reference the student's specific skills and their query
- ALWAYS output the JSON block — the UI depends on it
- Tone: warm, peer-like. Short sentences.`;

const THREAD_SYSTEM_PROMPT = `You are Studyond's AI thesis advisor having a focused conversation about a specific thesis opportunity.
Answer the student's questions about this opportunity thoroughly and helpfully.
Do NOT generate match card JSON blocks in thread mode — just conversational text.
Keep responses concise but informative. Use the student's profile context to personalise your answers.`;

// ---- Build enriched system context from DB ----
async function buildEnrichedContext(
  baseContext: string,
  studentId: string
): Promise<string> {
  try {
    const student = await Student.findOne({ id: studentId }).lean();
    if (!student) return baseContext;

    const committedSteps = student.roadmapSteps.filter(
      (s) => s.status === 'committed' && s.committedThreadId
    );

    if (committedSteps.length === 0) return baseContext;

    const threads = await Thread.find({
      id: { $in: committedSteps.map((s) => s.committedThreadId) },
    }).lean();

    const threadMap: Record<string, typeof threads[0]> = {};
    threads.forEach((t) => { threadMap[t.id] = t; });

    const commitLines = committedSteps
      .map((step) => {
        const t = threadMap[step.committedThreadId!];
        if (!t) return null;
        const detail = t.card.topicTitle
          ? `"${t.card.topicTitle}" (via ${t.card.name})`
          : `${t.card.name}`;
        return `  ✓ ${step.label}: ${detail} [committed ${
          step.committedAt ? new Date(step.committedAt).toLocaleDateString() : 'recently'
        }]`;
      })
      .filter(Boolean)
      .join('\n');

    const openSteps = student.roadmapSteps
      .filter((s) => s.status === 'open')
      .map((s) => `  ○ ${s.label}: ${s.description}`)
      .join('\n');

    return (
      baseContext +
      `\n\n## Thesis Journey Progress\nCommitted decisions:\n${commitLines}` +
      (openSteps ? `\n\nOpen steps (still searching):\n${openSteps}` : '') +
      `\n\nTailor all recommendations to complement the student's existing decisions.`
    );
  } catch {
    return baseContext;
  }
}

// ---- POST /api/chat ----
chatRouter.post('/', async (req: Request, res: Response) => {
  const {
    messages,
    systemContext,
    studentId,
    mode = 'search',
    threadContext,
  } = req.body as {
    messages?: UIMessage[];
    systemContext?: string;
    studentId?: string;
    mode?: 'search' | 'thread';
    threadContext?: {
      entityName: string;
      entityType: string;
      topicTitle?: string;
      description: string;
      tags: string[];
    };
  };

  // Derive core messages (user + assistant only)
  const coreMessages = (messages ?? [])
    .map((m: UIMessage) => {
      const textPart = m.parts?.find((p: { type: string }) => p.type === 'text') as
        | { type: 'text'; text: string }
        | undefined;
      return { role: m.role as 'user' | 'assistant', content: textPart?.text ?? '' };
    })
    .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'));

  try {
    let systemPrompt: string;

    if (mode === 'thread') {
      // Thread-specific deep-dive — no tools, contextualised to one entity
      const entityInfo = threadContext
        ? `\n\n## Focus Entity\nYou are discussing: ${threadContext.entityName} (${threadContext.entityType})` +
          (threadContext.topicTitle ? `\nTopic: ${threadContext.topicTitle}` : '') +
          `\nDescription: ${threadContext.description}` +
          `\nTags: ${threadContext.tags.join(', ')}`
        : '';
      systemPrompt =
        THREAD_SYSTEM_PROMPT + entityInfo + (systemContext ? `\n\n${systemContext}` : '');

      const result = streamText({
        model: mistral('mistral-large-latest'),
        system: systemPrompt,
        messages: coreMessages,
        maxOutputTokens: 1000,
      });

      pipeUIMessageStreamToResponse({
        response: res,
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            writer.merge(result.toUIMessageStream());
          },
        }),
      });
    } else {
      // Search mode — with tools, multi-step
      const enrichedContext = studentId
        ? await buildEnrichedContext(systemContext ?? '', studentId)
        : systemContext ?? '';

      systemPrompt = SEARCH_SYSTEM_PROMPT + (enrichedContext ? `\n\n${enrichedContext}` : '');

      const result = streamText({
        model: mistral('mistral-large-latest'),
        system: systemPrompt,
        messages: coreMessages,
        maxOutputTokens: 2500,
        stopWhen: stepCountIs(15),
        tools: {
          searchDatabase: searchDatabaseTool,
          getEntityDetails: getEntityDetailsTool,
        },
      });

      pipeUIMessageStreamToResponse({
        response: res,
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            writer.merge(result.toUIMessageStream());
          },
        }),
      });
    }
  } catch (error) {
    console.error('[Chat] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate response' });
    }
  }
});

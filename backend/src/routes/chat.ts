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

// ---- System prompt for search mode ----

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
      "compatibilityScore": 4.2,
      "description": "2-3 sentences explaining why this is a great match based on the student's specific profile and query. Reference their exact skills and interests.",
      "tags": ["#FederatedLearning", "#Hybrid", "#Privacy", "#Python"],
      "topicTitle": "Federated Learning for Telecom Network Optimization",
      "university": null
    }
  ]
}
\`\`\`

## Match Card Rules
- Generate 5-8 match cards per response, sorted by compatibilityScore DESCENDING (highest first)
- compatibilityScore uses the FULL 1.0–5.0 range:
  * 4.5–5.0 = exceptional alignment (student's exact skills + ideal topic + perfect fit)
  * 3.5–4.4 = good match (relevant skills, related domain, minor gaps)
  * 2.5–3.4 = moderate match (some overlap, notable skill gaps or domain stretch)
  * 1.5–2.4 = weak match (significant mismatch, included only for diversity)
  * 1.0–1.4 = very poor match
  Most matches will be in the 2.5–4.0 range. Only truly exceptional fits get 4.5+.
  NEVER give every card a score above 4.0 — differentiate scores meaningfully.
- entityType must be "topic", "supervisor", or "company"
- entityId MUST be a real ID from searchDatabase results
- For topic cards: name = company/university behind the topic; topicTitle = the actual thesis title
- For supervisor cards: name = "Prof. Dr. Firstname Lastname"; university = university name
- For company cards: name = company name; topicTitle = null
- tags: specific hashtags like #NLP, #Remote, #Fintech, #Python, #Hybrid, #OnSite, #Remote
- descriptions must reference the student's specific skills and their query
- ALWAYS output the JSON block — the UI depends on it
- Tone: warm, peer-like. Short sentences.`;

// ---- Build enriched context from DB (committed steps) ----
async function buildEnrichedContext(baseContext: string, studentId: string): Promise<string> {
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
    const threadMap: Record<string, (typeof threads)[0]> = {};
    threads.forEach((t) => { threadMap[t.id] = t; });

    const commitLines = committedSteps
      .map((step) => {
        const t = threadMap[step.committedThreadId!];
        if (!t) return null;
        const detail = t.card.topicTitle
          ? `"${t.card.topicTitle}" (via ${t.card.name})`
          : t.card.name;
        return `  ✓ ${step.label}: ${detail} [committed ${
          step.committedAt ? new Date(step.committedAt).toLocaleDateString() : 'recently'
        }]`;
      })
      .filter(Boolean)
      .join('\n');

    const openSteps = student.roadmapSteps
      .filter((s) => s.status === 'open')
      .map((s) => `  ○ ${s.label}`)
      .join(', ');

    return (
      baseContext +
      `\n\n## Thesis Progress\nCommitted:\n${commitLines}` +
      (openSteps ? `\nStill searching: ${openSteps}` : '') +
      `\nTailor recommendations to complement these existing decisions.`
    );
  } catch (err) {
    console.warn('[Chat] Could not enrich context:', err);
    return baseContext;
  }
}

// ---- POST /api/chat — search mode (streaming + tools) ----
chatRouter.post('/', async (req: Request, res: Response) => {
  const { messages, systemContext, studentId, mode = 'search' } = req.body as {
    messages?: UIMessage[];
    systemContext?: string;
    studentId?: string;
    mode?: 'search';
  };

  console.log(`[Chat] mode=${mode} studentId=${studentId ?? 'none'} messages=${messages?.length ?? 0}`);

  // Convert UIMessages to core messages
  const coreMessages = (messages ?? [])
    .map((m: UIMessage) => {
      const textPart = m.parts?.find((p: { type: string }) => p.type === 'text') as
        | { type: 'text'; text: string }
        | undefined;
      return { role: m.role as 'user' | 'assistant', content: textPart?.text ?? '' };
    })
    .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'));

  console.log(`[Chat] Core messages: ${coreMessages.map((m) => `${m.role}:"${m.content.slice(0, 40)}"`).join(', ')}`);

  try {
    const enrichedContext = studentId
      ? await buildEnrichedContext(systemContext ?? '', studentId)
      : systemContext ?? '';

    const systemPrompt = SEARCH_SYSTEM_PROMPT + (enrichedContext ? `\n\n${enrichedContext}` : '');

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
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls && toolCalls.length > 0) {
          const toolName = (toolCalls[0] as { toolName?: string }).toolName ?? 'unknown';
          console.log(`[Chat] Tool call: "${toolName}"`);
        }
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
  } catch (error) {
    console.error('[Chat] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate response' });
    }
  }
});

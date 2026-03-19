import { Router, type Request, type Response } from 'express';
import { mistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';

export const tagsRouter = Router();

tagsRouter.post('/', async (req: Request, res: Response) => {
  const { profile } = req.body as { profile: Record<string, unknown> };

  try {
    const result = await generateText({
      model: mistral('mistral-large-latest'),
      system: 'You are a semantic tag extractor for academic student profiles. Return ONLY a JSON array of strings.',
      messages: [
        {
          role: 'user',
          content: `Extract 8-12 concise semantic tags from this student profile.

Rules:
- Include technical skills (e.g. "Python", "PyTorch"), domain interests (e.g. "Machine Learning"), and methodology tags (e.g. "Qualitative Research")
- Keep tags 1-3 words
- No hashtags, no duplicates
- Return ONLY the JSON array, nothing else

Profile:
${JSON.stringify(profile, null, 2)}`,
        },
      ],
      maxOutputTokens: 300,
    });

    const text = result.text;
    const match = text.match(/\[[\s\S]*\]/);
    res.json({ tags: match ? (JSON.parse(match[0]) as string[]) : [] });
  } catch (error) {
    console.error('[Tags] Error:', error);
    res.status(500).json({ error: 'Failed to extract tags', tags: [] });
  }
});

import { tool } from 'ai';
import { z } from 'zod';
import { Topic } from '../models/Topic.js';
import { Supervisor } from '../models/Supervisor.js';
import { Company } from '../models/Company.js';
import { University } from '../models/University.js';

type SearchResult = {
  topics: {
    id: string; title: string; description: string; type: string;
    workplaceType: string | null; degrees: string[];
    companyId: string | null; universityId: string | null;
    supervisorIds: string[]; employment: string; employmentType: string | null;
    companyName?: string;
  }[];
  supervisors: {
    id: string; firstName: string; lastName: string; title: string;
    universityId: string; universityName: string;
    researchInterests: string[]; about: string | null;
  }[];
  companies: {
    id: string; name: string; description: string; about: string | null;
    size: string; domains: string[];
  }[];
};

export const searchDatabaseTool = tool({
  description: `Search the Studyond database for real thesis topics, academic supervisors, and company partners.
ALWAYS call this tool before generating match cards. Use only the entity IDs returned here — never invent IDs.
Returns real data sorted by relevance to the query.`,
  inputSchema: z.object({
    query: z.string().describe('Search terms describing what the student is looking for'),
    entityTypes: z
      .array(z.enum(['topic', 'supervisor', 'company']))
      .optional()
      .describe('Entity types to search (default: all three)'),
    degree: z
      .enum(['bsc', 'msc', 'phd'])
      .optional()
      .describe('Filter topics by degree level'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(15)
      .optional()
      .describe('Max results per entity type (default: 8)'),
  }),
  execute: async ({ query, entityTypes, degree, limit = 8 }): Promise<SearchResult> => {
    const types = entityTypes ?? ['topic', 'supervisor', 'company'];
    const scoreProjection = { score: { $meta: 'textScore' } };
    const scoreSort = { score: { $meta: 'textScore' } } as const;

    const result: SearchResult = { topics: [], supervisors: [], companies: [] };

    // Topics
    if (types.includes('topic')) {
      try {
        const filter: Record<string, unknown> = { $text: { $search: query } };
        if (degree) filter.degrees = degree;
        const raw = await Topic.find(filter, scoreProjection).sort(scoreSort).limit(limit).lean();

        // Resolve company names for company-backed topics
        const companyIds = [...new Set(raw.filter((t) => t.companyId).map((t) => t.companyId!))];
        const companies = companyIds.length
          ? await Company.find({ id: { $in: companyIds } }).lean()
          : [];
        const companyMap: Record<string, string> = Object.fromEntries(
          companies.map((c) => [c.id, c.name])
        );

        result.topics = raw.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          type: t.type,
          workplaceType: t.workplaceType,
          degrees: t.degrees,
          companyId: t.companyId,
          universityId: t.universityId,
          supervisorIds: t.supervisorIds,
          employment: t.employment,
          employmentType: t.employmentType,
          ...(t.companyId && { companyName: companyMap[t.companyId] }),
        }));
      } catch {
        result.topics = [];
      }
    }

    // Supervisors
    if (types.includes('supervisor')) {
      try {
        const raw = await Supervisor.find({ $text: { $search: query } }, scoreProjection)
          .sort(scoreSort)
          .limit(limit)
          .lean();

        const uniIds = [...new Set(raw.map((s) => s.universityId))];
        const unis = await University.find({ id: { $in: uniIds } }).lean();
        const uniMap: Record<string, string> = Object.fromEntries(unis.map((u) => [u.id, u.name]));

        result.supervisors = raw.map((s) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          title: s.title,
          universityId: s.universityId,
          universityName: uniMap[s.universityId] ?? s.universityId,
          researchInterests: s.researchInterests,
          about: s.about,
        }));
      } catch {
        result.supervisors = [];
      }
    }

    // Companies
    if (types.includes('company')) {
      try {
        const raw = await Company.find({ $text: { $search: query } }, scoreProjection)
          .sort(scoreSort)
          .limit(limit)
          .lean();

        result.companies = raw.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          about: c.about,
          size: c.size,
          domains: c.domains,
        }));
      } catch {
        result.companies = [];
      }
    }

    return result;
  },
});

export const getEntityDetailsTool = tool({
  description:
    'Fetch full details for a specific entity by ID to enrich a match card description.',
  inputSchema: z.object({
    entityId: z.string().describe('The entity ID, e.g. "topic-07", "supervisor-03"'),
    entityType: z.enum(['topic', 'supervisor', 'company']),
  }),
  execute: async ({ entityId, entityType }) => {
    if (entityType === 'topic') return await Topic.findOne({ id: entityId }).lean();
    if (entityType === 'supervisor') {
      const s = await Supervisor.findOne({ id: entityId }).lean();
      if (!s) return null;
      const uni = await University.findOne({ id: s.universityId }).lean();
      return { ...s, universityName: uni?.name ?? s.universityId };
    }
    if (entityType === 'company') return await Company.findOne({ id: entityId }).lean();
    return null;
  },
});

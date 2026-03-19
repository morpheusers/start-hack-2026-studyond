import { Router, type Request, type Response } from 'express';
import { runSeed } from '../db/seed.js';

export const seedRouter = Router();

// GET /api/seed — dev-only: trigger DB seeding (idempotent upsert)
seedRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await runSeed();
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[Seed] Error:', error);
    res.status(500).json({ error: String(error) });
  }
});

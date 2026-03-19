import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db/connection.js';
import { chatRouter } from './routes/chat.js';
import { tagsRouter } from './routes/tags.js';
import { studentsRouter } from './routes/students.js';
import { threadsRouter } from './routes/threads.js';
import { seedRouter } from './routes/seed.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use(express.json({ limit: '2mb' }));

// ---- Routes ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/chat', chatRouter);
app.use('/api/extract-tags', tagsRouter);
app.use('/api/students', studentsRouter);
// Threads are nested under students — mergeParams handled in router
app.use('/api/students/:studentId/threads', threadsRouter);
app.use('/api/seed', seedRouter);

// ---- Bootstrap ----
async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Studyond API running on http://localhost:${PORT}`);
  });
}

main();

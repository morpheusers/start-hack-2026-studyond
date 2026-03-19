import { Router, type Request, type Response } from 'express';
import { Student, defaultRoadmapSteps } from '../models/Student.js';

export const studentsRouter = Router();

// GET /api/students/:id — full student profile
studentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const student = await Student.findOne({ id: req.params.id }).lean();
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Ensure roadmapSteps is initialised (for old records seeded before this field existed)
    if (!student.roadmapSteps || student.roadmapSteps.length === 0) {
      const steps = defaultRoadmapSteps();
      await Student.findOneAndUpdate({ id: req.params.id }, { $set: { roadmapSteps: steps } });
      res.json({ ...student, roadmapSteps: steps });
      return;
    }

    res.json(student);
  } catch (error) {
    console.error('[Students] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// PUT /api/students/:id — update profile fields
studentsRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Only allow updating safe profile fields — never overwrite roadmapSteps or aiTags via this endpoint
  const {
    firstName, lastName, email, degree, university, studyProgram,
    studyProgramId, universityId, skills, interests, about, objectives, fieldIds,
  } = req.body;

  const updates: Record<string, unknown> = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (email !== undefined) updates.email = email;
  if (degree !== undefined) updates.degree = degree;
  if (studyProgramId !== undefined) updates.studyProgramId = studyProgramId;
  if (universityId !== undefined) updates.universityId = universityId;
  if (skills !== undefined) updates.skills = skills;
  if (interests !== undefined) updates.interests = interests;
  if (about !== undefined) updates.about = about;
  if (objectives !== undefined) updates.objectives = objectives;
  if (fieldIds !== undefined) updates.fieldIds = fieldIds;

  // Ignore frontend-only display fields
  void university; void studyProgram;

  try {
    const updated = await Student.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: "after", runValidators: false }
    ).lean();

    if (!updated) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(updated);
  } catch (error) {
    console.error('[Students] PUT error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// PATCH /api/students/:id/tags — update AI tags
studentsRouter.patch('/:id/tags', async (req: Request, res: Response) => {
  const { tags } = req.body as { tags: string[] };
  try {
    const updated = await Student.findOneAndUpdate(
      { id: req.params.id },
      { $set: { aiTags: tags } },
      { returnDocument: "after" }
    ).lean();
    if (!updated) { res.status(404).json({ error: 'Student not found' }); return; }
    res.json({ aiTags: updated.aiTags });
  } catch (error) {
    console.error('[Students] PATCH tags error:', error);
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

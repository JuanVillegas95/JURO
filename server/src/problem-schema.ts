import { z } from "zod";

const jsonValue = z.string().min(1).refine((value) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}, "must contain valid JSON");

export const problemInputSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(280),
  descriptionMarkdown: z.string().min(1),
  constraintsMarkdown: z.string().nullable().optional(),
  type: z.enum(["JAVA", "PYTHON", "JAVASCRIPT", "GO"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  starterCode: z.string().nullable().optional(),
  referenceSolution: z.string().nullable().optional(),
  evaluationNotes: z.string().nullable().optional(),
  solutionVideoUrl: z.string().nullable().optional(),
  knowledgeRubric: z.string().min(50),
  examples: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().nonnegative(),
    inputData: jsonValue,
    expectedOutput: jsonValue,
    explanation: z.string().nullable().optional(),
  })).min(3),
  testCases: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    sortOrder: z.number().int().nonnegative(),
    inputData: jsonValue,
    expectedOutput: jsonValue,
    hidden: z.boolean(),
    explanation: z.string().nullable().optional(),
  })).min(3),
});

export type ProblemInputPayload = typeof problemInputSchema._output;

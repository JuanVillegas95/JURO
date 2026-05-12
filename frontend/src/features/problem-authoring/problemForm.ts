import { z } from 'zod';
import type { FormSelectOption } from '../../components/ui/FormSelect';
import type { ProblemDifficulty, ProblemType } from '../../types';
import type { CatalogProblem } from '../problem-bank/catalog';

export type TestValueType =
  | "int"
  | "long"
  | "double"
  | "boolean"
  | "String"
  | "int[]"
  | "long[]"
  | "double[]"
  | "boolean[]"
  | "String[]"
  | "int[][]"
  | "long[][]"
  | "double[][]"
  | "String[][]"
  | "Object";

export type TestCaseDraft = {
  input: string;
  expectedOutput: string;
  hidden: boolean;
};

export type ExampleDraft = {
  id: string;
  input: string;
  output: string;
  explanation: string;
};

export type EditProblemDraft = {
  title: string;
  slug: string;
  languages: ProblemType[];
  difficulty: ProblemDifficulty | null;
  inputType: TestValueType;
  returnType: TestValueType;
  tags: string[];
  description: string;
  solutionVideoUrl: string;
  knowledgeRubric: string;
  examples: ExampleDraft[];
  starterCode: string;
  referenceSolution: string;
  testCases: TestCaseDraft[];
};

export function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createExampleDraft(index: number, values?: Partial<Omit<ExampleDraft, "id">>): ExampleDraft {
  return {
    id: `example-${Date.now()}-${index}`,
    input: values?.input ?? "",
    output: values?.output ?? "",
    explanation: values?.explanation ?? "",
  };
}

export const testValueTypes: TestValueType[] = [
  "int",
  "long",
  "double",
  "boolean",
  "String",
  "int[]",
  "long[]",
  "double[]",
  "boolean[]",
  "String[]",
  "int[][]",
  "long[][]",
  "double[][]",
  "String[][]",
  "Object",
];
export const maxTagCount = 5;

export function validateTypedValue(type: TestValueType, value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isValid = (() => {
    if (type === "int" || type === "long") {
      return /^-?\d+$/.test(trimmed);
    }

    if (type === "double") {
      return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed);
    }

    if (type === "boolean") {
      return /^(true|false)$/i.test(trimmed);
    }

    if (type === "String") {
      return true;
    }

    if (["int[]", "long[]", "double[]", "boolean[]", "String[]"].includes(type)) {
      if (trimmed.startsWith("[")) {
        return isJsonArrayOf(type.replace("[]", "") as PrimitiveArrayItem, trimmed);
      }
      const normalized = trimmed.trim();
      if (normalized.length === 0) {
        return true;
      }
      return normalized.split(",").every((item) => validatePrimitive(type.replace("[]", "") as PrimitiveArrayItem, item.trim()));
    }

    if (["int[][]", "long[][]", "double[][]", "String[][]"].includes(type)) {
      return isJsonMatrixOf(type.replace("[][]", "") as MatrixArrayItem, trimmed);
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
    } catch {
      return false;
    }
  })();

  return isValid ? null : `Expected ${type}, got '${trimmed}'`;
}

type PrimitiveArrayItem = "int" | "long" | "double" | "boolean" | "String";
type MatrixArrayItem = "int" | "long" | "double" | "String";

function validatePrimitive(type: PrimitiveArrayItem, value: string) {
  if (type === "int" || type === "long") {
    return /^-?\d+$/.test(value);
  }
  if (type === "double") {
    return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value);
  }
  if (type === "boolean") {
    return /^(true|false)$/i.test(value);
  }
  return value.length > 0;
}

function isJsonArrayOf(type: PrimitiveArrayItem, value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => validateParsedPrimitive(type, item));
  } catch {
    return false;
  }
}

function isJsonMatrixOf(type: MatrixArrayItem, value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.every((row) => Array.isArray(row) && row.every((item) => validateParsedPrimitive(type, item)))
    );
  } catch {
    return false;
  }
}

function validateParsedPrimitive(type: PrimitiveArrayItem | MatrixArrayItem, value: unknown) {
  if (type === "String") {
    return typeof value === "string";
  }
  if (type === "boolean") {
    return typeof value === "boolean";
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  return type === "double" || Number.isInteger(value);
}

export const returnTypeOptions = testValueTypes.map((type) => ({ label: type, value: type })) satisfies FormSelectOption<TestValueType>[];
const youtubeUrlPattern = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]+.*$/i;

export const problemSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title must be 100 characters or fewer"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only"),
    languages: z.array(z.literal("JAVA")).length(1, "Java is required"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"], { error: "Select a difficulty" }),
    inputType: z.enum(testValueTypes),
    returnType: z.enum(testValueTypes),
    tags: z.array(z.string()).max(maxTagCount, "Maximum 5 tags allowed"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    solutionVideoUrl: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || youtubeUrlPattern.test(value), "Enter a valid YouTube URL"),
    knowledgeRubric: z.string().min(50, "Knowledge rubric must be at least 50 characters"),
    examples: z
      .array(
        z.object({
          id: z.string().optional(),
          input: z.string().min(1, "Input is required"),
          output: z.string().min(1, "Output is required"),
          explanation: z.string().optional(),
        }),
      )
      .min(3, "Add at least 3 examples"),
    starterCode: z.string().min(1, "Starter code is required"),
    referenceSolution: z.string().optional(),
    testCases: z
      .array(
        z.object({
          input: z.string().min(1, "Input is required"),
          expectedOutput: z.string().min(1, "Expected output is required"),
          hidden: z.boolean(),
        }),
      )
      .min(3, "Add at least 3 test cases"),
  })
  .superRefine((value, context) => {
    value.testCases.forEach((testCase, index) => {
      const inputError = validateTypedValue(value.inputType, testCase.input);
      if (inputError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: inputError,
          path: ["testCases", index, "input"],
        });
      }

      const expectedError = validateTypedValue(value.returnType, testCase.expectedOutput);
      if (expectedError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: expectedError,
          path: ["testCases", index, "expectedOutput"],
        });
      }
    });
  });

export type ProblemFormValues = z.infer<typeof problemSchema>;

export function defaultEditorCode(_language: ProblemType = "JAVA") {
  return "class Solution {\n    public int solve(int n) {\n        return 0;\n    }\n}";
}

export function defaultEditProblemDraft(): EditProblemDraft {
  return {
    title: "Climb Stairs Count",
    slug: "climb-stairs-count",
    languages: ["JAVA"],
    difficulty: "EASY",
    inputType: "int",
    returnType: "int",
    tags: ["cho", "dynamic-programming", "recursion"],
    description: "You are climbing a staircase. It takes 'n' steps to reach the top.",
    solutionVideoUrl: "https://www.youtube.com/watch?v=JUROJAVA001",
    knowledgeRubric:
      "A strong explanation should cover the recurrence, why the previous two counts are enough, base cases for n=1 and n=2, and O(n) time with O(1) space.",
    examples: [
      createExampleDraft(0, {
        input: "n = 2",
        output: "2",
        explanation: "1+1, 2",
      }),
      createExampleDraft(1, {
        input: "n = 3",
        output: "3",
        explanation: "1+1+1, 1+2, 2+1",
      }),
      createExampleDraft(2, {
        input: "n = 5",
        output: "8",
        explanation: "The count follows the Fibonacci-style recurrence.",
      }),
    ],
    starterCode: defaultEditorCode("JAVA"),
    referenceSolution: defaultEditorCode("JAVA"),
    testCases: [
      { input: "1", expectedOutput: "1", hidden: false },
      { input: "2", expectedOutput: "2", hidden: false },
      { input: "3", expectedOutput: "3", hidden: true },
    ],
  };
}

export function newProblemDraft(): EditProblemDraft {
  return {
    title: "",
    slug: "",
    languages: ["JAVA"],
    difficulty: null,
    inputType: "int",
    returnType: "int",
    tags: [],
    description: "",
    solutionVideoUrl: "",
    knowledgeRubric: "",
    examples: [],
    starterCode: defaultEditorCode("JAVA"),
    referenceSolution: "",
    testCases: [],
  };
}

export function initialEditProblemDraft(mode: "edit" | "new", problem?: CatalogProblem | null): EditProblemDraft {
  if (mode === "new") {
    return newProblemDraft();
  }

  const draft = defaultEditProblemDraft();
  if (!problem) {
    return draft;
  }

  return {
    ...draft,
    title: problem.displayTitle,
    slug: problem.slug,
    languages: [problem.type],
    difficulty: problem.difficulty,
    description: problem.summary || draft.description,
    solutionVideoUrl: problem.solutionVideoUrl ?? "",
    starterCode: defaultEditorCode(problem.type),
    referenceSolution: defaultEditorCode(problem.type),
  };
}

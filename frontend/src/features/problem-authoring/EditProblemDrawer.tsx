// Added: @radix-ui/react-select for styled dropdowns, react-hook-form + zod for form validation.
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, ChevronDown, Circle, Clock3, Lock, Plus, Tag, Wand2, X } from 'lucide-react';
import { createProblem, getProblem, updateProblem } from '../../api';
import { FieldError } from '../../components/ui/FieldError';
import { FormSelect } from '../../components/ui/FormSelect';
import { CodeEditorCard } from '../../components/code/CodeEditorCard';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { displayDifficulty, type CatalogProblem } from '../problem-bank/catalog';
import type { ProblemDetail, ProblemDifficulty, ProblemRequest, ProblemType } from '../../types';
import {
  createExampleDraft,
  initialEditProblemDraft,
  maxTagCount,
  problemSchema,
  returnTypeOptions,
  slugifyTitle,
  type EditProblemDraft,
  type ExampleDraft,
  type ProblemFormValues,
  type TestCaseDraft,
  type TestValueType,
} from './problemForm';

export type EditProblemDrawerProps = {
  mode: "edit" | "new";
  onClose: () => void;
  onSaved?: () => void;
  problem?: CatalogProblem | null;
};

export function EditProblemDrawer({ mode, onClose, onSaved, problem }: EditProblemDrawerProps) {
  const initialDraft = initialEditProblemDraft(mode, problem);
  const [title, setTitle] = useState(initialDraft.title);
  const [slug, setSlug] = useState(initialDraft.slug);
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [languages, setLanguages] = useState<ProblemType[]>(initialDraft.languages);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty | null>(initialDraft.difficulty);
  const [inputType, setInputType] = useState<TestValueType>(initialDraft.inputType);
  const [returnType, setReturnType] = useState<TestValueType>(initialDraft.returnType);
  const [tags, setTags] = useState(initialDraft.tags);
  const [descriptionTab, setDescriptionTab] = useState<"write" | "preview">("write");
  const [description, setDescription] = useState(initialDraft.description);
  const [solutionVideoUrl, setSolutionVideoUrl] = useState(initialDraft.solutionVideoUrl);
  const [knowledgeRubric, setKnowledgeRubric] = useState(initialDraft.knowledgeRubric);
  const [examples, setExamples] = useState<ExampleDraft[]>(initialDraft.examples);
  const [starterCode, setStarterCode] = useState(initialDraft.starterCode);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [referenceSolution, setReferenceSolution] = useState(initialDraft.referenceSolution);
  const [testCases, setTestCases] = useState<TestCaseDraft[]>(initialDraft.testCases);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filledCompletionItems = [
    title.trim().length > 0,
    slug.trim().length > 0,
    languages.length > 0,
    Boolean(difficulty),
    Boolean(inputType),
    Boolean(returnType),
    tags.length > 0,
    description.trim().length > 0,
    knowledgeRubric.trim().length >= 50,
    examples.length >= 3,
    starterCode.trim().length > 0,
    referenceSolution.trim().length > 0,
    testCases.length >= 3,
  ].filter(Boolean).length;
  const completionPercent = Math.round((filledCompletionItems / 13) * 100);
  const exampleRequirementMet = examples.length >= 3;
  const testCaseRequirementMet = testCases.length >= 3;
  const referenceRequirementMet = referenceSolution.includes("return");
  const tagLimitReached = tags.length >= maxTagCount;
  const formValues = {
    title,
    slug,
    languages,
    difficulty: difficulty ?? undefined,
    inputType,
    returnType,
    tags,
    description,
    solutionVideoUrl,
    knowledgeRubric,
    examples,
    starterCode,
    referenceSolution,
    testCases,
  } as ProblemFormValues;
  const {
    formState: { errors: formErrors, isValid: isHookFormValid },
    trigger,
  } = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema),
    mode: "onChange",
    values: formValues,
  });
  const validationResult = problemSchema.safeParse(formValues);
  const validationIssues = validationResult.success ? [] : validationResult.error.issues;
  const isFormValid = validationResult.success && isHookFormValid;

  function issueMessageFor(path: Array<string | number>) {
    return validationIssues.find((issue) => path.every((part, index) => issue.path[index] === part))?.message;
  }

  function rootFieldError(field: keyof ProblemFormValues) {
    const hookFormMessage = formErrors[field]?.message;
    return typeof hookFormMessage === "string" ? hookFormMessage : issueMessageFor([field]);
  }

  function exampleFieldError(index: number, field: keyof Pick<ExampleDraft, "input" | "output">) {
    return issueMessageFor(["examples", index, field]);
  }

  function testCaseFieldError(index: number, field: "input" | "expectedOutput") {
    return issueMessageFor(["testCases", index, field]);
  }
  const submitDisabledReason = isFormValid ? undefined : "Complete the required fields and fix validation errors before submitting.";

  useEffect(() => {
    if (mode !== "edit" || !problem?.id) {
      return;
    }

    const problemId = problem.id;
    let active = true;
    async function loadProblemDetail() {
      try {
        const detail = await getProblem(problemId);
        if (!active) {
          return;
        }
        applyProblemDetail(detail);
      } catch (loadError) {
        if (active) {
          setSubmitError(loadError instanceof Error ? loadError.message : "Unable to load problem details.");
        }
      }
    }

    void loadProblemDetail();
    return () => {
      active = false;
    };
  }, [mode, problem?.id]);

  useEffect(() => {
    void trigger();
  }, [description, difficulty, examples, inputType, knowledgeRubric, languages, referenceSolution, returnType, slug, solutionVideoUrl, starterCode, tags, testCases, title, trigger]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugWasEdited) {
      setSlug(slugifyTitle(value));
    }
  }

  function toggleLanguage(language: ProblemType) {
    setLanguages([language]);
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function addExample() {
    setExamples((current) => [...current, createExampleDraft(current.length)]);
  }

  function updateExample(index: number, field: keyof Omit<ExampleDraft, "id">, value: string) {
    setExamples((current) =>
      current.map((example, currentIndex) =>
        currentIndex === index ? { ...example, [field]: value } : example,
      ),
    );
  }

  function removeExample(index: number) {
    setExamples((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateTestCase(index: number, field: keyof TestCaseDraft, value: string | boolean) {
    setTestCases((current) =>
      current.map((testCase, currentIndex) =>
        currentIndex === index ? { ...testCase, [field]: value } : testCase,
      ),
    );
  }

  function addTestCase() {
    setTestCases((current) => [...current, { input: "", expectedOutput: "", hidden: false }]);
  }

  function removeTestCase(index: number) {
    setTestCases((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function applyProblemDetail(detail: ProblemDetail) {
    const source = firstNonBlank(detail.starterCode, detail.referenceSolution);
    const inferredInputType = inferInputTypeFromSource(source) ?? (detail.testCases[0] ? inferInputType(detail.testCases[0].inputData) : "int");
    const inferredReturnType = inferReturnType(source);
    setTitle(detail.title);
    setSlug(detail.slug);
    setLanguages(["JAVA"]);
    setDifficulty(detail.difficulty);
    setInputType(inferredInputType);
    setReturnType(inferredReturnType);
    setDescription(detail.descriptionMarkdown);
    setStarterCode(detail.starterCode ?? "");
    setReferenceSolution(detail.referenceSolution ?? "");
    setSolutionVideoUrl(detail.solutionVideoUrl ?? "");
    setKnowledgeRubric(detail.knowledgeRubric ?? "");
    setExamples(
      detail.examples.map((example, index) =>
        createExampleDraft(index, {
          input: example.inputData,
          output: example.expectedOutput,
          explanation: example.explanation ?? "",
        }),
      ),
    );
    setTestCases(
      detail.testCases.map((testCase) => ({
        input: testCase.inputData,
        expectedOutput: testCase.expectedOutput,
        hidden: testCase.hidden,
      })),
    );
  }

  function inferTypesFromCode() {
    const source = firstNonBlank(starterCode, referenceSolution);
    setInputType(inferInputTypeFromSource(source) ?? inputType);
    setReturnType(inferReturnType(source));
  }

  function requestPayload(): ProblemRequest {
    const summary = (problem?.summary || description.replace(/\s+/g, " ").slice(0, 260) || title).trim();
    return {
      title: title.trim(),
      slug: slug.trim(),
      summary,
      descriptionMarkdown: description.trim(),
      constraintsMarkdown: "",
      type: "JAVA",
      difficulty: difficulty ?? "EASY",
      starterCode,
      referenceSolution,
      evaluationNotes: "",
      solutionVideoUrl: solutionVideoUrl.trim(),
      knowledgeRubric: knowledgeRubric.trim(),
      examples: examples.map((example, index) => ({
        label: `Example ${index + 1}`,
        sortOrder: index,
        inputData: example.input.trim(),
        expectedOutput: example.output.trim(),
        explanation: example.explanation.trim(),
      })),
      testCases: testCases.map((testCase, index) => ({
        label: `Test case ${index + 1}`,
        sortOrder: index,
        inputData: normalizeTestValue(inputType, testCase.input),
        expectedOutput: normalizeTestValue(returnType, testCase.expectedOutput),
        hidden: testCase.hidden,
        explanation: "",
      })),
    };
  }

  async function handlePrimaryAction() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "new") {
        await createProblem(requestPayload());
      } else if (problem?.id) {
        await updateProblem(problem.id, requestPayload());
      }
      onSaved?.();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save problem.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const languageStyles: Record<ProblemType, { selected: string; unselected: string }> = {
    JAVA: {
      selected: "bg-[#F97316] text-white border-[#F97316]",
      unselected: "bg-orange-50 text-orange-700 border-orange-200",
    },
  };
  const difficultyStyles: Record<ProblemDifficulty, { selected: string; unselected: string; preview: string }> = {
    EASY: {
      selected: "bg-emerald-600 text-white border-emerald-600",
      unselected: "bg-emerald-50 text-emerald-700 border-emerald-200",
      preview: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    MEDIUM: {
      selected: "bg-amber-500 text-white border-amber-500",
      unselected: "bg-amber-50 text-amber-700 border-amber-200",
      preview: "bg-amber-50 text-amber-700 border-amber-200",
    },
    HARD: {
      selected: "bg-red-600 text-white border-red-600",
      unselected: "bg-red-50 text-red-700 border-red-200",
      preview: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const readinessItems = [
    { label: "Title", complete: !rootFieldError("title") },
    { label: "Difficulty", complete: !rootFieldError("difficulty") },
    { label: "Knowledge rubric", complete: !rootFieldError("knowledgeRubric") },
    { label: "At least 3 examples", complete: exampleRequirementMet && !rootFieldError("examples") },
    { label: "At least 3 test cases", complete: testCaseRequirementMet && !rootFieldError("testCases") },
    { label: "Reference solution", complete: referenceRequirementMet },
  ];
  const dialogTitle = mode === "new" ? "New Problem" : "Edit Problem";
  const primaryActionLabel = "Save";
  const editorLanguage = languages[0] ?? problem?.type ?? "JAVA";
  const previewLanguage = languages[0];
  const previewDifficultyClass = difficulty
    ? difficultyStyles[difficulty].preview
    : "border-slate-200 bg-slate-50 text-slate-500";
  const inputPlaceholder = placeholderForType(inputType, "input");
  const expectedOutputPlaceholder = placeholderForType(returnType, "expected");
  const canInferTypes = firstNonBlank(starterCode, referenceSolution).trim().length > 0;
  const livePreviewContent = (
    <>
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-[16px] font-bold text-[var(--text-primary)]">{title || "Untitled Problem"}</h4>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-700">
            <Clock3 size={12} />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${previewDifficultyClass}`}>
            {difficulty ? displayDifficulty(difficulty) : "Difficulty"}
          </span>
          {previewLanguage ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${languageStyles[previewLanguage].selected}`}
            >
              {previewLanguage}
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold text-slate-500">
              Language
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Hard
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold text-slate-500">
            {examples.length} {examples.length === 1 ? "example" : "examples"}
          </span>
        </div>
        <p className="mt-3 line-clamp-2 text-[14px] leading-5 text-slate-700">
          Count how many distinct ways exist to reach the top, ccd dert from each tere.
        </p>
      </section>

      <dl className="space-y-1.5 text-[14px]">
        {[
          ["Created", "Mar 10, 2026"],
          ["Last edited", "Apr 22, 2026"],
          ["Submissions", "1,204"],
          ["Author", "You"],
        ].map(([label, value]) => (
          <div className="flex gap-1" key={label}>
            <dt className="font-semibold text-[var(--text-secondary)]">{label}:</dt>
            <dd className="text-[var(--text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2.5">
        {readinessItems.map((item) => (
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]" key={item.label}>
            {item.complete ? (
              <Check className="text-emerald-600" size={18} strokeWidth={2.5} />
            ) : (
              <Circle className="text-slate-400" size={17} />
            )}
            {item.label}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/40 !p-0 font-['Inter',system-ui,sans-serif] text-[14px] text-slate-900 backdrop-blur-sm md:!p-4 lg:!p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-label={dialogTitle}
        aria-modal="true"
        className="edit-problem-modal relative grid h-screen w-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xl shadow-slate-900/10 md:h-[92vh] md:w-[92vw] md:rounded-xl md:border lg:h-[min(800px,90vh)] lg:w-[min(1100px,90vw)]"
        role="dialog"
      >
        <button
          aria-label={`Close ${dialogTitle.toLowerCase()}`}
          className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35 md:h-8 md:w-8"
          onClick={onClose}
          type="button"
        >
          <X size={20} strokeWidth={2.25} />
        </button>
        <header className="relative flex h-16 items-center justify-between border-b border-[var(--border)] px-5 pr-16 md:h-14 md:pr-14">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[20px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{dialogTitle}</h2>
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-bold text-[#3B82F6]">
              {completionPercent}%
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--bg-elevated)]" aria-hidden="true">
            <div
              className="h-full bg-[#3B82F6] transition-[width] duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </header>

        <div className="edit-problem-modal__body grid min-h-0 overflow-y-auto overflow-x-hidden bg-[var(--bg-elevated)] md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] md:divide-x md:divide-[var(--border)]">
          <details className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg text-[14px] font-bold text-[var(--text-primary)]">
              Preview <ChevronDown size={16} />
            </summary>
            <div className="mt-3 space-y-4">{livePreviewContent}</div>
          </details>

          <main className="min-w-0 bg-[var(--bg-card)] px-4 py-4 md:px-5 md:py-5">
            <div className="space-y-4 pb-4">
              <div className="space-y-3">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-500">Title</span>
                  <input
                    aria-label="Problem title"
                    className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-0 text-[14px] font-semibold !text-slate-950 !shadow-none outline-none transition focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    placeholder="e.g. Two Sum"
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                  />
                  <FieldError message={rootFieldError("title")} />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-500">Slug</span>
                  <input
                    aria-label="Problem slug"
                    className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-slate-100 !px-3 !py-0 font-mono text-[13px] !text-slate-700 !shadow-none outline-none transition placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!bg-white focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    placeholder="auto-generated-from-title"
                    value={slug}
                    onChange={(event) => {
                      setSlugWasEdited(true);
                      setSlug(slugifyTitle(event.target.value));
                    }}
                  />
                  <span className="text-[12px] font-medium text-slate-500">
                    URL-friendly identifier. Auto-generated from the title — edit only if needed.
                  </span>
                  <FieldError message={rootFieldError("slug")} />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(["JAVA"] as ProblemType[]).map((language) => (
                    <button
                      className={`min-h-11 rounded-full border px-4 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:px-3 ${
                        languages.includes(language) ? languageStyles[language].selected : languageStyles[language].unselected
                      }`}
                      key={language}
                      onClick={() => toggleLanguage(language)}
                      type="button"
                    >
                      {language}
                    </button>
                  ))}
                  {(["EASY", "MEDIUM", "HARD"] as ProblemDifficulty[]).map((level) => (
                    <button
                      className={`min-h-11 rounded-full border px-4 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:px-3 ${
                        difficulty === level ? difficultyStyles[level].selected : difficultyStyles[level].unselected
                      }`}
                      key={level}
                      onClick={() => setDifficulty(level)}
                      type="button"
                    >
                      {displayDifficulty(level)}
                    </button>
                  ))}
                </div>
                <FieldError message={rootFieldError("languages") ?? rootFieldError("difficulty")} />
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-500">Tags ({tags.length}/{maxTagCount})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700"
                      key={tag}
                    >
                      <Tag size={12} />
                      {tag}
                      <button
                        aria-label={`Remove ${tag}`}
                        className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:min-w-0"
                        onClick={() => removeTag(tag)}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    aria-label="Add tag"
                    className="!h-7 !w-36 !rounded-full !border !border-slate-200 !bg-white !px-3 !py-0 text-[12px] !shadow-none outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:!bg-slate-100 disabled:!text-slate-400 focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    disabled={tagLimitReached}
                    list="problem-tag-options"
                    placeholder="Add tag..."
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      event.preventDefault();
                      const value = event.currentTarget.value.trim();
                      if (value.length > 0 && !tags.includes(value) && tags.length < maxTagCount) {
                        setTags((current) => [...current, value]);
                        event.currentTarget.value = "";
                      }
                    }}
                  />
                  <datalist id="problem-tag-options">
                    <option value="arrays" />
                    <option value="dynamic-programming" />
                    <option value="recursion" />
                    <option value="binary-search" />
                  </datalist>
                </div>
                {tagLimitReached ? (
                  <p className="text-[12px] font-semibold text-amber-600">Maximum 5 tags reached</p>
                ) : null}
                <FieldError message={rootFieldError("tags")} />
              </section>

              <MarkdownEditor
                activeTab={descriptionTab}
                onChange={setDescription}
                onTabChange={setDescriptionTab}
                value={description}
              />
              <FieldError message={rootFieldError("description")} />

              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-slate-500">Solution video (optional)</span>
                <input
                  aria-label="Solution video URL"
                  className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-0 text-[14px] !text-slate-950 !shadow-none outline-none transition placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={solutionVideoUrl}
                  onChange={(event) => setSolutionVideoUrl(event.target.value)}
                />
                <span className="text-[12px] font-medium text-slate-500">
                  Optional YouTube explanation or walkthrough link.
                </span>
                <FieldError message={rootFieldError("solutionVideoUrl")} />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-slate-500">Knowledge rubric</span>
                <textarea
                  aria-label="Knowledge rubric"
                  className="!min-h-[108px] !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-2 text-[14px] !text-slate-950 !shadow-none outline-none transition placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                  placeholder="Describe what a strong explanation must include: core idea, edge cases, complexity, why the approach works..."
                  value={knowledgeRubric}
                  onChange={(event) => setKnowledgeRubric(event.target.value)}
                />
                <span className="text-[12px] font-medium text-slate-500">
                  Used by the local LLM to evaluate spoken explanations.
                </span>
                <FieldError message={rootFieldError("knowledgeRubric")} />
              </label>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-500">
                    Examples ({Math.min(examples.length, 3)}/3 minimum)
                  </span>
                </div>
                <div className="space-y-3">
                  {examples.length === 0 ? (
                    <p className="text-[13px] font-semibold text-slate-500">No examples yet.</p>
                  ) : null}
                  {examples.map((example, index) => (
                    <article className="relative rounded-lg border border-slate-200 bg-white p-3" key={example.id}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-bold text-slate-900">Example {index + 1}</p>
                        <button
                          aria-label={`Remove example ${index + 1}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                          onClick={() => removeExample(index)}
                          type="button"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Input</span>
                          <input
                            aria-label={`Example ${index + 1} input`}
                            className="!h-9 !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="n = 2"
                            value={example.input}
                            onChange={(event) => updateExample(index, "input", event.target.value)}
                          />
                          <FieldError message={exampleFieldError(index, "input")} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Output</span>
                          <input
                            aria-label={`Example ${index + 1} output`}
                            className="!h-9 !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="2"
                            value={example.output}
                            onChange={(event) => updateExample(index, "output", event.target.value)}
                          />
                          <FieldError message={exampleFieldError(index, "output")} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Explanation</span>
                          <textarea
                            aria-label={`Example ${index + 1} explanation`}
                            className="!min-h-[72px] !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-2 text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="Explain why the output is correct."
                            value={example.explanation}
                            onChange={(event) => updateExample(index, "explanation", event.target.value)}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:min-h-0"
                    onClick={addExample}
                    type="button"
                  >
                    <Plus size={14} /> Add example
                  </button>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 font-mono text-[12px] text-slate-600">
                    1 &lt;= n &lt;= 45
                  </span>
                </div>
                <FieldError message={rootFieldError("examples")} />
              </section>

              <CodeEditorCard
                code={starterCode}
                language={editorLanguage}
                onChange={setStarterCode}
                title={editorLanguage}
                titleIcon={null}
              />
              <FieldError message={rootFieldError("starterCode")} />

              <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                <button
                  className="flex min-h-11 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--text-primary)]"
                  onClick={() => setReferenceExpanded((current) => !current)}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <ChevronDown
                      className={`transition ${referenceExpanded ? "rotate-0" : "-rotate-90"}`}
                      size={16}
                    />
                    <Lock size={14} />
                    Reference solution (Private)
                  </span>
                </button>
                {referenceExpanded ? (
                  <div className="border-t border-[var(--border)]">
                    <CodeEditorCard
                      code={referenceSolution}
                      embedded
                      language={editorLanguage}
                      onChange={setReferenceSolution}
                      title={editorLanguage}
                      titleIcon={null}
                    />
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-slate-500">
                        Test cases ({Math.min(testCases.length, 3)}/3 minimum)
                      </span>
                      <p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">
                        One input shape and one expected output type apply to every case. Use Object for multiple
                        Java parameters, such as {"{\"nums\":[2,7],\"target\":9}"}.
                      </p>
                    </div>
                    <button
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 md:min-h-0"
                      disabled={!canInferTypes}
                      onClick={inferTypesFromCode}
                      type="button"
                    >
                      <Wand2 size={14} /> Infer from code
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-[12px] font-semibold text-slate-500">Input shape</span>
                      <FormSelect
                        ariaLabel="Test case input shape"
                        className="h-10 text-[13px]"
                        options={returnTypeOptions}
                        value={inputType}
                        onValueChange={setInputType}
                      />
                      <FieldError message={rootFieldError("inputType")} />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[12px] font-semibold text-slate-500">Expected output type</span>
                      <FormSelect
                        ariaLabel="Expected output type"
                        className="h-10 text-[13px]"
                        options={returnTypeOptions}
                        value={returnType}
                        onValueChange={setReturnType}
                      />
                      <FieldError message={rootFieldError("returnType")} />
                    </label>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-left text-[13px]">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[38%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2">Input</th>
                        <th className="border-b border-slate-200 px-3 py-2">Expected Output</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-right">Hidden</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testCases.map((testCase, index) => {
                        const inputError = testCaseFieldError(index, "input");
                        const expectedError = testCaseFieldError(index, "expectedOutput");

                        return (
                          <tr className="border-b border-slate-100 align-top last:border-0" key={index}>
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <input
                                  aria-label={`Test case ${index + 1} input`}
                                  className={`!h-8 !w-full !rounded-lg !border !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15 ${
                                    inputError ? "!border-red-300 focus:!border-red-400 focus:!ring-red-100" : "!border-slate-200"
                                  }`}
                                  placeholder={inputPlaceholder}
                                  value={testCase.input}
                                  onChange={(event) => updateTestCase(index, "input", event.target.value)}
                                />
                                <FieldError message={inputError} />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1.5">
                                <input
                                  aria-label={`Test case ${index + 1} expected output`}
                                  className={`!h-8 !w-full !rounded-lg !border !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15 ${
                                    expectedError ? "!border-red-300 focus:!border-red-400 focus:!ring-red-100" : "!border-slate-200"
                                  }`}
                                  placeholder={expectedOutputPlaceholder}
                                  value={testCase.expectedOutput}
                                  onChange={(event) => updateTestCase(index, "expectedOutput", event.target.value)}
                                />
                                <FieldError message={expectedError} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                aria-label={`Toggle hidden for test case ${index + 1}`}
                                className={`relative inline-flex h-8 w-12 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:h-5 md:w-9 ${
                                  testCase.hidden ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                                onClick={() => updateTestCase(index, "hidden", !testCase.hidden)}
                                type="button"
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                    testCase.hidden ? "left-7 md:left-[18px]" : "left-0.5"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                aria-label={`Delete test case ${index + 1}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                                onClick={() => removeTestCase(index)}
                                type="button"
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 p-3">
                  <button
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:min-h-0"
                    onClick={addTestCase}
                    type="button"
                  >
                    <Plus size={14} /> Add test case
                  </button>
                  <FieldError message={rootFieldError("testCases")} />
                </div>
              </section>
            </div>
          </main>

          <aside className="hidden min-w-0 bg-[var(--bg-elevated)] px-4 py-4 md:block md:px-5 md:py-5">
            <div className="sticky top-4 min-w-0 space-y-4">
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">Live Preview</h3>
              {livePreviewContent}
            </div>
          </aside>
        </div>

        <footer className="flex min-h-[60px] flex-col items-stretch justify-end gap-3 border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 md:flex-row md:items-center md:px-5">
          <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
            {submitError ? <span className="text-[12px] font-semibold text-red-600">{submitError}</span> : null}
            <button
              className="order-2 min-h-11 rounded-lg px-3 py-2 text-[14px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:order-1 md:min-h-0"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="order-1 min-h-11 rounded-lg bg-[#3B82F6] px-4 py-2 text-[14px] font-bold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/25 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 md:order-3 md:min-h-0"
              disabled={!isFormValid || isSubmitting}
              onClick={() => void handlePrimaryAction()}
              title={submitDisabledReason}
              type="button"
            >
              {isSubmitting ? "Saving..." : primaryActionLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function normalizeTestValue(type: TestValueType, rawValue: string) {
  const trimmed = rawValue.trim();
  if (type === "String") {
    if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
      return trimmed;
    }
    return JSON.stringify(trimmed);
  }
  if (type.endsWith("[][]") || type === "Object") {
    return trimmed;
  }
  if (type.endsWith("[]")) {
    if (trimmed.startsWith("[")) {
      return trimmed;
    }
    const values = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    if (type === "String[]") {
      return JSON.stringify(values);
    }
    if (type === "boolean[]") {
      return JSON.stringify(values.map((item) => item.toLowerCase() === "true"));
    }
    return JSON.stringify(values.map((item) => Number(item)));
  }
  return trimmed;
}

function placeholderForType(type: TestValueType, kind: "input" | "expected") {
  if (type === "Object") {
    return kind === "input" ? '{"nums":[2,7,11,15],"target":9}' : '{"value":42}';
  }
  if (type === "String") {
    return kind === "input" ? "hello" : "world";
  }
  if (type === "boolean") {
    return "true";
  }
  if (type === "double") {
    return "3.14";
  }
  if (type === "long") {
    return "42";
  }
  if (type === "int[]") {
    return "[2,7,11,15]";
  }
  if (type === "long[]") {
    return "[2,7,11,15]";
  }
  if (type === "double[]") {
    return "[1.5,2.5,3.5]";
  }
  if (type === "boolean[]") {
    return "[true,false,true]";
  }
  if (type === "String[]") {
    return '["a","b","c"]';
  }
  if (type === "int[][]") {
    return "[[1,2],[3,4]]";
  }
  if (type === "long[][]") {
    return "[[1,2],[3,4]]";
  }
  if (type === "double[][]") {
    return "[[1.5,2.5],[3.5,4.5]]";
  }
  if (type === "String[][]") {
    return '[["a","b"],["c","d"]]';
  }
  return "42";
}

function firstNonBlank(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim()) ?? "";
}

function inferReturnType(source: string): TestValueType {
  return parseSolveSignature(source)?.returnType ?? "int";
}

function inferInputTypeFromSource(source: string): TestValueType | null {
  const signature = parseSolveSignature(source);
  if (!signature) {
    return null;
  }

  if (signature.parameters.length === 1) {
    return javaTypeToTestValueType(signature.parameters[0].type);
  }

  return "Object";
}

function inferInputType(inputData: string): TestValueType {
  const trimmed = inputData.trim();
  if (trimmed.startsWith("{")) {
    return "Object";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      if (parsed.every((row) => Array.isArray(row))) {
        const firstValue = parsed.flat()[0];
        if (typeof firstValue === "string") {
          return "String[][]";
        }
        if (typeof firstValue === "number") {
          return Number.isInteger(firstValue) ? "int[][]" : "double[][]";
        }
      }
      if (parsed.every((item) => typeof item === "string")) {
        return "String[]";
      }
      if (parsed.every((item) => typeof item === "boolean")) {
        return "boolean[]";
      }
      if (parsed.every((item) => typeof item === "number")) {
        return parsed.every((item) => Number.isInteger(item)) ? "int[]" : "double[]";
      }
    }
    if (typeof parsed === "boolean") {
      return "boolean";
    }
    if (typeof parsed === "number") {
      return Number.isInteger(parsed) ? "int" : "double";
    }
    if (typeof parsed === "string") {
      return "String";
    }
  } catch {
    if (/^(true|false)$/i.test(trimmed)) {
      return "boolean";
    }
    if (/^-?\d+$/.test(trimmed)) {
      return "int";
    }
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
      return "double";
    }
  }

  return "String";
}

function parseSolveSignature(source: string): { returnType: TestValueType; parameters: Array<{ type: string; name: string }> } | null {
  const match = source.match(/public\s+(?:static\s+)?([\w<>\[\]]+)\s+solve\s*\(([^)]*)\)/m);
  if (!match) {
    return null;
  }

  const rawParameters = match[2].trim();
  const parameters = rawParameters
    ? splitJavaParameters(rawParameters)
        .map((parameter) => parameter.trim().replace(/\s+/g, " "))
        .map((parameter) => {
          const pieces = parameter.split(" ");
          return {
            type: pieces.slice(0, -1).join(" ").replace("...", "[]"),
            name: pieces[pieces.length - 1],
          };
        })
        .filter((parameter) => parameter.type && parameter.name)
    : [];

  return {
    returnType: javaTypeToTestValueType(match[1]),
    parameters,
  };
}

function splitJavaParameters(parameters: string) {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of parameters) {
    if (character === "<") {
      depth++;
    } else if (character === ">") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      result.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) {
    result.push(current);
  }

  return result;
}

function javaTypeToTestValueType(javaType: string): TestValueType {
  const normalized = javaType.trim().replace(/\s+/g, "");
  if (
    normalized === "int" ||
    normalized === "long" ||
    normalized === "double" ||
    normalized === "boolean" ||
    normalized === "String" ||
    normalized === "int[]" ||
    normalized === "long[]" ||
    normalized === "double[]" ||
    normalized === "boolean[]" ||
    normalized === "String[]" ||
    normalized === "int[][]" ||
    normalized === "long[][]" ||
    normalized === "double[][]" ||
    normalized === "String[][]"
  ) {
    return normalized;
  }

  if (normalized === "Integer") {
    return "int";
  }
  if (normalized === "Long") {
    return "long";
  }
  if (normalized === "Double") {
    return "double";
  }
  if (normalized === "Boolean") {
    return "boolean";
  }
  if (normalized.startsWith("List<") || normalized.startsWith("Map<")) {
    return "Object";
  }

  return "Object";
}

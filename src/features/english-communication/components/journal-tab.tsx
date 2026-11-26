"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Clock3,
  Edit3,
  NotebookPen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Drawer } from "@/components/ui/drawer";
import { getEnglishEntries } from "@/features/english-communication/english-streak";
import {
  assessmentSources,
  englishPracticeCategories,
  type CommunicationAssessment,
  type EnglishPracticeCategory,
  type PracticeJournalEntry,
} from "@/features/english-communication/english-types";
import type { TimeEntry } from "@/features/time-tracker/time-tracker-types";
import { formatDate, formatDuration, toDateInputValue } from "@/features/time-tracker/time-tracker-utils";

type JournalTabProps = {
  journals: PracticeJournalEntry[];
  assessments: CommunicationAssessment[];
  allEntries: TimeEntry[];
  onSave: (
    nextJournals: PracticeJournalEntry[],
    nextAssessments: CommunicationAssessment[],
  ) => Promise<void>;
  initialAction?: string | null;
  onActionHandled?: () => void;
};

const RATING_FIELDS = [
  { key: "fluency", label: "Fluency" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "pronunciation", label: "Pronunciation" },
  { key: "confidence", label: "Confidence" },
  { key: "clarity", label: "Clarity" },
  { key: "sentenceFormation", label: "Sentence Formation" },
] as const;

export function JournalTab({
  journals,
  assessments,
  allEntries,
  onSave,
  initialAction,
  onActionHandled,
}: JournalTabProps) {
  const [subSection, setSubSection] = useState<"journals" | "assessments">("journals");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Journal drawer
  const [journalDrawerOpen, setJournalDrawerOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [jTitle, setJTitle] = useState("");
  const [jTopic, setJTopic] = useState("");
  const [jDate, setJDate] = useState(toDateInputValue(new Date()));
  const [jLinkedSessionId, setJLinkedSessionId] = useState("");
  const [jCategory, setJCategory] = useState<EnglishPracticeCategory>("Speaking");
  const [jLearned, setJLearned] = useState("");
  const [jDifficulties, setJDifficulties] = useState("");
  const [jSentences, setJSentences] = useState("");
  const [jExpressions, setJExpressions] = useState("");
  const [jExternalFeedback, setJExternalFeedback] = useState("");
  const [jPersonalFeedback, setJPersonalFeedback] = useState("");
  const [jNextGoal, setJNextGoal] = useState("");

  // Assessment drawer
  const [assessDrawerOpen, setAssessDrawerOpen] = useState(false);
  const [editingAssessId, setEditingAssessId] = useState<string | null>(null);
  const [aDate, setADate] = useState(toDateInputValue(new Date()));
  const [aSource, setASource] = useState<string>(assessmentSources[0]);
  const [aScores, setAScores] = useState({
    fluency: 6,
    grammar: 6,
    vocabulary: 6,
    pronunciation: 6,
    confidence: 6,
    clarity: 6,
    sentenceFormation: 6,
  });
  const [aStrengths, setAStrengths] = useState("");
  const [aImprovements, setAImprovements] = useState("");
  const [aFeedbackNotes, setAFeedbackNotes] = useState("");
  const [aNextFocus, setANextFocus] = useState("");

  useEffect(() => {
    if (initialAction === "add") {
      setSubSection("journals");
      openAddJournal();
      onActionHandled?.();
    }
  }, [initialAction]);

  const englishSessions = useMemo(
    () =>
      getEnglishEntries(allEntries).sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      ),
    [allEntries],
  );

  const sessionMap = useMemo(() => {
    const map = new Map<string, TimeEntry>();
    for (const s of englishSessions) map.set(s.id, s);
    return map;
  }, [englishSessions]);

  const filteredJournals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return journals
      .filter((j) => (categoryFilter === "all" ? true : j.practiceCategory === categoryFilter))
      .filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.topic.toLowerCase().includes(q) ||
          j.whatILearned.toLowerCase().includes(q) ||
          j.externalFeedback.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [journals, query, categoryFilter]);

  const sortedAssessments = useMemo(
    () => [...assessments].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate)),
    [assessments],
  );

  const assessmentChartData = useMemo(
    () =>
      [...assessments]
        .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate))
        .map((a) => ({
          date: a.assessmentDate,
          Fluency: a.fluency,
          Grammar: a.grammar,
          Vocabulary: a.vocabulary,
          Pronunciation: a.pronunciation,
          Confidence: a.confidence,
          Clarity: a.clarity,
          Average: Number(
            (
              (a.fluency +
                a.grammar +
                a.vocabulary +
                a.pronunciation +
                a.confidence +
                a.clarity +
                a.sentenceFormation) /
              7
            ).toFixed(1),
          ),
        })),
    [assessments],
  );

  function openAddJournal() {
    setEditingJournalId(null);
    setJTitle("");
    setJTopic("");
    setJDate(toDateInputValue(new Date()));
    setJLinkedSessionId("");
    setJCategory("Speaking");
    setJLearned("");
    setJDifficulties("");
    setJSentences("");
    setJExpressions("");
    setJExternalFeedback("");
    setJPersonalFeedback("");
    setJNextGoal("");
    setJournalDrawerOpen(true);
  }

  function openEditJournal(item: PracticeJournalEntry) {
    setEditingJournalId(item.id);
    setJTitle(item.title);
    setJTopic(item.topic);
    setJDate(item.date);
    setJLinkedSessionId(item.linkedSessionId || "");
    setJCategory(item.practiceCategory);
    setJLearned(item.whatILearned);
    setJDifficulties(item.difficulties);
    setJSentences(item.sentencesToImprove);
    setJExpressions(item.newExpressions);
    setJExternalFeedback(item.externalFeedback);
    setJPersonalFeedback(item.personalFeedback);
    setJNextGoal(item.nextPracticeGoal);
    setJournalDrawerOpen(true);
  }

  async function handleSaveJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!jTitle.trim()) {
      toast.error("Journal title is required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingJournalId ? journals.find((j) => j.id === editingJournalId) : null;

    const entry: PracticeJournalEntry = {
      id: editingJournalId || crypto.randomUUID(),
      title: jTitle.trim(),
      topic: jTopic.trim(),
      date: jDate,
      ...(jLinkedSessionId ? { linkedSessionId: jLinkedSessionId } : {}),
      practiceCategory: jCategory,
      whatILearned: jLearned.trim(),
      difficulties: jDifficulties.trim(),
      sentencesToImprove: jSentences.trim(),
      newExpressions: jExpressions.trim(),
      externalFeedback: jExternalFeedback.trim(),
      personalFeedback: jPersonalFeedback.trim(),
      nextPracticeGoal: jNextGoal.trim(),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextJournals = editingJournalId
      ? journals.map((j) => (j.id === editingJournalId ? entry : j))
      : [entry, ...journals];

    await onSave(nextJournals, assessments);
    setJournalDrawerOpen(false);
    toast.success(editingJournalId ? "Journal updated." : "Practice journal saved.");
  }

  function openAddAssessment() {
    setEditingAssessId(null);
    setADate(toDateInputValue(new Date()));
    setASource(assessmentSources[0]);
    setAScores({
      fluency: 6,
      grammar: 6,
      vocabulary: 6,
      pronunciation: 6,
      confidence: 6,
      clarity: 6,
      sentenceFormation: 6,
    });
    setAStrengths("");
    setAImprovements("");
    setAFeedbackNotes("");
    setANextFocus("");
    setAssessDrawerOpen(true);
  }

  function openEditAssessment(item: CommunicationAssessment) {
    setEditingAssessId(item.id);
    setADate(item.assessmentDate);
    setASource(item.assessmentSource);
    setAScores({
      fluency: item.fluency,
      grammar: item.grammar,
      vocabulary: item.vocabulary,
      pronunciation: item.pronunciation,
      confidence: item.confidence,
      clarity: item.clarity,
      sentenceFormation: item.sentenceFormation,
    });
    setAStrengths(item.strengths);
    setAImprovements(item.improvementAreas);
    setAFeedbackNotes(item.feedbackNotes);
    setANextFocus(item.nextWeekFocus);
    setAssessDrawerOpen(true);
  }

  async function handleSaveAssessment(e: React.FormEvent) {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const existing = editingAssessId ? assessments.find((a) => a.id === editingAssessId) : null;

    const nextItem: CommunicationAssessment = {
      id: editingAssessId || crypto.randomUUID(),
      assessmentDate: aDate,
      assessmentSource: aSource,
      ...aScores,
      strengths: aStrengths.trim(),
      improvementAreas: aImprovements.trim(),
      feedbackNotes: aFeedbackNotes.trim(),
      nextWeekFocus: aNextFocus.trim(),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextAssessments = editingAssessId
      ? assessments.map((a) => (a.id === editingAssessId ? nextItem : a))
      : [nextItem, ...assessments];

    await onSave(journals, nextAssessments);
    setAssessDrawerOpen(false);
    toast.success(editingAssessId ? "Assessment updated." : "Communication assessment logged.");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubSection("journals")}
            className={`h-8 px-3.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              subSection === "journals"
                ? "bg-accent-subtle text-accent-text border border-accent/30"
                : "text-text-secondary hover:text-text-primary bg-surface-raised border border-border"
            }`}
          >
            <NotebookPen className="h-3.5 w-3.5" /> Speaking Practice Journal ({journals.length})
          </button>
          <button
            type="button"
            onClick={() => setSubSection("assessments")}
            className={`h-8 px-3.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              subSection === "assessments"
                ? "bg-accent-subtle text-accent-text border border-accent/30"
                : "text-text-secondary hover:text-text-primary bg-surface-raised border border-border"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Weekly Assessments ({assessments.length})
          </button>
        </div>

        <button
          type="button"
          onClick={subSection === "journals" ? openAddJournal : openAddAssessment}
          className="h-9 px-4 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5 w-fit"
        >
          <Plus className="h-4 w-4" />
          {subSection === "journals" ? "New Journal Entry" : "New Assessment"}
        </button>
      </div>

      {subSection === "journals" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search practice reflections or external feedback..."
                className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
            >
              <option value="all">All Practice Types</option>
              {englishPracticeCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredJournals.length > 0 ? (
            <div className="flex flex-col gap-4">
              {filteredJournals.map((entry) => {
                const linked = entry.linkedSessionId
                  ? sessionMap.get(entry.linkedSessionId)
                  : undefined;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-border bg-surface p-5 shadow-card hover:border-border-hover transition-colors flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[16px] font-semibold text-text-primary">
                            {entry.title}
                          </h3>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-accent-subtle text-accent-text">
                            {entry.practiceCategory}
                          </span>
                          {linked && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary">
                              <Clock3 className="h-3 w-3 text-accent" />
                              Linked: {linked.title} ({formatDuration(linked.duration)})
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-text-tertiary mt-1">
                          {formatDate(entry.date)}
                          {entry.topic ? ` · Topic: ${entry.topic}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditJournal(entry)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this journal entry?")) {
                              void onSave(
                                journals.filter((j) => j.id !== entry.id),
                                assessments,
                              );
                              toast.success("Journal entry deleted.");
                            }
                          }}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-surface-raised"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12.5px]">
                      {entry.whatILearned && (
                        <div className="rounded-lg bg-background border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                            What I Learned
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.whatILearned}
                          </p>
                        </div>
                      )}
                      {entry.difficulties && (
                        <div className="rounded-lg bg-background border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                            Difficulties
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.difficulties}
                          </p>
                        </div>
                      )}
                      {entry.sentencesToImprove && (
                        <div className="rounded-lg bg-background border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                            Sentences to Improve
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.sentencesToImprove}
                          </p>
                        </div>
                      )}
                      {entry.newExpressions && (
                        <div className="rounded-lg bg-background border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                            New Expressions
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.newExpressions}
                          </p>
                        </div>
                      )}
                      {entry.externalFeedback && (
                        <div className="rounded-lg bg-background border border-accent/20 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-accent-text mb-1">
                            External Feedback (Mentor / Teacher / ChatGPT)
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.externalFeedback}
                          </p>
                        </div>
                      )}
                      {entry.personalFeedback && (
                        <div className="rounded-lg bg-background border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                            Personal Reflection
                          </div>
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.personalFeedback}
                          </p>
                        </div>
                      )}
                    </div>

                    {entry.nextPracticeGoal && (
                      <div className="text-[12px] text-accent-text border-t border-border pt-2.5">
                        Next Practice Goal:{" "}
                        <span className="text-text-primary">{entry.nextPracticeGoal}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center flex flex-col items-center gap-2">
              <NotebookPen className="h-8 w-8 text-text-tertiary opacity-60" />
              <p className="text-[13px] text-text-secondary">
                No text-based speaking journals yet. Save reflections or ChatGPT/mentor feedback here.
              </p>
              <button
                type="button"
                onClick={openAddJournal}
                className="mt-2 h-8 px-4 rounded-md bg-accent text-background text-[12px] font-semibold"
              >
                Write First Entry
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-4 text-[12px] text-text-secondary flex items-center justify-between gap-2">
            <span>
              All scores below are <strong className="text-text-primary">self-assessed</strong> or{" "}
              <strong className="text-text-primary">manually entered external feedback</strong> (1–10 scale).
            </span>
          </div>

          {assessmentChartData.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.06em] text-text-tertiary mb-4">
                Communication Assessment Trends (1–10)
              </h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={assessmentChartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A8A8F", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[1, 10]} tick={{ fill: "#8A8A8F", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "#1A1A1E",
                        color: "#F2F2F3",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="Average" stroke="#CBA365" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="Fluency" stroke="#3FB950" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Grammar" stroke="#8A8A8F" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Confidence" stroke="#E6C68E" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {sortedAssessments.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sortedAssessments.map((item) => {
                const avg = (
                  (item.fluency +
                    item.grammar +
                    item.vocabulary +
                    item.pronunciation +
                    item.confidence +
                    item.clarity +
                    item.sentenceFormation) /
                  7
                ).toFixed(1);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[15px] font-semibold text-text-primary">
                            {formatDate(item.assessmentDate)}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-accent-subtle text-accent-text font-medium">
                            {item.assessmentSource}
                          </span>
                          <span className="text-[12px] font-mono text-accent">
                            Avg {avg} / 10
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditAssessment(item)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this assessment?")) {
                              void onSave(
                                journals,
                                assessments.filter((a) => a.id !== item.id),
                              );
                              toast.success("Assessment deleted.");
                            }
                          }}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-surface-raised"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                      {RATING_FIELDS.map((rf) => (
                        <div
                          key={rf.key}
                          className="rounded-lg border border-border bg-background p-2.5 text-center"
                        >
                          <div className="text-[10px] text-text-tertiary truncate">{rf.label}</div>
                          <div className="text-[16px] font-semibold text-text-primary mt-0.5 tabular-nums">
                            {item[rf.key]}
                            <span className="text-[10px] text-text-tertiary font-normal">/10</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                      {item.strengths && (
                        <div className="rounded-lg border border-border bg-background p-3">
                          <div className="text-[10px] uppercase tracking-wider text-success mb-1">
                            Strengths
                          </div>
                          <p className="text-text-secondary">{item.strengths}</p>
                        </div>
                      )}
                      {item.improvementAreas && (
                        <div className="rounded-lg border border-border bg-background p-3">
                          <div className="text-[10px] uppercase tracking-wider text-warning mb-1">
                            Areas to Improve
                          </div>
                          <p className="text-text-secondary">{item.improvementAreas}</p>
                        </div>
                      )}
                    </div>
                    {item.nextWeekFocus && (
                      <div className="text-[12px] text-accent-text border-t border-border pt-2.5">
                        Next Week&apos;s Focus:{" "}
                        <span className="text-text-primary">{item.nextWeekFocus}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center flex flex-col items-center gap-2">
              <ClipboardCheck className="h-8 w-8 text-text-tertiary opacity-60" />
              <p className="text-[13px] text-text-secondary">
                No weekly communication assessments logged yet.
              </p>
              <button
                type="button"
                onClick={openAddAssessment}
                className="mt-2 h-8 px-4 rounded-md bg-accent text-background text-[12px] font-semibold"
              >
                Add First Self-Assessment
              </button>
            </div>
          )}
        </>
      )}

      {/* Journal Drawer */}
      <Drawer
        isOpen={journalDrawerOpen}
        onClose={() => setJournalDrawerOpen(false)}
        title={editingJournalId ? "Edit Speaking Journal" : "New Speaking Practice Journal"}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setJournalDrawerOpen(false)}
              className="h-9 px-4 rounded-md border border-border text-[13px] text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="journal-form"
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold"
            >
              Save Journal
            </button>
          </div>
        }
      >
        <form id="journal-form" onSubmit={handleSaveJournal} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Title *</label>
            <input
              type="text"
              required
              value={jTitle}
              onChange={(e) => setJTitle(e.target.value)}
              placeholder="e.g. System design explanation drill"
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Date</label>
              <input
                type="date"
                value={jDate}
                onChange={(e) => setJDate(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Category</label>
              <select
                value={jCategory}
                onChange={(e) => setJCategory(e.target.value as EnglishPracticeCategory)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {englishPracticeCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Topic</label>
            <input
              type="text"
              value={jTopic}
              onChange={(e) => setJTopic(e.target.value)}
              placeholder="e.g. Explaining Redis caching"
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Link to Time Tracker Session (Optional)
            </label>
            <select
              value={jLinkedSessionId}
              onChange={(e) => setJLinkedSessionId(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            >
              <option value="">None</option>
              {englishSessions.slice(0, 30).map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.date)} · {s.title} ({formatDuration(s.duration)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">What I Learned</label>
            <textarea
              rows={2}
              value={jLearned}
              onChange={(e) => setJLearned(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Difficulties</label>
            <textarea
              rows={2}
              value={jDifficulties}
              onChange={(e) => setJDifficulties(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Sentences to Improve
            </label>
            <textarea
              rows={2}
              value={jSentences}
              onChange={(e) => setJSentences(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">New Expressions</label>
            <textarea
              rows={2}
              value={jExpressions}
              onChange={(e) => setJExpressions(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              External Feedback (ChatGPT, Mentor, Teacher)
            </label>
            <textarea
              rows={2}
              value={jExternalFeedback}
              onChange={(e) => setJExternalFeedback(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Personal Feedback</label>
            <textarea
              rows={2}
              value={jPersonalFeedback}
              onChange={(e) => setJPersonalFeedback(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Next Practice Goal
            </label>
            <input
              type="text"
              value={jNextGoal}
              onChange={(e) => setJNextGoal(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>
        </form>
      </Drawer>

      {/* Assessment Drawer */}
      <Drawer
        isOpen={assessDrawerOpen}
        onClose={() => setAssessDrawerOpen(false)}
        title={editingAssessId ? "Edit Assessment" : "Weekly Communication Assessment"}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAssessDrawerOpen(false)}
              className="h-9 px-4 rounded-md border border-border text-[13px] text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="assess-form"
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold"
            >
              Save Assessment
            </button>
          </div>
        }
      >
        <form id="assess-form" onSubmit={handleSaveAssessment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Date</label>
              <input
                type="date"
                value={aDate}
                onChange={(e) => setADate(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Source</label>
              <select
                value={aSource}
                onChange={(e) => setASource(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {assessmentSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {RATING_FIELDS.map((rf) => (
              <div key={rf.key} className="flex items-center justify-between gap-4">
                <label className="text-[12px] text-text-primary w-36">{rf.label}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={aScores[rf.key]}
                  onChange={(e) =>
                    setAScores((prev) => ({ ...prev, [rf.key]: Number(e.target.value) }))
                  }
                  className="flex-1 accent-[#CBA365]"
                />
                <span className="text-[13px] font-mono text-accent w-8 text-right">
                  {aScores[rf.key]}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Strengths</label>
            <textarea
              rows={2}
              value={aStrengths}
              onChange={(e) => setAStrengths(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Improvement Areas
            </label>
            <textarea
              rows={2}
              value={aImprovements}
              onChange={(e) => setAImprovements(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Feedback Notes</label>
            <textarea
              rows={2}
              value={aFeedbackNotes}
              onChange={(e) => setAFeedbackNotes(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Next Week&apos;s Focus
            </label>
            <input
              type="text"
              value={aNextFocus}
              onChange={(e) => setANextFocus(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}

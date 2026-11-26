import type { DailySpeakingChallenge } from "@/features/english-communication/english-types";

export const DAILY_SPEAKING_CHALLENGES: DailySpeakingChallenge[] = [
  {
    id: "ch-rest-api",
    title: "Explain REST APIs in Simple English",
    prompt:
      "Explain how REST APIs work as if speaking to a non-technical product manager. Cover requests, responses, status codes, and an everyday analogy in 2–3 minutes.",
    category: "Technical communication",
    estimatedMinutes: 5,
    tips: ["Avoid jargon like 'stateless serialization' initially", "Use a restaurant waiter analogy", "Speak in short, clear sentences"],
  },
  {
    id: "ch-self-intro",
    title: "Introduce Yourself Professionally",
    prompt:
      "Deliver a crisp 90-second self-introduction for a software engineering interview: who you are, key projects you built, your tech stack, and what excites you next.",
    category: "Interview preparation",
    estimatedMinutes: 5,
    tips: ["Structure: Present -> Past -> Future", "Pause briefly between sections", "Keep tone confident and conversational"],
  },
  {
    id: "ch-project-walkthrough",
    title: "Explain One of Your Software Engineering Projects",
    prompt:
      "Walk through SaimTrack or another flagship project you built. Describe the problem, architecture, toughest bug you solved, and impact.",
    category: "Technical communication",
    estimatedMinutes: 8,
    tips: ["Use STAR or Problem-Solution-Result", "Explain why you chose Firebase/Next.js", "Highlight one concrete technical challenge"],
  },
  {
    id: "ch-describe-day",
    title: "Describe Your Day in English",
    prompt:
      "Narrate your morning routine, coding tasks, blockers, and evening plans in fluent past and future tenses without switching back to your native language.",
    category: "General conversation",
    estimatedMinutes: 5,
    tips: ["Watch tense consistency (past simple vs present perfect)", "Use transition words like 'afterward', 'meanwhile', 'eventually'"],
  },
  {
    id: "ch-frontend-backend",
    title: "Frontend vs Backend Explained",
    prompt:
      "Explain the difference between frontend and backend development, how they communicate, and where authentication & databases fit in.",
    category: "Technical communication",
    estimatedMinutes: 5,
    tips: ["Give concrete examples (UI buttons vs Firestore rules)", "Practice smooth transitions"],
  },
  {
    id: "ch-client-intro",
    title: "Practice a Client Meeting Introduction",
    prompt:
      "Roleplay the first 3 minutes of a discovery call with a new client: greet warmly, set the agenda, and ask two clarifying questions about their business goal.",
    category: "Professional communication",
    estimatedMinutes: 6,
    tips: ["Use polite openers ('Thanks for making time today')", "Confirm expectations clearly"],
  },
  {
    id: "ch-vocab-five",
    title: "Use Five Saved Vocabulary Words in Sentences",
    prompt:
      "Pick 5 words from your Vocabulary Vault and speak 2 original, natural sentences aloud for each word—relating at least half to work or daily life.",
    category: "Vocabulary",
    estimatedMinutes: 7,
    tips: ["Don't recite dictionary definitions—build real context", "Pay attention to prepositions around each word"],
  },
  {
    id: "ch-dsa-walkthrough",
    title: "Explain a DSA Problem Out Loud",
    prompt:
      "Pick a medium LeetCode problem you solved recently. Explain the brute-force idea, why it's slow, your optimal data structure, and Big-O complexity out loud.",
    category: "Interview preparation",
    estimatedMinutes: 10,
    tips: ["Narrate your thought process before jumping to code", "Clearly state time and space complexity"],
  },
  {
    id: "ch-disagree-politely",
    title: "Disagree Politely in a Code Review",
    prompt:
      "Practice pushing back on an architectural decision during a team sync while keeping the tone collaborative, respectful, and data-driven.",
    category: "Professional communication",
    estimatedMinutes: 5,
    tips: ["Use 'I see your point, and...', 'Have we considered the tradeoff of...'"],
  },
  {
    id: "ch-shadowing-podcast",
    title: "5-Minute Native Speaker Shadowing",
    prompt:
      "Play a 2-minute tech talk or engineering podcast clip, pause sentence by sentence, and mimic the speaker's rhythm, intonation, and word linking.",
    category: "Shadowing",
    estimatedMinutes: 8,
    tips: ["Focus on sentence stress and pausing", "Match pitch rise/fall rather than rushing"],
  },
  {
    id: "ch-database-indexing",
    title: "Explain Indexing & Caching Simply",
    prompt:
      "Explain why database queries slow down at scale and how indexing or local caching (like IndexedDB) speeds them up.",
    category: "Technical communication",
    estimatedMinutes: 6,
    tips: ["Use a book index analogy", "Mention read vs write tradeoffs"],
  },
  {
    id: "ch-deadline-delay",
    title: "Communicate a Project Delay Professionally",
    prompt:
      "Roleplay updating a stakeholder that a feature will slip by 2 days. Explain the root cause, mitigation plan, and new realistic delivery date.",
    category: "Professional communication",
    estimatedMinutes: 5,
    tips: ["Own the issue early without over-apologizing", "End with a concrete next step"],
  },
  {
    id: "ch-minimal-pairs",
    title: "Pronunciation Drill: V/W & TH Sounds",
    prompt:
      "Read 10 pairs of commonly confused words aloud slowly (very/wary, vest/west, think/sink, this/dis), exaggerating mouth position before speaking at normal speed.",
    category: "Pronunciation",
    estimatedMinutes: 5,
    tips: ["Slow down clarity before speed", "Record mental notes of tricky words in Mistakes tab"],
  },
  {
    id: "ch-storytelling-bug",
    title: "Tell the Story of Your Hardest Bug",
    prompt:
      "Describe a real production bug (e.g. background timer throttling), how you investigated it, what misled you, and how you fixed it.",
    category: "Speaking",
    estimatedMinutes: 7,
    tips: ["Build tension -> investigation -> resolution", "Keep pacing steady"],
  },
  {
    id: "ch-read-aloud",
    title: "Read Documentation Aloud with Expression",
    prompt:
      "Open a technical article or RFC and read 3 paragraphs aloud clearly, pausing at commas and periods and emphasizing key nouns and verbs.",
    category: "Reading",
    estimatedMinutes: 5,
    tips: ["Avoid monotone reading", "Look up pronunciation for unfamiliar words"],
  },
  {
    id: "ch-summarize-article",
    title: "Summarize an Engineering Blog in 60 Seconds",
    prompt:
      "After reading a short tech or news piece, summarize its main argument and two supporting points out loud in under 60 seconds.",
    category: "Speaking",
    estimatedMinutes: 6,
    tips: ["Lead with the main takeaway", "Use concise linking phrases"],
  },
  {
    id: "ch-async-status",
    title: "Write & Speak a Crisp Standup Update",
    prompt:
      "Practice giving a structured standup update: Yesterday I shipped..., Today I'm focusing on..., My current blocker is...",
    category: "Professional communication",
    estimatedMinutes: 4,
    tips: ["Keep it under 45 seconds", "State blockers specifically"],
  },
  {
    id: "ch-small-talk",
    title: "2-Minute Natural Small Talk Opener",
    prompt:
      "Practice starting a friendly conversation with a remote colleague before a meeting starts: weekend recap, weather, or a shared hobby.",
    category: "General conversation",
    estimatedMinutes: 5,
    tips: ["Sound relaxed and curious", "Ask an open-ended follow-up question"],
  },
  {
    id: "ch-system-design-url",
    title: "Pitch a URL Shortener Design",
    prompt:
      "Explain the high-level architecture of a URL shortener in plain English: hashing, redirection, read-heavy scaling, and caching.",
    category: "Interview preparation",
    estimatedMinutes: 8,
    tips: ["Start with requirements before components", "Keep explanations conversational"],
  },
  {
    id: "ch-grammar-audit",
    title: "Turn 5 Past Mistakes into Clean Sentences",
    prompt:
      "Open your Grammar Mistake Journal, pick 5 logged errors, and speak the corrected and natural alternative versions 3 times each.",
    category: "Grammar",
    estimatedMinutes: 6,
    tips: ["Focus on muscle memory for the corrected phrasing", "Mark mastered items as Resolved"],
  },
];

export function getChallengeForDateKey(dateKey: string): DailySpeakingChallenge {
  // Deterministic hash based on YYYY-MM-DD so the challenge stays consistent all day
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const index = hash % DAILY_SPEAKING_CHALLENGES.length;
  return DAILY_SPEAKING_CHALLENGES[index];
}

export function getPreviousChallenges(
  todayKey: string,
  count = 7,
  addDaysFn?: (key: string, delta: number) => string,
): Array<{ dateKey: string; challenge: DailySpeakingChallenge }> {
  const shift =
    addDaysFn ??
    ((key: string, delta: number) => {
      const [y, m, d] = key.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    });

  return Array.from({ length: count }, (_, idx) => {
    const dk = shift(todayKey, -(idx + 1));
    return { dateKey: dk, challenge: getChallengeForDateKey(dk) };
  });
}

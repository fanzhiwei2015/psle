import { useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: number;
  code: string;
  title: string;
  subject: string;
  questionType: string;
  topic: string;
  tags: string[];
  reminderWord: string;
  exampleSentence: string;
  optionItems: string[];
  difficulty: string;
  status: string;
  stem: string;
  answer: string;
  analysis: string;
  attemptsCount: number;
  correctCount: number;
  updatedAt: string;
};

type SubjectMeta = {
  key: string;
  label: string;
  value: string;
  aliases: string[];
};

type PromptSettingsResponse = {
  promptTemplate: string;
  updatedAt?: string;
};

type ImportPreviewItem = {
  index: number;
  subject: string;
  questionType: string;
  topic: string;
  reminderWord: string;
  exampleSentence: string;
  optionItems: string[];
  problemDescription: string;
  answer: string;
  childAnswer: string;
  generatedCode: string;
  generatedTitle: string;
};

type ImportValidationResponse = {
  valid: boolean;
  count: number;
  items?: ImportPreviewItem[];
  errors?: string[];
};

type ImportResponse = {
  importedCount: number;
  questions: Question[];
};

type UpdateTagsResponse = Question;

type QuestionAttempt = {
  id: number;
  questionId: number;
  answerText: string;
  source: string;
  attemptNo: number;
  isCorrect?: boolean;
  createdAt: string;
};

type SubmitAttemptResponse = {
  question: Question;
  attempt: QuestionAttempt;
  checked: boolean;
  correctAnswer: string;
  message: string;
};

type EssayWordStat = {
  index: number;
  word: string;
  correctCount: number;
  attemptCount: number;
};

type EssayWordStatsResponse = {
  questionId: number;
  items: EssayWordStat[];
};

type Student = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type StudentListResponse = {
  items: Student[];
};

const activeStudentStorageKey = "psle-active-student-id";

const subjectTabs: SubjectMeta[] = [
  { key: "english", label: "English", value: "English", aliases: ["English"] },
  { key: "science", label: "Science", value: "Science", aliases: ["Science"] },
  { key: "chinese", label: "华文", value: "Chinese", aliases: ["Chinese"] },
  { key: "math", label: "Mathematics", value: "Mathematics", aliases: ["Mathematics"] }
];

const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

const questionTypeLabels: Record<string, string> = {
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  short_answer: "Short Answer",
  fill_in_blank: "Fill in the Blank",
  true_false: "True / False",
  essay: "Essay",
  english_essay: "English Essay",
  english_comprehension_close: "Comprehension Close",
  english_synthesis: "Synthesis",
  english_common_sentence: "Common Sentences",
  english_word_reminder: "English Word Reminder",
  english_single_choice: "English Single Choice"
};

const essaySpeechRateOptions = [1, 1.25, 1.5] as const;
const essaySpeechVoiceOptions = ["male", "female"] as const;
const practiceMoreTag = "practise more";
type EssaySpeechVoice = (typeof essaySpeechVoiceOptions)[number];

function getSubjectMeta(subject: string) {
  return subjectTabs.find((item) => item.aliases.includes(subject) || item.value === subject) ?? subjectTabs[0];
}

function getInitialSubject() {
  return readSubjectFromLocation();
}

function getInitialQuestionType() {
  return readQuestionTypeFromLocation(readSubjectFromLocation());
}

function getInitialStudentId() {
  return readStudentIdFromLocation();
}

function isGalleryPage() {
  return window.location.pathname === "/gallery";
}

function isViewerPage() {
  return window.location.pathname === "/viewer";
}

function isSettingsPage() {
  return window.location.pathname === "/settings";
}

function buildHomeHref(subject: string, questionType?: string, studentId?: number) {
  const params = new URLSearchParams({ subject });
  params.set("studentId", String(studentId && studentId > 0 ? studentId : 1));
  if (questionType) {
    params.set("questionType", questionType);
  }
  return `/?${params.toString()}`;
}

function buildSettingsHref(studentId?: number) {
  const params = new URLSearchParams();
  params.set("studentId", String(studentId && studentId > 0 ? studentId : 1));
  return `/settings?${params.toString()}`;
}

function readSubjectFromLocation() {
  return getSubjectMeta(new URLSearchParams(window.location.search).get("subject") ?? subjectTabs[0].value).value;
}

function readQuestionTypeFromLocation(subject: string) {
  const questionType = new URLSearchParams(window.location.search).get("questionType") ?? "";
  if (questionType) {
    return questionType;
  }
  return subject === "English" ? "english_word_reminder" : "";
}

function readStudentIdFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("studentId");
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const stored = window.localStorage.getItem(activeStudentStorageKey);
  if (stored) {
    const parsed = Number(stored);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function buildApiUrl(path: string, studentId: number, query?: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  params.set("studentId", String(studentId > 0 ? studentId : 1));
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });
  return `${apiBase}${path}?${params.toString()}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function getQuestionTypeLabel(value: string) {
  return questionTypeLabels[value] ?? value;
}

function isObjectiveQuestionType(value: string) {
  return (
    value === "single_choice" ||
    value === "multiple_choice" ||
    value === "true_false" ||
    value === "english_word_reminder" ||
    value === "english_single_choice"
  );
}

function isEnglishWordReminderQuestion(value: string) {
  return value === "english_word_reminder";
}

function isEnglishSingleChoiceQuestion(value: string) {
  return value === "english_single_choice";
}

function isRichTextQuestionType(value: string) {
  return value === "essay" || value === "english_essay" || value === "english_comprehension_close" || value === "english_common_sentence";
}

function isEnglishEssayQuestion(value: string) {
  return value === "english_essay";
}

function isEnglishComprehensionCloseQuestion(value: string) {
  return value === "english_comprehension_close";
}

function isEnglishSynthesisQuestion(value: string) {
  return value === "english_synthesis";
}

function isEnglishCommonSentenceQuestion(value: string) {
  return value === "english_common_sentence";
}

function isEnglishPassageEditorQuestion(value: string) {
  return isEnglishEssayQuestion(value) || isEnglishComprehensionCloseQuestion(value) || isEnglishSynthesisQuestion(value) || isEnglishCommonSentenceQuestion(value);
}

function isEnglishBlankPassageQuestion(value: string) {
  return isEnglishEssayQuestion(value) || isEnglishComprehensionCloseQuestion(value);
}

function isEnglishBlankCompletionQuestion(value: string) {
  return isEnglishBlankPassageQuestion(value) || isEnglishSynthesisQuestion(value);
}

function isEnglishReadingQuestion(value: string) {
  return isEnglishBlankPassageQuestion(value) || isEnglishCommonSentenceQuestion(value);
}

function getEnglishPassageEntryLabel(value: string) {
  if (isEnglishCommonSentenceQuestion(value)) {
    return "Common Sentences";
  }
  return isEnglishComprehensionCloseQuestion(value) ? "Comprehension Close" : "Essay Library";
}

function getEnglishPassageEditorLabel(value: string) {
  if (isEnglishCommonSentenceQuestion(value)) {
    return "Common Sentence";
  }
  if (isEnglishSynthesisQuestion(value)) {
    return "Synthesis";
  }
  return isEnglishComprehensionCloseQuestion(value) ? "Comprehension Close" : "English Essay";
}

function sanitizeRichHtml(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${trimmed}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLDivElement | null;
  if (!container) {
    return "";
  }

  const safeRoot = doc.createElement("div");
  Array.from(container.childNodes).forEach((node) => {
    const sanitized = sanitizeRichNode(doc, node);
    if (sanitized) {
      safeRoot.appendChild(sanitized);
    }
  });

  return safeRoot.innerHTML.trim();
}

function sanitizeRichNode(doc: Document, node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const allowedTags = new Set([
    "p",
    "div",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "mark",
    "br",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4"
  ]);

  if (!allowedTags.has(tagName)) {
    const fragment = doc.createDocumentFragment();
    Array.from(element.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeRichNode(doc, child);
      if (sanitizedChild) {
        fragment.appendChild(sanitizedChild);
      }
    });
    return fragment;
  }

  const next = doc.createElement(tagName);
  applyAllowedInlineStyles(next, element);
  Array.from(element.childNodes).forEach((child) => {
    const sanitizedChild = sanitizeRichNode(doc, child);
    if (sanitizedChild) {
      next.appendChild(sanitizedChild);
    }
  });
  return next;
}

function applyAllowedInlineStyles(target: HTMLElement, source: HTMLElement) {
  const allowedStyles = ["font-weight", "font-style", "text-decoration", "background-color", "color", "text-align"];
  const nextStyles = allowedStyles
    .map((name) => {
      const value = source.style.getPropertyValue(name).trim();
      return value ? `${name}: ${value}` : "";
    })
    .filter(Boolean)
    .join("; ");

  if (nextStyles) {
    target.setAttribute("style", nextStyles);
  }
}

function htmlToPlainText(raw: string) {
  if (!raw.trim()) {
    return "";
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  return (doc.body.textContent ?? "").trim();
}

function buildEssaySpeechParts(question: Question) {
  const title = question.title.trim();
  const topic = question.topic.trim();
  const content = htmlToPlainText(sanitizeRichHtml(question.stem))
    .replace(/\s+/g, " ")
    .trim();

  return {
    headerText: [title, topic ? `Topic: ${topic}` : ""].filter(Boolean).join(". "),
    contentText: content
  };
}

function buildEssaySpeechText(question: Question) {
  const { headerText, contentText } = buildEssaySpeechParts(question);
  return [headerText, contentText].filter(Boolean).join(". ");
}

function pickEnglishSpeechVoice(voices: SpeechSynthesisVoice[], preferredVoice: EssaySpeechVoice) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (englishVoices.length === 0) {
    return null;
  }

  const femaleHints = [
    "female",
    "woman",
    "girl",
    "samantha",
    "victoria",
    "karen",
    "moira",
    "zira",
    "ava",
    "allison",
    "serena",
    "susan"
  ];
  const maleHints = [
    "male",
    "man",
    "boy",
    "daniel",
    "alex",
    "fred",
    "tom",
    "jorge",
    "aaron",
    "david",
    "google uk english male"
  ];
  const hints = preferredVoice === "female" ? femaleHints : maleHints;
  const voiceText = (voice: SpeechSynthesisVoice) => `${voice.name} ${voice.voiceURI}`.toLowerCase();
  const hasPreferredHint = (voice: SpeechSynthesisVoice) => hints.some((hint) => voiceText(voice).includes(hint));
  const isGoogleOnlineVoice = (voice: SpeechSynthesisVoice) => {
    const text = voiceText(voice);
    return text.includes("google") && text.includes("online");
  };
  const isGoogleVoice = (voice: SpeechSynthesisVoice) => voiceText(voice).includes("google");

  const preferredGoogleOnlineVoice = englishVoices.find((voice) => isGoogleOnlineVoice(voice) && hasPreferredHint(voice)) ?? null;
  if (preferredGoogleOnlineVoice) {
    return preferredGoogleOnlineVoice;
  }

  const googleOnlineVoice = englishVoices.find((voice) => isGoogleOnlineVoice(voice)) ?? null;
  if (googleOnlineVoice) {
    return googleOnlineVoice;
  }

  const preferredGoogleVoice = englishVoices.find((voice) => isGoogleVoice(voice) && hasPreferredHint(voice)) ?? null;
  if (preferredGoogleVoice) {
    return preferredGoogleVoice;
  }

  const preferredVoiceMatch = englishVoices.find((voice) => hasPreferredHint(voice)) ?? null;
  if (preferredVoiceMatch) {
    return preferredVoiceMatch;
  }

  const googleVoice = englishVoices.find((voice) => isGoogleVoice(voice)) ?? null;
  return googleVoice ?? englishVoices[0] ?? null;
}

function buildEnglishEssayExercise(rawHtml: string) {
  const sanitized = sanitizeRichHtml(rawHtml);
  if (!sanitized) {
    return { html: "", answers: [] as string[] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLDivElement | null;
  if (!container) {
    return { html: sanitized, answers: [] as string[] };
  }

  const answers: string[] = [];
  const underlinedNodes = Array.from(container.querySelectorAll("u"));
  underlinedNodes.forEach((node, index) => {
    const value = (node.textContent ?? "").trim();
    if (!value) {
      return;
    }
    answers.push(value);
    const marker = doc.createElement("span");
    marker.className = "essay-mask-token";
    marker.textContent = `（${index + 1}）`;
    node.replaceWith(marker);
  });

  return { html: container.innerHTML, answers };
}

function buildEnglishSynthesisExercise(rawHtml: string) {
  const sanitized = sanitizeRichHtml(rawHtml);
  if (!sanitized) {
    return { html: "", answers: [] as string[] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLDivElement | null;
  if (!container) {
    return { html: sanitized, answers: [] };
  }

  const answers: string[] = [];
  const underlinedNodes = Array.from(container.querySelectorAll("u"));
  underlinedNodes.forEach((node, index) => {
    const value = (node.textContent ?? "").trim();
    if (!value) {
      return;
    }
    answers.push(value);
    const marker = doc.createElement("span");
    marker.className = "synthesis-mask-token";
    marker.textContent = `Blank ${index + 1}`;
    node.replaceWith(marker);
  });

  return {
    html: container.innerHTML,
    answers
  };
}

function extractUnderlinedWords(rawHtml: string) {
  const sanitized = sanitizeRichHtml(rawHtml);
  if (!sanitized) {
    return [] as string[];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLDivElement | null;
  if (!container) {
    return [] as string[];
  }

  return Array.from(container.querySelectorAll("u"))
    .map((node) => (node.textContent ?? "").trim())
    .filter(Boolean);
}

function parseEssayCorrectAnswer(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed.map((value, index) => `${index + 1}. ${String(value ?? "").trim()}`);
    } catch (error) {
      console.error(error);
    }
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEssayAnswerValues(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as string[];
      return parsed.map((value) => String(value ?? "").trim());
    } catch (error) {
      console.error(error);
    }
  }

  return raw
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function normalizeEssayAnswerValue(raw: string) {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMaskedReminderSentence(question: Question) {
  const sentence = (question.exampleSentence || question.stem || "").trim();
  const word = (question.reminderWord || question.answer || "").trim();
  if (!sentence || !word) {
    return question.stem;
  }

  const masked = sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), "（    ）");
  if (masked !== sentence) {
    return masked;
  }

  const lowerSentence = sentence.toLowerCase();
  const lowerWord = word.toLowerCase();
  const index = lowerSentence.indexOf(lowerWord);
  if (index >= 0) {
    return `${sentence.slice(0, index)}（    ）${sentence.slice(index + word.length)}`;
  }

  return `${sentence}\n\nPlease fill in the matching English word.`;
}

function buildReminderHint(word: string) {
  const trimmed = word.trim();
  if (trimmed.length <= 1) {
    return trimmed;
  }
  if (trimmed.length === 2) {
    return `${trimmed[0]}${trimmed[1]}`;
  }
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

function buildMaskedPassageHint(word: string) {
  const trimmed = word.trim();
  if (trimmed.length <= 1) {
    return trimmed;
  }
  if (trimmed.length === 2) {
    return `${trimmed[0]}*`;
  }
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

function getChoiceOptionKey(option: string) {
  const trimmed = option.trim();
  const matched = trimmed.match(/^([A-Za-z])(?:[\.\)、:：\-\s]|$)/);
  if (matched) {
    return matched[1].toUpperCase();
  }
  return trimmed;
}

function resolveChoiceAnswerLabel(question: Question, answer: string) {
  const normalized = getChoiceOptionKey(answer);
  const matched = (question.optionItems ?? []).find((item) => getChoiceOptionKey(item) === normalized);
  return matched || answer || "-";
}

function getImportPlaceholder(subject: string) {
  if (subject === "English") {
    return `[
  {
    "questionType": "english_word_reminder",
    "topic": "food adjectives",
    "word": "delicious",
    "exampleSentence": "The cake tastes delicious after baking.",
    "childAnswer": "delicious"
  },
  {
    "questionType": "english_single_choice",
    "topic": "grammar",
    "problemDescription": "Choose the correct word to complete the sentence: She _____ to school by bus every day.",
    "optionItems": [
      "A. go",
      "B. goes",
      "C. going",
      "D. gone"
    ],
    "answer": "B",
    "childAnswer": ""
  },
  {
    "questionType": "english_comprehension_close",
    "topic": "halloween story",
    "problemDescription": "<p>The old house looked <u>silent</u> at night, but a strange light was still shining through the broken window.</p>",
    "answer": "[\"silent\"]",
    "childAnswer": ""
  },
  {
    "questionType": "english_synthesis",
    "topic": "reported speech",
    "exampleSentence": "The teacher said, \"You must finish the work today.\"",
    "problemDescription": "<p>The teacher said that they <u>had</u> to finish the work that day.</p>",
    "childAnswer": ""
  },
  {
    "questionType": "english_common_sentence",
    "topic": "descriptive writing",
    "problemDescription": "<p>The golden light of sunset spilled across the quiet lake, turning every ripple into a line of fire.</p>",
    "childAnswer": ""
  }
]`;
  }

  return `[
  {
    "questionType": "single_choice",
    "topic": "addition",
    "problemDescription": "Calculate the result of 12 + 18.",
    "answer": "30",
    "childAnswer": "28"
  }
]`;
}

function getImportStatusHint(subjectLabel: string) {
  return `Paste ${subjectLabel} JSON here to validate before importing. The examples use English field names by default. If \`subject\` is missing, the current page subject will be used automatically. Chinese field names are still supported.`;
}

export default function App() {
  const galleryMode = isGalleryPage();
  const viewerMode = isViewerPage();
  const settingsMode = isSettingsPage();

  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState(getInitialStudentId);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentCreating, setStudentCreating] = useState(false);
  const [studentMenuOpen, setStudentMenuOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState(getInitialSubject);
  const [items, setItems] = useState<Question[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [activeQuestionType, setActiveQuestionType] = useState(getInitialQuestionType);
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Loading question bank...");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [savedPromptTemplate, setSavedPromptTemplate] = useState<string | null>(null);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptStatus, setPromptStatus] = useState("Loading prompt settings...");
  const [importPayload, setImportPayload] = useState("");
  const [importStatus, setImportStatus] = useState(getImportStatusHint(getSubjectMeta(getInitialSubject()).label));
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState<Question | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [essayBlankAnswers, setEssayBlankAnswers] = useState<string[]>([]);
  const [essayBlankHintVisible, setEssayBlankHintVisible] = useState<boolean[]>([]);
  const [practiceSubmitting, setPracticeSubmitting] = useState(false);
  const [practiceResult, setPracticeResult] = useState<SubmitAttemptResponse | null>(null);
  const [practiceHintVisible, setPracticeHintVisible] = useState(false);
  const [practiceAnswerVisible, setPracticeAnswerVisible] = useState(false);
  const [practiceEssayReading, setPracticeEssayReading] = useState(false);
  const [practiceEssayRate, setPracticeEssayRate] = useState<number>(1);
  const [practiceEssayVoice, setPracticeEssayVoice] = useState<EssaySpeechVoice>("male");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [essayListSpeechMenuOpen, setEssayListSpeechMenuOpen] = useState(false);
  const [practiceSpeechMenuOpen, setPracticeSpeechMenuOpen] = useState(false);
  const [essayListReading, setEssayListReading] = useState(false);
  const [essayListReadingQuestionId, setEssayListReadingQuestionId] = useState<number | null>(null);
  const [practiceWordStatsVisible, setPracticeWordStatsVisible] = useState(false);
  const [practiceWordStatsLoading, setPracticeWordStatsLoading] = useState(false);
  const [practiceWordStats, setPracticeWordStats] = useState<EssayWordStat[]>([]);
  const [essayModalOpen, setEssayModalOpen] = useState(false);
  const [editingEssayQuestion, setEditingEssayQuestion] = useState<Question | null>(null);
  const [essayEditorQuestionType, setEssayEditorQuestionType] = useState("english_essay");
  const [essayTitle, setEssayTitle] = useState("");
  const [essayTopic, setEssayTopic] = useState("");
  const [essaySourceSentence, setEssaySourceSentence] = useState("");
  const [essaySelectedWords, setEssaySelectedWords] = useState<string[]>([]);
  const [essayStatus, setEssayStatus] = useState(
    'Paste the passage on the left, select words, then click "Underline Selected Text" to create blanks. The answer list on the right updates automatically.'
  );
  const [essaySaving, setEssaySaving] = useState(false);
  const [tagQuestion, setTagQuestion] = useState<Question | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [practiceTagSaving, setPracticeTagSaving] = useState(false);

  const essayListSpeechMenuRef = useRef<HTMLDivElement | null>(null);
  const practiceSpeechMenuRef = useRef<HTMLDivElement | null>(null);
  const essayStemRef = useRef<HTMLDivElement | null>(null);
  const essaySelectionRangeRef = useRef<Range | null>(null);
  const practiceEssayUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const essayListSpeechTimerRef = useRef<number | null>(null);
  const studentMenuCloseTimerRef = useRef<number | null>(null);
  const speechRestartTimerRef = useRef<number | null>(null);

  const activeSubjectMeta = useMemo(
    () => subjectTabs.find((item) => item.value === activeSubject) ?? subjectTabs[0],
    [activeSubject]
  );

  const activeStudent = useMemo(
    () => students.find((item) => item.id === activeStudentId) ?? null,
    [activeStudentId, students]
  );

  const subjectItems = useMemo(
    () => items.filter((item) => activeSubjectMeta.aliases.includes(item.subject)),
    [activeSubjectMeta.aliases, items]
  );

  const subjectQuestionTypes = useMemo(() => {
    const values = Array.from(new Set(subjectItems.map((item) => item.questionType).filter(Boolean)));
    return values.sort((a, b) => getQuestionTypeLabel(a).localeCompare(getQuestionTypeLabel(b), "zh-CN"));
  }, [subjectItems]);

  const englishQuestionTypes = useMemo(
    () => ["english_word_reminder", "english_single_choice", "english_synthesis", "english_common_sentence", "english_essay", "english_comprehension_close"],
    []
  );

  const subjectTags = useMemo(() => {
    const values = Array.from(new Set(subjectItems.flatMap((item) => item.tags ?? []).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [subjectItems]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return subjectItems.filter((item) => {
      const statusMatched = status ? item.status === status : true;
      const typeMatched = activeQuestionType ? item.questionType === activeQuestionType : true;
      const tagMatched = activeTag ? item.tags?.includes(activeTag) : true;
      const keywordMatched = normalizedKeyword
        ? [item.code, item.title, item.stem, item.topic, ...(item.tags ?? [])].some((field) => field.toLowerCase().includes(normalizedKeyword))
        : true;
      return statusMatched && typeMatched && tagMatched && keywordMatched;
    });
  }, [activeQuestionType, activeTag, keyword, status, subjectItems]);

  const practiceQuestionIndex = useMemo(() => {
    if (!practiceQuestion) {
      return -1;
    }
    return filteredItems.findIndex((item) => item.id === practiceQuestion.id);
  }, [filteredItems, practiceQuestion]);

  const previousPracticeQuestion = practiceQuestionIndex > 0 ? filteredItems[practiceQuestionIndex - 1] : null;
  const nextPracticeQuestion =
    practiceQuestionIndex >= 0 && practiceQuestionIndex < filteredItems.length - 1 ? filteredItems[practiceQuestionIndex + 1] : null;
  const wordReminderPassed = Boolean(
    practiceQuestion && isEnglishWordReminderQuestion(practiceQuestion.questionType) && practiceResult?.attempt.isCorrect === true
  );

  const essayExercise = useMemo(() => {
    if (!practiceQuestion || !isEnglishBlankPassageQuestion(practiceQuestion.questionType)) {
      return { html: "", answers: [] as string[] };
    }
    return buildEnglishEssayExercise(practiceQuestion.stem);
  }, [practiceQuestion]);

  const synthesisExercise = useMemo(() => {
    if (!practiceQuestion || !isEnglishSynthesisQuestion(practiceQuestion.questionType)) {
      return { html: "", answers: [] as string[] };
    }
    return buildEnglishSynthesisExercise(practiceQuestion.stem);
  }, [practiceQuestion]);

  const essayListItems = useMemo(
    () => filteredItems.filter((item) => isEnglishReadingQuestion(item.questionType)),
    [filteredItems]
  );

  const showWordColumns = useMemo(() => {
    if (activeSubject !== "English") {
      return true;
    }
    return activeQuestionType === "" || activeQuestionType === "english_word_reminder";
  }, [activeQuestionType, activeSubject]);

  useEffect(() => {
    window.localStorage.setItem(activeStudentStorageKey, String(activeStudentId));
  }, [activeStudentId]);

  useEffect(() => {
    if (!galleryMode && !viewerMode) {
      return;
    }
    window.location.replace(buildHomeHref(activeSubject, activeSubject === "English" ? "english_word_reminder" : "", activeStudentId));
  }, [activeStudent, activeStudentId, activeSubject, galleryMode, viewerMode]);

  useEffect(() => {
    async function loadStudents() {
      setStudentLoading(true);
      try {
        const response = await fetch(`${apiBase}/students`);
        if (!response.ok) throw new Error("load students failed");
        const data: StudentListResponse = await response.json();
        const nextStudents = data.items ?? [];
        setStudents(nextStudents);
        if (nextStudents.length > 0 && !nextStudents.some((item) => item.id === activeStudentId)) {
          setActiveStudentId(nextStudents[0].id);
        }
      } catch (error) {
        console.error(error);
        setMessage("Failed to load students. Please check whether the backend service is running.");
      } finally {
        setStudentLoading(false);
      }
    }

    void loadStudents();
  }, [activeStudentId]);

  useEffect(() => {
    setActiveQuestionType((current) => {
      if (activeSubject === "English") {
        if (current && englishQuestionTypes.includes(current)) {
          return current;
        }
        return "english_word_reminder";
      }
      return current && !subjectQuestionTypes.includes(current) ? "" : current;
    });
  }, [activeSubject, englishQuestionTypes, subjectQuestionTypes]);

  useEffect(() => {
    setActiveTag((current) => (current && !subjectTags.includes(current) ? "" : current));
  }, [subjectTags]);

  useEffect(() => {
    if (settingsMode) {
      return;
    }

    setImportModalOpen(false);
    setEssayModalOpen(false);
    setImportPayload("");
    setImportPreview([]);
    setImportErrors([]);
    setImportStatus(getImportStatusHint(activeSubjectMeta.label));
  }, [activeSubjectMeta.label, settingsMode]);

  useEffect(() => {
    if (!importModalOpen && !practiceQuestion && !tagQuestion && !essayModalOpen) {
      return;
    }

    function handleModalKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setImportModalOpen(false);
        setEssayModalOpen(false);
        setPracticeQuestion(null);
        setPracticeResult(null);
        setTagQuestion(null);
      }
    }

    document.addEventListener("keydown", handleModalKeydown);
    return () => document.removeEventListener("keydown", handleModalKeydown);
  }, [essayModalOpen, importModalOpen, practiceQuestion, tagQuestion]);

  useEffect(() => {
    if (!practiceQuestion || importModalOpen || essayModalOpen || tagQuestion) {
      return;
    }
    const activePracticeQuestion = practiceQuestion;

    function handlePracticeShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (event.key === "Enter") {
        if (isEnglishCommonSentenceQuestion(activePracticeQuestion.questionType) || target?.closest("button, a, select")) {
          return;
        }
        event.preventDefault();
        void submitPracticeAnswer();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigatePracticeQuestion("previous");
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigatePracticeQuestion("next");
      }
    }

    document.addEventListener("keydown", handlePracticeShortcut);
    return () => document.removeEventListener("keydown", handlePracticeShortcut);
  }, [essayModalOpen, importModalOpen, practiceQuestion, tagQuestion, practiceAnswer, essayBlankAnswers, practiceSubmitting, wordReminderPassed]);

  useEffect(() => {
    if (!essayModalOpen || !essayStemRef.current) {
      return;
    }

    essayStemRef.current.innerHTML = editingEssayQuestion ? sanitizeRichHtml(editingEssayQuestion.stem) : "";
    setEssaySelectedWords(editingEssayQuestion ? extractUnderlinedWords(editingEssayQuestion.stem) : []);
  }, [editingEssayQuestion, essayModalOpen]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      const nextVoices = synth.getVoices();
      if (nextVoices.length > 0) {
        setSpeechVoices(nextVoices);
      }
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);
    return () => synth.removeEventListener("voiceschanged", updateVoices);
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (studentMenuCloseTimerRef.current !== null) {
        window.clearTimeout(studentMenuCloseTimerRef.current);
        studentMenuCloseTimerRef.current = null;
      }
      if (essayListSpeechTimerRef.current !== null) {
        window.clearTimeout(essayListSpeechTimerRef.current);
        essayListSpeechTimerRef.current = null;
      }
      if (speechRestartTimerRef.current !== null) {
        window.clearTimeout(speechRestartTimerRef.current);
        speechRestartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (settingsMode) {
      return;
    }

    function handlePopState() {
      setActiveStudentId(readStudentIdFromLocation());
      const nextSubject = readSubjectFromLocation();
      setActiveSubject(nextSubject);
      setActiveQuestionType(readQuestionTypeFromLocation(nextSubject));
      setActiveTag("");
      setEssayModalOpen(false);
      setImportModalOpen(false);
      setPracticeQuestion(null);
      setPracticeResult(null);
      setTagQuestion(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [settingsMode]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (essayListSpeechMenuRef.current && !essayListSpeechMenuRef.current.contains(target)) {
        setEssayListSpeechMenuOpen(false);
      }
      if (practiceSpeechMenuRef.current && !practiceSpeechMenuRef.current.contains(target)) {
        setPracticeSpeechMenuOpen(false);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      if (settingsMode) {
        return;
      }

      setLoading(true);
      setMessage("Syncing question list...");
      try {
        const response = await fetch(buildApiUrl("/questions", activeStudentId));
        if (!response.ok) throw new Error("load failed");
        const data = await response.json();
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        setMessage("Failed to load questions. Please check whether the backend service is running.");
      } finally {
        setLoading(false);
      }
    }

    void loadQuestions();
  }, [activeStudentId, settingsMode]);

  useEffect(() => {
    async function loadPromptSettings() {
      if (!settingsMode) {
        return;
      }

      setPromptLoading(true);
      setPromptStatus("Loading prompt settings...");

      try {
        const response = await fetch(buildApiUrl("/settings/prompt", activeStudentId));
        if (!response.ok) throw new Error("load prompt settings failed");

        const data: PromptSettingsResponse = await response.json();
        const nextValue = data.promptTemplate ?? "";
        setPromptTemplate(nextValue);
        setSavedPromptTemplate(nextValue);
        setPromptUpdatedAt(data.updatedAt ?? null);
        setPromptStatus(nextValue ? "Prompt settings loaded from database." : "No prompt settings saved yet. Changes will be auto-saved.");
      } catch (error) {
        console.error(error);
        setPromptStatus("Failed to load prompt settings. Please check the backend service.");
      } finally {
        setPromptLoading(false);
      }
    }

    void loadPromptSettings();
  }, [activeStudentId, settingsMode]);

  useEffect(() => {
    if (!settingsMode || savedPromptTemplate === null || promptTemplate === savedPromptTemplate) {
      return;
    }

    setPromptStatus("Auto-saving prompt settings...");

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(buildApiUrl("/settings/prompt", activeStudentId), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ promptTemplate })
          });
          if (!response.ok) throw new Error("save prompt settings failed");

          const data: PromptSettingsResponse = await response.json();
          const nextValue = data.promptTemplate ?? "";
          setSavedPromptTemplate(nextValue);
          setPromptTemplate(nextValue);
          setPromptUpdatedAt(data.updatedAt ?? null);
          setPromptStatus("Prompt settings were auto-saved to the database.");
        } catch (error) {
          console.error(error);
          setPromptStatus("Failed to save prompt settings. Please try again later.");
        }
      })();
    }, 600);

    return () => window.clearTimeout(timer);
  }, [activeStudentId, promptTemplate, savedPromptTemplate, settingsMode]);

  useEffect(() => {
    if (settingsMode) {
      setMessage(promptLoading ? "Loading system settings..." : promptStatus);
      return;
    }
    setMessage(`${filteredItems.length} question(s) in ${activeSubjectMeta.label}`);
  }, [activeSubjectMeta.label, filteredItems.length, promptLoading, promptStatus, settingsMode]);

  function switchSubject(subject: string) {
    stopEssayListReading();
    stopPracticeEssayReading();
    const nextSubject = getSubjectMeta(subject).value;
    const nextQuestionType = nextSubject === "English" ? "english_word_reminder" : "";
    if (settingsMode) {
      window.location.href = buildHomeHref(nextSubject, nextQuestionType, activeStudentId);
      return;
    }
    window.history.pushState({}, "", buildHomeHref(nextSubject, nextQuestionType, activeStudentId));
    setActiveSubject(nextSubject);
    setActiveQuestionType(nextQuestionType);
    setActiveTag("");
    setEssayModalOpen(false);
    setImportModalOpen(false);
    setPracticeQuestion(null);
    setPracticeResult(null);
    setTagQuestion(null);
    setMessage(`Switched to ${getSubjectMeta(nextSubject).label}.`);
  }

  function switchQuestionType(questionType: string) {
    stopEssayListReading();
    stopPracticeEssayReading();
    window.history.pushState({}, "", buildHomeHref(activeSubject, questionType, activeStudentId));
    setActiveQuestionType(questionType);
  }

  function openStudentMenu() {
    if (studentMenuCloseTimerRef.current !== null) {
      window.clearTimeout(studentMenuCloseTimerRef.current);
      studentMenuCloseTimerRef.current = null;
    }
    setStudentMenuOpen(true);
  }

  function closeStudentMenuWithDelay() {
    if (studentMenuCloseTimerRef.current !== null) {
      window.clearTimeout(studentMenuCloseTimerRef.current);
    }
    studentMenuCloseTimerRef.current = window.setTimeout(() => {
      setStudentMenuOpen(false);
      studentMenuCloseTimerRef.current = null;
    }, 220);
  }

  function switchStudent(studentId: number) {
    if (!studentId || studentId === activeStudentId) {
      setStudentMenuOpen(false);
      return;
    }

    stopEssayListReading();
    stopPracticeEssayReading();
    setActiveStudentId(studentId);
    setEssayModalOpen(false);
    setImportModalOpen(false);
    setPracticeQuestion(null);
    setPracticeResult(null);
    setTagQuestion(null);

    const params = new URLSearchParams(window.location.search);
    params.set("studentId", String(studentId));
    if (!params.get("subject")) {
      params.set("subject", activeSubject);
    }
    const nextSearch = params.toString();
    window.history.pushState({}, "", `${window.location.pathname}?${nextSearch}`);
    setStudentMenuOpen(false);
    setMessage(`Switched to ${students.find((item) => item.id === studentId)?.name ?? `Student ${studentId}`}.`);
  }

  async function createStudent() {
    const name = window.prompt("Enter a student name");
    if (!name || !name.trim()) {
      return;
    }

    setStudentCreating(true);
    try {
      const response = await fetch(`${apiBase}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: name.trim() })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to create the student.");
      }
      const created: Student = await response.json();
      setStudents((current) => [...current, created].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id));
      setStudentMenuOpen(false);
      switchStudent(created.id);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Failed to create the student. Please try again later.");
    } finally {
      setStudentCreating(false);
    }
  }

  function openImportModal() {
    setImportModalOpen(true);
    setImportStatus(getImportStatusHint(activeSubjectMeta.label));
  }

  function closeImportModal() {
    setImportModalOpen(false);
  }

  function fillImportExample() {
    setImportPayload(getImportPlaceholder(activeSubject));
    setImportErrors([]);
    setImportPreview([]);
    setImportStatus(`${activeSubjectMeta.label} sample JSON has been filled in. You can validate it before importing.`);
  }

  function openSpeechMenu(menu: "list" | "practice") {
    if (menu === "list") {
      setEssayListSpeechMenuOpen(true);
      setPracticeSpeechMenuOpen(false);
      return;
    }
    setPracticeSpeechMenuOpen(true);
    setEssayListSpeechMenuOpen(false);
  }

  function toggleSpeechMenu(menu: "list" | "practice") {
    if (menu === "list") {
      setEssayListSpeechMenuOpen((current) => !current);
      setPracticeSpeechMenuOpen(false);
      return;
    }
    setPracticeSpeechMenuOpen((current) => !current);
    setEssayListSpeechMenuOpen(false);
  }

  function openEssayModal(question?: Question, nextQuestionType?: string) {
    stopEssayListReading();
    const modalQuestionType = nextQuestionType ?? question?.questionType ?? activeQuestionType ?? "english_essay";
    const editorLabel = getEnglishPassageEditorLabel(modalQuestionType);
    const isCommonSentence = isEnglishCommonSentenceQuestion(modalQuestionType);
    const isSynthesis = isEnglishSynthesisQuestion(modalQuestionType);
    setEssayModalOpen(true);
    setEditingEssayQuestion(question ?? null);
    setEssayEditorQuestionType(modalQuestionType);
    setEssayTitle(question?.title ?? "");
    setEssayTopic(question?.topic ?? "");
    setEssaySourceSentence(question?.exampleSentence ?? "");
    setEssaySelectedWords(isCommonSentence ? [] : question ? extractUnderlinedWords(question.stem) : []);
    setEssayStatus(
      isCommonSentence
        ? question
          ? `You can continue editing this ${editorLabel} and save to overwrite the current item.`
          : `Paste the ${editorLabel} content on the left, then save it into the question bank.`
        : isSynthesis
          ? question
            ? `You can update the original sentence, adjust the underlined parts in the target sentence, and save the Synthesis item.`
            : `Enter the original sentence first, then paste the transformed sentence and underline the parts students need to complete.`
        : question
          ? `You can keep editing this ${editorLabel}, add or remove underlined words, and save to overwrite the current question.`
          : `Paste the ${editorLabel} on the left, select words, then click "Underline Selected Text". The answer list on the right will update automatically.`
    );
    if (essayStemRef.current) {
      essayStemRef.current.innerHTML = question ? sanitizeRichHtml(question.stem) : "";
    }
    essaySelectionRangeRef.current = null;
  }

  function closeEssayModal() {
    setEssayModalOpen(false);
    setEditingEssayQuestion(null);
    setEssayEditorQuestionType("english_essay");
    setEssayTitle("");
    setEssayTopic("");
    setEssaySourceSentence("");
    setEssaySelectedWords([]);
    setEssayStatus('Paste the passage on the left, select words, then click "Underline Selected Text" to create blanks. The answer list on the right updates automatically.');
    if (essayStemRef.current) {
      essayStemRef.current.innerHTML = "";
    }
    essaySelectionRangeRef.current = null;
  }

  function syncEssaySelectedWordsFromEditor() {
    if (isEnglishCommonSentenceQuestion(essayEditorQuestionType)) {
      return;
    }
    const html = essayStemRef.current?.innerHTML ?? "";
    setEssaySelectedWords(extractUnderlinedWords(html));
  }

  function rememberEssaySelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !essayStemRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (essayStemRef.current.contains(container)) {
      essaySelectionRangeRef.current = range.cloneRange();
    }
  }

  function addUnderlineQuestionWord() {
    if (!essayStemRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      setEssayStatus("Please select the word(s) to turn into blanks in the left editor first.");
      return;
    }

    if (essaySelectionRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(essaySelectionRangeRef.current);
    }

    if (selection.rangeCount === 0 || selection.isCollapsed) {
      setEssayStatus("Please select the word(s) to turn into blanks in the left editor first.");
      return;
    }

    document.execCommand("underline");
    essayStemRef.current.innerHTML = sanitizeRichHtml(essayStemRef.current.innerHTML);
    syncEssaySelectedWordsFromEditor();
    essaySelectionRangeRef.current = null;
    setEssayStatus("Selected text has been added to the question. Underlined words will be blanked out during practice.");
  }

  function removeEssaySelectedWord(index: number) {
    if (!essayStemRef.current) {
      return;
    }

    const sanitized = sanitizeRichHtml(essayStemRef.current.innerHTML);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
    const container = doc.body.firstElementChild as HTMLDivElement | null;
    if (!container) {
      return;
    }

    const target = container.querySelectorAll("u")[index];
    if (!target) {
      return;
    }
    target.replaceWith(doc.createTextNode(target.textContent ?? ""));
    essayStemRef.current.innerHTML = sanitizeRichHtml(container.innerHTML);
    syncEssaySelectedWordsFromEditor();
    setEssayStatus("Removed one blank target word.");
  }

  function updateEssaySelectedWord(index: number, value: string) {
    if (!essayStemRef.current) {
      return;
    }

    const sanitized = sanitizeRichHtml(essayStemRef.current.innerHTML);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
    const container = doc.body.firstElementChild as HTMLDivElement | null;
    if (!container) {
      return;
    }

    const target = container.querySelectorAll("u")[index];
    if (!target) {
      return;
    }
    target.textContent = value;
    essayStemRef.current.innerHTML = sanitizeRichHtml(container.innerHTML);
    syncEssaySelectedWordsFromEditor();
  }

  function openPracticeModal(question: Question) {
    stopEssayListReading();
    resetPracticeState(question);
  }

  function closePracticeModal() {
    resetPracticeState(null);
  }

  function navigatePracticeQuestion(direction: "previous" | "next") {
    if (practiceSubmitting || (practiceQuestion && isEnglishWordReminderQuestion(practiceQuestion.questionType) && !wordReminderPassed)) {
      return;
    }
    const target = direction === "previous" ? previousPracticeQuestion : nextPracticeQuestion;
    if (!target) {
      return;
    }
    resetPracticeState(target);
  }

  function resetPracticeState(nextQuestion: Question | null) {
    stopPracticeEssayReading();
    setPracticeQuestion(nextQuestion);
    setPracticeAnswer("");
    setEssayBlankAnswers([]);
    setEssayBlankHintVisible([]);
    setPracticeResult(null);
    setPracticeHintVisible(false);
    setPracticeAnswerVisible(false);
    setPracticeEssayReading(false);
    setPracticeWordStatsVisible(false);
    setPracticeWordStats([]);
  }

  function stopPracticeEssayReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = null;
    }
    practiceEssayUtteranceRef.current = null;
    setPracticeEssayReading(false);
  }

  function stopEssayListReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (essayListSpeechTimerRef.current !== null) {
      window.clearTimeout(essayListSpeechTimerRef.current);
      essayListSpeechTimerRef.current = null;
    }
    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = null;
    }
    setEssayListReading(false);
    setEssayListReadingQuestionId(null);
  }

  function restartSpeechAfterCancel(start: () => void) {
    if (!("speechSynthesis" in window)) {
      start();
      return;
    }

    window.speechSynthesis.cancel();
    if (speechRestartTimerRef.current !== null) {
      window.clearTimeout(speechRestartTimerRef.current);
    }
    speechRestartTimerRef.current = window.setTimeout(() => {
      speechRestartTimerRef.current = null;
      start();
    }, 80);
  }

  function speakEssayListItem(questions: Question[], index: number, rate: number, voicePreference: EssaySpeechVoice) {
    if (!("speechSynthesis" in window)) {
      setMessage("This browser does not support passage read-aloud.");
      stopEssayListReading();
      return;
    }

    if (index >= questions.length) {
      stopEssayListReading();
      setMessage("Continuous reading has finished.");
      return;
    }

    const question = questions[index];
    const { headerText, contentText } = buildEssaySpeechParts(question);
    const availableVoices = speechVoices.length > 0 ? speechVoices : window.speechSynthesis.getVoices();
    const voice = pickEnglishSpeechVoice(availableVoices, voicePreference);

    setEssayListReading(true);
    setEssayListReadingQuestionId(question.id);
    setMessage(`Reading passage ${index + 1} of ${questions.length}...`);

    const playContent = () => {
      if (!contentText) {
        essayListSpeechTimerRef.current = window.setTimeout(() => {
          speakEssayListItem(questions, index + 1, rate, voicePreference);
        }, 1000);
        return;
      }

      const contentUtterance = new SpeechSynthesisUtterance(contentText);
      contentUtterance.lang = "en-US";
      contentUtterance.rate = rate;
      contentUtterance.pitch = 1;
      if (voice) {
        contentUtterance.voice = voice;
      }
      contentUtterance.onend = () => {
        essayListSpeechTimerRef.current = window.setTimeout(() => {
          speakEssayListItem(questions, index + 1, rate, voicePreference);
        }, 1000);
      };
      contentUtterance.onerror = () => {
        stopEssayListReading();
        setMessage("Continuous reading failed. Please try again later.");
      };
      window.speechSynthesis.speak(contentUtterance);
    };

    if (!headerText) {
      playContent();
      return;
    }

    const headerUtterance = new SpeechSynthesisUtterance(headerText);
    headerUtterance.lang = "en-US";
    headerUtterance.rate = rate;
    headerUtterance.pitch = 1;
    if (voice) {
      headerUtterance.voice = voice;
    }
    headerUtterance.onend = () => {
      essayListSpeechTimerRef.current = window.setTimeout(() => {
        playContent();
      }, 500);
    };
    headerUtterance.onerror = () => {
      stopEssayListReading();
      setMessage("Continuous reading failed. Please try again later.");
    };
    window.speechSynthesis.speak(headerUtterance);
  }

  function toggleEssayListReading() {
    if (essayListReading) {
      stopEssayListReading();
      setMessage("Continuous reading stopped.");
      return;
    }

    if (essayListItems.length === 0) {
      setMessage("There is no readable content in the current list.");
      return;
    }

    stopPracticeEssayReading();
    stopEssayListReading();
    restartSpeechAfterCancel(() => {
      speakEssayListItem(essayListItems, 0, practiceEssayRate, practiceEssayVoice);
    });
  }

  function startEssayListReadingFrom(questionId: number) {
    const startIndex = essayListItems.findIndex((item) => item.id === questionId);
    if (startIndex < 0) {
      setMessage("Could not find this passage to start reading from here.");
      return;
    }

    stopPracticeEssayReading();
    stopEssayListReading();
    restartSpeechAfterCancel(() => {
      speakEssayListItem(essayListItems, startIndex, practiceEssayRate, practiceEssayVoice);
    });
  }

  function startPracticeEssayReading(rate: number) {
    if (!practiceQuestion || !isEnglishReadingQuestion(practiceQuestion.questionType)) {
      return;
    }

    if (!("speechSynthesis" in window)) {
      setMessage("This browser does not support read-aloud.");
      return;
    }

    const speechText = buildEssaySpeechText(practiceQuestion);
    if (!speechText) {
      setMessage("There is no readable content for this question yet.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;

    const availableVoices = speechVoices.length > 0 ? speechVoices : window.speechSynthesis.getVoices();
    const voice = pickEnglishSpeechVoice(availableVoices, practiceEssayVoice);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      practiceEssayUtteranceRef.current = null;
      setPracticeEssayReading(false);
    };
    utterance.onerror = () => {
      practiceEssayUtteranceRef.current = null;
      setPracticeEssayReading(false);
      setMessage("Read-aloud failed. Please try again later.");
    };

    practiceEssayUtteranceRef.current = utterance;
    setPracticeEssayReading(true);
    setMessage(`Reading at ${rate}x speed...`);
    restartSpeechAfterCancel(() => {
      window.speechSynthesis.speak(utterance);
    });
  }

  function togglePracticeEssayReading() {
    if (practiceEssayReading) {
      stopPracticeEssayReading();
      setMessage("Reading stopped.");
      return;
    }

    startPracticeEssayReading(practiceEssayRate);
  }

  function updatePracticeEssayRate(nextRate: number) {
    setPracticeEssayRate(nextRate);
    if (practiceEssayReading) {
      stopPracticeEssayReading();
      startPracticeEssayReading(nextRate);
      return;
    }
    if (essayListReading) {
      const nextIndex = essayListReadingQuestionId ? essayListItems.findIndex((item) => item.id === essayListReadingQuestionId) : 0;
      stopEssayListReading();
      speakEssayListItem(essayListItems, nextIndex >= 0 ? nextIndex : 0, nextRate, practiceEssayVoice);
      return;
    }
    setMessage(`Reading speed changed to ${nextRate}x.`);
  }

  function toggleEssayBlankHint(index: number) {
    if (!practiceQuestion || !isEnglishBlankPassageQuestion(practiceQuestion.questionType)) {
      return;
    }

    const answers = parseEssayAnswerValues(practiceQuestion.answer);
    const answer = answers[index] ?? "";
    if (!answer) {
      return;
    }

    setEssayBlankHintVisible((current) => {
      const next = [...current];
      next[index] = !current[index];
      return next;
    });
  }

  function updatePracticeEssayVoice(nextVoice: EssaySpeechVoice) {
    setPracticeEssayVoice(nextVoice);

    if (practiceEssayReading) {
      stopPracticeEssayReading();
      startPracticeEssayReading(practiceEssayRate);
      return;
    }

    if (essayListReading) {
      const nextIndex = essayListReadingQuestionId ? essayListItems.findIndex((item) => item.id === essayListReadingQuestionId) : 0;
      stopEssayListReading();
      speakEssayListItem(essayListItems, nextIndex >= 0 ? nextIndex : 0, practiceEssayRate, nextVoice);
      return;
    }

    setMessage(`Reading voice changed to ${nextVoice === "male" ? "male" : "female"}.`);
  }

  function openTagModal(question: Question) {
    setTagQuestion(question);
    setTagDraft((question.tags ?? []).join(", "));
  }

  function closeTagModal() {
    setTagQuestion(null);
    setTagDraft("");
  }

  function replaceQuestion(nextQuestion: Question) {
    setItems((current) => current.map((item) => (item.id === nextQuestion.id ? nextQuestion : item)));
  }

  function syncUpdatedQuestion(nextQuestion: Question) {
    replaceQuestion(nextQuestion);
    setPracticeQuestion((current) => (current?.id === nextQuestion.id ? nextQuestion : current));
    setTagQuestion((current) => (current?.id === nextQuestion.id ? nextQuestion : current));
  }

  async function removeQuestion(id: number) {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      const response = await fetch(buildApiUrl(`/questions/${id}`, activeStudentId), { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Question deleted.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to delete the question. Please try again later.");
    }
  }

  async function reloadQuestions() {
    const response = await fetch(buildApiUrl("/questions", activeStudentId));
    if (!response.ok) throw new Error("load failed");
    const data = await response.json();
    setItems(data.items ?? []);
  }

  async function submitPracticeAnswer() {
    if (!practiceQuestion) {
      return;
    }

    const answerText = isEnglishBlankCompletionQuestion(practiceQuestion.questionType)
      ? JSON.stringify(essayBlankAnswers.map((item) => item.trim()))
      : practiceAnswer;

    if (isEnglishBlankCompletionQuestion(practiceQuestion.questionType)) {
      const expectedAnswers = isEnglishBlankPassageQuestion(practiceQuestion.questionType) ? essayExercise.answers : synthesisExercise.answers;
      if (expectedAnswers.length === 0) {
        setMessage("This question does not have any configured blank words yet.");
        return;
      }
      const filledCount = essayBlankAnswers.filter((item) => item.trim()).length;
      if (filledCount !== expectedAnswers.length) {
        setMessage("Please complete all blank fields first.");
        return;
      }
    } else if (!practiceAnswer.trim()) {
      return;
    }

    setPracticeSubmitting(true);
    try {
      const response = await fetch(buildApiUrl(`/questions/${practiceQuestion.id}/attempts`, activeStudentId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ answerText })
      });
      if (!response.ok) throw new Error("submit attempt failed");

      const data: SubmitAttemptResponse = await response.json();
      replaceQuestion(data.question);
      setPracticeResult(data);
      setPracticeQuestion(data.question);
      if (isEnglishBlankCompletionQuestion(practiceQuestion.questionType)) {
        setPracticeAnswer("");
      } else {
        setPracticeAnswer("");
        setEssayBlankAnswers([]);
      }
      setPracticeWordStats([]);
      setPracticeWordStatsVisible(false);
      setMessage(data.message);
    } catch (error) {
      console.error(error);
      setMessage("Failed to submit the answer. Please try again later.");
    } finally {
      setPracticeSubmitting(false);
    }
  }

  async function togglePracticeWordStats() {
    if (!practiceQuestion || !isEnglishBlankPassageQuestion(practiceQuestion.questionType)) {
      return;
    }

    if (practiceWordStatsVisible) {
      setPracticeWordStatsVisible(false);
      return;
    }

    if (practiceWordStats.length > 0) {
      setPracticeWordStatsVisible(true);
      return;
    }

    setPracticeWordStatsLoading(true);
    try {
      const response = await fetch(buildApiUrl(`/questions/${practiceQuestion.id}/essay-word-stats`, activeStudentId));
      if (!response.ok) throw new Error("load essay word stats failed");
      const data: EssayWordStatsResponse = await response.json();
      setPracticeWordStats(data.items ?? []);
      setPracticeWordStatsVisible(true);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load word statistics. Please try again later.");
    } finally {
      setPracticeWordStatsLoading(false);
    }
  }

  async function saveQuestionTags() {
    if (!tagQuestion) {
      return;
    }

    setTagSaving(true);
    const tags = tagDraft
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      await updateQuestionTags(tagQuestion, tags);
    } catch (error) {
      console.error(error);
      setMessage("Failed to save tags. Please try again later.");
    } finally {
      setTagSaving(false);
    }
  }

  async function updateQuestionTags(question: Question, tags: string[]) {
    const response = await fetch(buildApiUrl(`/questions/${question.id}/tags`, activeStudentId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tags })
    });
    if (!response.ok) throw new Error("save tags failed");

    const data: UpdateTagsResponse = await response.json();
    syncUpdatedQuestion(data);
    setTagDraft((data.tags ?? []).join(", "));
    setMessage(`Tags updated for ${data.title}.`);
    return data;
  }

  async function addPracticeQuickTag(tag: string) {
    if (!practiceQuestion) {
      return;
    }

    const nextTag = tag.trim();
    if (!nextTag) {
      return;
    }

    const nextTags = Array.from(new Set([...(practiceQuestion.tags ?? []), nextTag]));
    if (nextTags.length === (practiceQuestion.tags ?? []).length) {
      setMessage(`Tag "${nextTag}" is already on ${practiceQuestion.title}.`);
      return;
    }

    setPracticeTagSaving(true);
    try {
      await updateQuestionTags(practiceQuestion, nextTags);
    } catch (error) {
      console.error(error);
      setMessage("Failed to add the tag. Please try again later.");
    } finally {
      setPracticeTagSaving(false);
    }
  }

  async function validateImportPayload() {
    if (!importPayload.trim()) {
      setImportStatus("Please paste the JSON you want to import first.");
      setImportErrors([]);
      setImportPreview([]);
      return;
    }

    setImportLoading(true);
    setImportStatus("Validating JSON...");
    try {
      const response = await fetch(buildApiUrl("/questions/import/validate", activeStudentId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payload: importPayload, defaultSubject: activeSubject })
      });
      if (!response.ok) throw new Error("validate failed");
      const data: ImportValidationResponse = await response.json();
      setImportPreview(data.items ?? []);
      setImportErrors(data.errors ?? []);
      setImportStatus(
        data.valid ? `Validation passed. ${data.count} item(s) are ready to import into ${activeSubjectMeta.label}.` : "Validation failed. Please fix the issues below first."
      );
    } catch (error) {
      console.error(error);
      setImportPreview([]);
      setImportErrors(["Validation failed. Please make sure the JSON format is correct."]);
      setImportStatus("Validation failed.");
    } finally {
      setImportLoading(false);
    }
  }

  async function saveEnglishEssay() {
    const rawStem = essayStemRef.current?.innerHTML ?? "";
    const stem = sanitizeRichHtml(rawStem);
    const isCommonSentence = isEnglishCommonSentenceQuestion(essayEditorQuestionType);
    const isSynthesis = isEnglishSynthesisQuestion(essayEditorQuestionType);
    const answerWords = isCommonSentence ? [] : extractUnderlinedWords(stem);
    const answer = isCommonSentence ? stem : JSON.stringify(answerWords);
    const nextTitle = essayTitle.trim() || htmlToPlainText(stem).slice(0, 24);
    const nextTopic = essayTopic.trim();
    const nextSourceSentence = essaySourceSentence.trim();
    const editorLabel = getEnglishPassageEditorLabel(essayEditorQuestionType);

    if (!nextTopic || !stem) {
      setEssayStatus(`Please provide at least a topic and paste the ${editorLabel} content.`);
      return;
    }
    if (isSynthesis && !nextSourceSentence) {
      setEssayStatus("Please enter the original sentence before saving this Synthesis item.");
      return;
    }
    if (!isCommonSentence && answerWords.length === 0) {
      setEssayStatus("Please underline at least one word in the left editor before saving.");
      return;
    }

    setEssaySaving(true);
    setEssayStatus(editingEssayQuestion ? `Saving ${editorLabel} changes...` : `Saving ${editorLabel}...`);
    try {
      const response = await fetch(buildApiUrl(`/questions${editingEssayQuestion ? `/${editingEssayQuestion.id}` : ""}`, activeStudentId), {
        method: editingEssayQuestion ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: editingEssayQuestion?.code ?? "",
          title: nextTitle,
          subject: "English",
          gradeLevel: "PSLE",
          difficulty: editingEssayQuestion?.difficulty ?? "medium",
          questionType: essayEditorQuestionType,
          topic: nextTopic,
          exampleSentence: isSynthesis ? nextSourceSentence : editingEssayQuestion?.exampleSentence ?? "",
          stem,
          answer,
          analysis: editingEssayQuestion?.analysis ?? "",
          status: editingEssayQuestion?.status ?? "draft"
        })
      });
      if (!response.ok) {
        throw new Error("save english essay failed");
      }

      await reloadQuestions();
      closeEssayModal();
      setMessage(editingEssayQuestion ? `${editorLabel} updated.` : `${editorLabel} added to the question bank.`);
    } catch (error) {
      console.error(error);
      setEssayStatus("Save failed. Please try again later.");
    } finally {
      setEssaySaving(false);
    }
  }

  async function importQuestionsFromJson() {
    if (!importPayload.trim()) {
      setImportStatus("Please paste the JSON you want to import first.");
      return;
    }

    setImportLoading(true);
    setImportStatus("Importing into database...");
    try {
      const response = await fetch(buildApiUrl("/questions/import", activeStudentId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payload: importPayload, defaultSubject: activeSubject })
      });

      const data = (await response.json()) as ImportResponse | ImportValidationResponse;
      if (!response.ok) {
        const nextErrors = "errors" in data ? data.errors ?? ["Import failed."] : ["Import failed."];
        setImportErrors(nextErrors);
        setImportStatus("Import failed. Please fix the validation issues first.");
        return;
      }

      const result = data as ImportResponse;
      await reloadQuestions();
      setImportErrors([]);
      setImportPreview([]);
      setImportPayload("");
      setImportStatus(`Successfully imported ${result.importedCount} item(s) into ${activeSubjectMeta.label}. Original child answers were also saved.`);
      setMessage(`Imported ${result.importedCount} item(s) into ${activeSubjectMeta.label}.`);
      setImportModalOpen(false);
    } catch (error) {
      console.error(error);
      setImportStatus("Import failed. Please check the backend service or database status.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand brand-link" href={buildHomeHref(activeSubject, activeQuestionType, activeStudentId)}>
          <img className="brand-mark" src="/logo.svg" alt="PSLE logo" />
          <div>
            <strong>PSLE Question Management System</strong>
            <small>{settingsMode ? "System settings and base configuration" : "Switch the question bank by subject"}</small>
          </div>
        </a>

        <div className="topbar-actions">
          <div
            className={studentMenuOpen ? "student-switcher open" : "student-switcher"}
            tabIndex={0}
            onMouseEnter={openStudentMenu}
            onMouseLeave={closeStudentMenuWithDelay}
            onFocus={openStudentMenu}
            onBlur={closeStudentMenuWithDelay}
          >
            <div className="student-switcher-trigger">
              <span className="student-switcher-label">Student</span>
              <span className="student-current">{activeStudent?.name ?? "Default Student"}</span>
            </div>
            <div className="student-switcher-menu">
              {students.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={student.id === activeStudentId ? "student-switcher-item active" : "student-switcher-item"}
                  onClick={() => switchStudent(student.id)}
                  disabled={studentLoading || studentCreating}
                >
                  {student.name}
                </button>
              ))}
              <button type="button" className="student-action-button" onClick={() => void createStudent()} disabled={studentCreating}>
                {studentCreating ? "Adding..." : "Add Student"}
              </button>
            </div>
          </div>

          <a
            className={settingsMode ? "nav-link active nav-anchor settings-link" : "nav-link nav-anchor settings-link"}
            href={buildSettingsHref(activeStudentId)}
          >
            Settings
          </a>
        </div>
      </header>

      <div className="page">
        <section className="subject-hero">
          <div>
            {!settingsMode && (
              <div className="subject-toolbar">
                <span className="subject-toolbar-label">Subjects</span>
                <nav className="subject-nav subject-nav-panel" aria-label="Subject navigation">
                  {subjectTabs.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={item.value === activeSubject ? "nav-link active" : "nav-link"}
                      onClick={() => switchSubject(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            <p className="eyebrow">{settingsMode ? "System Settings" : `${activeSubjectMeta.label} Question Bank`}</p>
            <h1>
              {settingsMode
                ? "Prompt Settings"
                : `${activeSubjectMeta.label} Question List`}
            </h1>
            <p className="hero-text">
              {settingsMode
                ? "Manage system-level prompt settings here. Updates are auto-saved to the database for reuse by future features."
                : "Import JSON for the current subject and continue filtering by question type here."}
            </p>
            <p className="hero-student">Current student: {activeStudent?.name ?? "Default Student"}</p>
          </div>
          <div className="hero-card">
            <span>Data Status</span>
            <strong>
              {settingsMode
                ? promptLoading
                  ? "Loading"
                  : promptTemplate !== savedPromptTemplate
                    ? "Pending Save"
                    : "Ready"
                : importLoading
                  ? "Processing"
                  : loading
                  ? "Syncing"
                  : "Ready"}
            </strong>
            <small>{message}</small>
          </div>
        </section>

        {settingsMode ? (
          <main className="settings-layout">
            <section className="panel settings-panel">
              <div className="panel-head settings-panel-head">
                <div>
                  <h2>Prompt Settings</h2>
                  <p className="settings-copy">Store reusable prompts, role descriptions, and output requirements here for later AI features.</p>
                </div>
                <span className="settings-meta">
                  {promptUpdatedAt ? `Last saved: ${formatDateTime(promptUpdatedAt)}` : "Not saved to the database yet"}
                </span>
              </div>

              <div className="settings-form">
                <label className="settings-field">
                  <span>Prompt Content</span>
                  <textarea
                    className="settings-textarea"
                    value={promptTemplate}
                    onChange={(event) => setPromptTemplate(event.target.value)}
                    placeholder="Example: You are a PSLE question assistant. Return structured output, preserve subject information, and prefer concise English."
                    rows={14}
                  />
                </label>

                <div className="settings-footer">
                  <span className="settings-status">{promptTemplate !== savedPromptTemplate ? "Auto-saves 600ms after input" : promptStatus}</span>
                  <span className="settings-status subtle">Characters: {promptTemplate.length}</span>
                </div>
              </div>
            </section>
          </main>
        ) : (
          <main className="content-layout">
            <section className="panel question-panel">
              <div className="panel-head">
                <h2>{activeSubjectMeta.label} Question List</h2>
                <div className="question-panel-actions">
                  {activeSubject === "English" && isEnglishPassageEditorQuestion(activeQuestionType) && (
                    <button type="button" className="secondary" onClick={() => openEssayModal(undefined, activeQuestionType)}>
                      {`Add ${getEnglishPassageEditorLabel(activeQuestionType)}`}
                    </button>
                  )}
                  {activeSubject === "English" && isEnglishReadingQuestion(activeQuestionType) && (
                    <div
                      ref={essayListSpeechMenuRef}
                      className={essayListSpeechMenuOpen ? "speech-menu open" : "speech-menu"}
                      onMouseEnter={() => openSpeechMenu("list")}
                    >
                      <button type="button" className="link speech-menu-trigger" onClick={() => toggleSpeechMenu("list")}>
                        Read...
                      </button>
                      <div className="speech-menu-panel">
                        <div className="speech-rate-group" aria-label="Reading voice">
                          {essaySpeechVoiceOptions.map((voice) => (
                            <button
                              key={`list-voice-${voice}`}
                              type="button"
                              className={practiceEssayVoice === voice ? "speech-rate-chip active" : "speech-rate-chip"}
                              onClick={() => updatePracticeEssayVoice(voice)}
                            >
                              {voice === "male" ? "Male" : "Female"}
                            </button>
                          ))}
                        </div>
                        <button type="button" className="secondary speech-menu-action" onClick={toggleEssayListReading}>
                          {essayListReading ? "Stop Continuous Reading" : `Read ${getEnglishPassageEditorLabel(activeQuestionType)} Continuously`}
                        </button>
                        <div className="speech-rate-group" aria-label="Reading speed">
                          {essaySpeechRateOptions.map((rate) => (
                            <button
                              key={`list-${rate}`}
                              type="button"
                              className={practiceEssayRate === rate ? "speech-rate-chip active" : "speech-rate-chip"}
                              onClick={() => updatePracticeEssayRate(rate)}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <button type="button" className="secondary" onClick={openImportModal}>
                    Import {activeSubjectMeta.label} JSON
                  </button>
                  <button className="secondary" onClick={() => window.location.reload()}>
                    Refresh
                  </button>
                </div>
              </div>

              <div className="type-nav" aria-label="Question type navigation">
                {activeSubject === "English" ? (
                  englishQuestionTypes.map((questionType) => (
                    <button
                      key={questionType}
                      type="button"
                      className={activeQuestionType === questionType ? "type-chip active" : "type-chip"}
                      onClick={() => switchQuestionType(questionType)}
                    >
                      {isEnglishReadingQuestion(questionType) ? getEnglishPassageEntryLabel(questionType) : getQuestionTypeLabel(questionType)}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      className={activeQuestionType === "" ? "type-chip active" : "type-chip"}
                      onClick={() => switchQuestionType("")}
                    >
                      All Types
                    </button>
                    {subjectQuestionTypes.map((questionType) => (
                      <button
                        key={questionType}
                        type="button"
                        className={activeQuestionType === questionType ? "type-chip active" : "type-chip"}
                        onClick={() => switchQuestionType(questionType)}
                      >
                        {getQuestionTypeLabel(questionType)}
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div className="type-nav tag-nav" aria-label="Tag navigation">
                <button
                  type="button"
                  className={activeTag === "" ? "type-chip active" : "type-chip"}
                  onClick={() => setActiveTag("")}
                >
                  All Tags
                </button>
                {subjectTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={activeTag === tag ? "type-chip active" : "type-chip"}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="filters compact">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={`Search ${activeSubjectMeta.label} by code, title, stem, topic, or tag`}
                />
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <button onClick={() => setMessage(`${filteredItems.length} question(s) in ${activeSubjectMeta.label}`)}>
                  Show Result
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Topic</th>
                      {showWordColumns && <th>Word</th>}
                      {showWordColumns && <th>Example Sentence</th>}
                      <th>Tags</th>
                      <th>Correct / Attempts</th>
                      <th>Difficulty</th>
                      <th>Status</th>
                      <th>Updated At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className={essayListReadingQuestionId === item.id ? "reading-row" : undefined}>
                        <td>
                          <div className="question-summary-cell">
                            <strong>{item.title}</strong>
                            <span>{item.code}</span>
                            <small>{getSubjectMeta(item.subject).label}</small>
                            {isEnglishReadingQuestion(item.questionType) && (
                              <button type="button" className="link question-summary-link" onClick={() => startEssayListReadingFrom(item.id)}>
                                Read From Here
                              </button>
                            )}
                          </div>
                        </td>
                        <td>{getQuestionTypeLabel(item.questionType)}</td>
                        <td>{item.topic || "-"}</td>
                        {showWordColumns && <td>{item.reminderWord || "-"}</td>}
                        {showWordColumns && (
                          <td>
                            <div className="question-example-cell">{item.exampleSentence || "-"}</div>
                          </td>
                        )}
                        <td>
                          <div className="table-tags">
                            {(item.tags ?? []).length > 0 ? (
                              item.tags.map((tag) => (
                                <button key={tag} type="button" className="tag-pill" onClick={() => setActiveTag(tag)}>
                                  {tag}
                                </button>
                              ))
                            ) : (
                              <span className="muted-text">No tags</span>
                            )}
                          </div>
                        </td>
                        <td>{`${item.correctCount ?? 0}/${item.attemptsCount ?? 0}`}</td>
                        <td>{item.difficulty}</td>
                        <td>{item.status}</td>
                        <td>{formatDateTime(item.updatedAt)}</td>
                        <td className="actions">
                          <button className="link" onClick={() => openPracticeModal(item)}>
                            Practice
                          </button>
                          {isEnglishPassageEditorQuestion(item.questionType) && (
                            <button className="link" onClick={() => openEssayModal(item)}>
                              Edit
                            </button>
                          )}
                          <button className="link" onClick={() => openTagModal(item)}>
                            Tags
                          </button>
                          <button className="link danger" onClick={() => void removeQuestion(item.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredItems.length && (
                      <tr>
                        <td colSpan={showWordColumns ? 11 : 9} className="empty">
                          No questions for this subject yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {importModalOpen && (
              <div className="import-modal-overlay" role="presentation" onClick={closeImportModal}>
                <section
                  className="panel import-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="import-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="panel-head import-panel-head">
                    <div>
                      <h2 id="import-modal-title">{activeSubjectMeta.label} JSON Import</h2>
                      <p className="panel-tip panel-tip-inline">
                        Recommended fields: `questionType / topic / problemDescription / answer / childAnswer`. For English Word Reminder add `word / exampleSentence`; for English Single Choice add `optionItems`; for Synthesis add `exampleSentence` as the original sentence; for Comprehension Close and English Essay use rich-text `problemDescription` and a JSON array string in `answer`; for Common Sentences, `problemDescription` alone is enough and `answer` may be omitted. `childAnswer` may be empty, `subject` may be omitted, and Chinese field names are still supported.
                      </p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeImportModal}>
                      Close
                    </button>
                  </div>

                  <label className="import-field">
                    <span>Paste JSON to Import</span>
                    <textarea
                      className="import-textarea"
                      value={importPayload}
                      onChange={(event) => setImportPayload(event.target.value)}
                      placeholder={getImportPlaceholder(activeSubject)}
                      rows={12}
                    />
                  </label>

                  <div className="import-actions">
                    <button type="button" className="secondary" onClick={fillImportExample} disabled={importLoading}>
                      Fill Sample
                    </button>
                    <button type="button" className="secondary" onClick={() => void validateImportPayload()} disabled={importLoading}>
                      Validate JSON
                    </button>
                    <button type="button" onClick={() => void importQuestionsFromJson()} disabled={importLoading}>
                      Import into Database
                    </button>
                  </div>

                  <p className="import-status">{importStatus}</p>

                  {importErrors.length > 0 && (
                    <div className="import-errors">
                      {importErrors.map((error) => (
                        <div key={error} className="import-error-item">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}

                  {importPreview.length > 0 && (
                    <div className="import-preview">
                      <div className="import-preview-head">Validation Preview (First 5 Items)</div>
                      {importPreview.slice(0, 5).map((item) => (
                        <div key={`${item.index}-${item.generatedCode}`} className="import-preview-item">
                          <strong>{item.generatedTitle}</strong>
                          <span>
                            {getSubjectMeta(item.subject).label} / {getQuestionTypeLabel(item.questionType)}
                          </span>
                          <small>Topic: {item.topic}</small>
                          {item.reminderWord && <small>Word: {item.reminderWord}</small>}
                          {item.exampleSentence && (
                            <small>{item.questionType === "english_synthesis" ? "Original sentence" : "Example"}: {item.exampleSentence}</small>
                          )}
                          {item.optionItems?.length > 0 && <small>Options: {item.optionItems.join(" / ")}</small>}
                          <small>Answer: {item.answer || "-"}</small>
                          <small>{item.generatedCode}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {essayModalOpen && (
              <div className="import-modal-overlay" role="presentation" onClick={closeEssayModal}>
                <section className="panel essay-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="panel-head import-panel-head">
                    <div>
                      <h2>{editingEssayQuestion ? `Edit ${getEnglishPassageEditorLabel(essayEditorQuestionType)}` : `Add ${getEnglishPassageEditorLabel(essayEditorQuestionType)}`}</h2>
                      <p className="panel-tip panel-tip-inline">
                        {isEnglishCommonSentenceQuestion(essayEditorQuestionType)
                          ? "Paste the sentence or passage on the left and save it directly. This type is for reading and read-aloud only."
                          : isEnglishSynthesisQuestion(essayEditorQuestionType)
                            ? "Enter the original sentence, then paste the transformed sentence below. Underline the parts students need to complete."
                          : "Paste the passage on the left, underline selected text with one click, and manage the generated answer blanks on the right."}
                      </p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeEssayModal}>
                      Close
                    </button>
                  </div>

                  <div className="essay-form-grid">
                    <label className="import-field">
                      <span>Title</span>
                      <input value={essayTitle} onChange={(event) => setEssayTitle(event.target.value)} placeholder="Optional. If empty, a title will be generated from the passage." />
                    </label>
                    <label className="import-field">
                      <span>Topic</span>
                      <input value={essayTopic} onChange={(event) => setEssayTopic(event.target.value)} placeholder="For example: argumentative essay / formal letter" />
                    </label>
                    {isEnglishSynthesisQuestion(essayEditorQuestionType) && (
                      <label className="import-field essay-form-full-span">
                        <span>Original Sentence</span>
                        <textarea
                          className="import-textarea"
                          value={essaySourceSentence}
                          onChange={(event) => setEssaySourceSentence(event.target.value)}
                          placeholder="Enter the original sentence that students need to rewrite."
                          rows={3}
                        />
                      </label>
                    )}
                  </div>

                  <div className={isEnglishCommonSentenceQuestion(essayEditorQuestionType) ? "essay-editor-layout single-pane" : "essay-editor-layout"}>
                    <section className="essay-editor-pane">
                      {!isEnglishCommonSentenceQuestion(essayEditorQuestionType) && (
                        <div className="essay-editor-toolbar">
                          <button type="button" className="secondary" onMouseDown={(event) => event.preventDefault()} onClick={addUnderlineQuestionWord}>
                            Underline Selected Text
                          </button>
                          <span className="panel-tip">Select words in the left editor first, then click this button.</span>
                        </div>
                      )}

                      <label className="import-field">
                        <span>{isEnglishSynthesisQuestion(essayEditorQuestionType) ? "Transformed Sentence" : `${getEnglishPassageEditorLabel(essayEditorQuestionType)} Content`}</span>
                        <div
                          ref={essayStemRef}
                          className="rich-editor essay-editor-main"
                          contentEditable
                          suppressContentEditableWarning
                          data-placeholder={
                            isEnglishSynthesisQuestion(essayEditorQuestionType)
                              ? "Paste the target sentence here. Underline the parts students need to complete."
                              : "Paste the English passage here. Existing bold text and highlights will be preserved as much as possible."
                          }
                          onMouseUp={rememberEssaySelection}
                          onKeyUp={rememberEssaySelection}
                          onInput={syncEssaySelectedWordsFromEditor}
                        />
                      </label>
                    </section>

                    {!isEnglishCommonSentenceQuestion(essayEditorQuestionType) && (
                      <section className="essay-answer-pane">
                        <div className="essay-answer-head">
                          <strong>{isEnglishSynthesisQuestion(essayEditorQuestionType) ? "Blanked Parts" : "Answer Blanks"}</strong>
                          <span className="panel-tip">
                            {isEnglishSynthesisQuestion(essayEditorQuestionType)
                              ? "These underlined parts will be hidden in the target sentence during practice."
                              : "Each item on the right becomes one answer field during practice."}
                          </span>
                        </div>

                        {essaySelectedWords.length > 0 ? (
                          <div className="essay-selected-list">
                            {essaySelectedWords.map((word, index) => (
                              <div key={`${index}-${word}`} className="essay-selected-item">
                                <span>{index + 1}</span>
                                <input value={word} onChange={(event) => updateEssaySelectedWord(index, event.target.value)} />
                                <button type="button" className="link danger" onClick={() => removeEssaySelectedWord(index)}>
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-copy">
                            {isEnglishSynthesisQuestion(essayEditorQuestionType)
                              ? 'No hidden parts yet. Select text in the target sentence, then click "Underline Selected Text".'
                              : 'No blank words yet. Select text on the left, then click "Underline Selected Text".'}
                          </p>
                        )}
                      </section>
                    )}
                  </div>

                  <div className="import-actions">
                    <button type="button" onClick={() => void saveEnglishEssay()} disabled={essaySaving}>
                      {editingEssayQuestion ? "Save Changes" : `Save ${getEnglishPassageEditorLabel(essayEditorQuestionType)}`}
                    </button>
                  </div>

                  <p className="import-status">{essayStatus}</p>
                </section>
              </div>
            )}

            {practiceQuestion && (
              <div className="import-modal-overlay" role="presentation" onClick={closePracticeModal}>
                <section className="panel practice-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="panel-head import-panel-head">
                    <div>
                      <h2>{practiceQuestion.title}</h2>
                      <p className="panel-tip panel-tip-inline">
                        {getQuestionTypeLabel(practiceQuestion.questionType)} / {practiceQuestion.topic}
                      </p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closePracticeModal}>
                      Close
                    </button>
                  </div>

                  <div className="practice-meta">
                    <span>Attempts: {practiceQuestion.attemptsCount}</span>
                    <span>Correct: {practiceQuestion.correctCount}</span>
                    {(practiceQuestion.tags ?? []).map((tag) => (
                      <span key={tag} className="tag-pill static">
                        {tag}
                      </span>
                    ))}
                    <button
                      type="button"
                      className={(practiceQuestion.tags ?? []).includes(practiceMoreTag) ? "link practice-tag-shortcut added" : "link practice-tag-shortcut"}
                      onClick={() => void addPracticeQuickTag(practiceMoreTag)}
                      disabled={practiceTagSaving}
                    >
                      {(practiceQuestion.tags ?? []).includes(practiceMoreTag) ? "practise more added" : "practise more"}
                    </button>
                    <button type="button" className="link practice-tag-shortcut" onClick={() => openTagModal(practiceQuestion)}>
                      Manage Tags
                    </button>
                  </div>

                  <p className="practice-shortcut-hint">Shortcuts: `Enter` submit, `←` previous, `→` next.</p>

                  {isEnglishReadingQuestion(practiceQuestion.questionType) ? (
                    <div className={isEnglishBlankPassageQuestion(practiceQuestion.questionType) ? "practice-essay-layout" : "practice-reading-layout"}>
                      <div className="practice-essay-content">
                        <div className="practice-hint-block practice-essay-toolbar">
                          <div
                            ref={practiceSpeechMenuRef}
                            className={practiceSpeechMenuOpen ? "speech-menu open" : "speech-menu"}
                            onMouseEnter={() => openSpeechMenu("practice")}
                          >
                            <button type="button" className="link speech-menu-trigger" onClick={() => toggleSpeechMenu("practice")}>
                              Read...
                            </button>
                            <div className="speech-menu-panel">
                              <div className="speech-rate-group" aria-label="Reading voice">
                                {essaySpeechVoiceOptions.map((voice) => (
                                  <button
                                    key={`practice-voice-${voice}`}
                                    type="button"
                                    className={practiceEssayVoice === voice ? "speech-rate-chip active" : "speech-rate-chip"}
                                    onClick={() => updatePracticeEssayVoice(voice)}
                                  >
                                    {voice === "male" ? "Male" : "Female"}
                                  </button>
                                ))}
                              </div>
                              <button type="button" className="secondary speech-menu-action" onClick={togglePracticeEssayReading}>
                                {practiceEssayReading ? "Stop Reading" : `Read ${getEnglishPassageEditorLabel(practiceQuestion.questionType)}`}
                              </button>
                              <div className="speech-rate-group" aria-label="Reading speed">
                                {essaySpeechRateOptions.map((rate) => (
                                  <button
                                    key={rate}
                                    type="button"
                                    className={practiceEssayRate === rate ? "speech-rate-chip active" : "speech-rate-chip"}
                                    onClick={() => updatePracticeEssayRate(rate)}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className="practice-stem rich-render"
                          dangerouslySetInnerHTML={{
                            __html: isEnglishBlankPassageQuestion(practiceQuestion.questionType)
                              ? essayExercise.html || "<p>-</p>"
                              : sanitizeRichHtml(practiceQuestion.stem) || "<p>-</p>"
                          }}
                        />
                      </div>

                      {isEnglishBlankPassageQuestion(practiceQuestion.questionType) && (
                        <label className="import-field practice-essay-answer-field">
                          <span>Fill in the blanked words</span>
                          <div className="essay-answer-grid essay-answer-grid-vertical">
                            {essayExercise.answers.map((_, index) => {
                              const userAnswer = practiceResult ? parseEssayAnswerValues(practiceResult.attempt.answerText)[index] ?? "" : "";
                              const correctAnswer = practiceResult ? parseEssayAnswerValues(practiceResult.correctAnswer)[index] ?? "" : "";
                              const showMaskedHint = Boolean(essayBlankHintVisible[index]) && Boolean(essayExercise.answers[index]);
                              const showInlineCorrectAnswer =
                                Boolean(practiceResult) &&
                                normalizeEssayAnswerValue(userAnswer) !== normalizeEssayAnswerValue(correctAnswer) &&
                                Boolean(correctAnswer);

                              return (
                                <label
                                  key={index}
                                  className={
                                    showInlineCorrectAnswer || showMaskedHint
                                      ? "essay-answer-item essay-answer-item-inline has-feedback"
                                      : "essay-answer-item essay-answer-item-inline"
                                  }
                                >
                                  <span className="essay-answer-index-group">
                                    <span>{index + 1}</span>
                                    <button
                                      type="button"
                                      className="essay-answer-reveal-button"
                                      aria-label={
                                        showMaskedHint
                                          ? `Hide hint for blank ${index + 1}`
                                          : `Show hint for blank ${index + 1}`
                                      }
                                      onClick={() => toggleEssayBlankHint(index)}
                                    >
                                      <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                          d="M2.2 12c2.1-3.8 5.7-6 9.8-6s7.7 2.2 9.8 6c-2.1 3.8-5.7 6-9.8 6s-7.7-2.2-9.8-6Z"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                      </svg>
                                    </button>
                                  </span>
                                  <input
                                    value={essayBlankAnswers[index] ?? ""}
                                    onChange={(event) =>
                                      setEssayBlankAnswers((current) => {
                                        const next = [...current];
                                        next[index] = event.target.value;
                                        return next;
                                      })
                                    }
                                    placeholder="Enter word"
                                  />
                                  {showInlineCorrectAnswer ? (
                                    <small className="essay-answer-inline-correct">Correct: {correctAnswer}</small>
                                  ) : showMaskedHint ? (
                                    <small className="essay-answer-inline-hint">Hint: {buildMaskedPassageHint(essayExercise.answers[index] ?? "")}</small>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        </label>
                      )}
                    </div>
                  ) : isEnglishSynthesisQuestion(practiceQuestion.questionType) ? (
                    <div className="practice-synthesis-layout">
                      <div className="practice-synthesis-block">
                        <strong className="practice-synthesis-label">Original Sentence</strong>
                        <div className="practice-stem">{practiceQuestion.exampleSentence || "-"}</div>
                      </div>
                      <div className="practice-synthesis-block">
                        <strong className="practice-synthesis-label">Rewrite With The Same Meaning</strong>
                        <div
                          className="practice-stem rich-render"
                          dangerouslySetInnerHTML={{
                            __html: synthesisExercise.html || sanitizeRichHtml(practiceQuestion.stem) || "<p>-</p>"
                          }}
                        />
                      </div>
                        <label className="import-field practice-synthesis-answer-field">
                          {(() => {
                            const submittedAnswers = practiceResult ? parseEssayAnswerValues(practiceResult.attempt.answerText) : [];
                            const correctAnswers = practiceResult ? parseEssayAnswerValues(practiceResult.correctAnswer) : [];
                            const allCorrect =
                              Boolean(practiceResult) &&
                              synthesisExercise.answers.length > 0 &&
                              synthesisExercise.answers.every(
                                (_, index) =>
                                  normalizeEssayAnswerValue(submittedAnswers[index] ?? "") === normalizeEssayAnswerValue(correctAnswers[index] ?? "")
                              );

                            return (
                              <>
                                <div className="practice-synthesis-answer-head">
                                  <span>Fill in the missing part{`${synthesisExercise.answers.length > 1 ? "s" : ""}`}</span>
                                  {allCorrect ? <span className="word-reminder-feedback correct">Correct</span> : null}
                                </div>
                                <div className="essay-answer-grid essay-answer-grid-vertical">
                                  {synthesisExercise.answers.map((_, index) => {
                                    const userAnswer = submittedAnswers[index] ?? "";
                                    const correctAnswer = correctAnswers[index] ?? "";
                                    const showInlineCorrectAnswer =
                                      Boolean(practiceResult) &&
                                      normalizeEssayAnswerValue(userAnswer) !== normalizeEssayAnswerValue(correctAnswer) &&
                                      Boolean(correctAnswer);

                                    return (
                                      <label
                                        key={index}
                                        className={showInlineCorrectAnswer ? "essay-answer-item essay-answer-item-inline has-feedback" : "essay-answer-item essay-answer-item-inline"}
                                      >
                                        <span>{index + 1}</span>
                                        <input
                                          className={
                                            allCorrect
                                              ? "word-reminder-answer-input correct"
                                              : showInlineCorrectAnswer
                                                ? "word-reminder-answer-input wrong"
                                                : "word-reminder-answer-input"
                                          }
                                          value={essayBlankAnswers[index] ?? ""}
                                          onChange={(event) =>
                                            setEssayBlankAnswers((current) => {
                                              const next = [...current];
                                              next[index] = event.target.value;
                                              return next;
                                            })
                                          }
                                          placeholder="Enter the missing words"
                                        />
                                        {showInlineCorrectAnswer ? (
                                          <small className="word-reminder-feedback wrong">Incorrect. Correct answer: {correctAnswer}</small>
                                        ) : null}
                                      </label>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </label>
                    </div>
                  ) : (
                    <>
                      {isRichTextQuestionType(practiceQuestion.questionType) ? (
                        <div
                          className="practice-stem rich-render"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeRichHtml(practiceQuestion.stem) || "<p>-</p>"
                          }}
                        />
                      ) : isEnglishSingleChoiceQuestion(practiceQuestion.questionType) ? (
                        <>
                          <div className="practice-stem">{practiceQuestion.stem}</div>
                          <div className="choice-options">
                            {(practiceQuestion.optionItems ?? []).map((option) => {
                              const optionKey = getChoiceOptionKey(option);
                              const selected = getChoiceOptionKey(practiceAnswer) === optionKey;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  className={selected ? "choice-option active" : "choice-option"}
                                  onClick={() => setPracticeAnswer(optionKey)}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="practice-stem">
                          {isEnglishWordReminderQuestion(practiceQuestion.questionType)
                            ? buildMaskedReminderSentence(practiceQuestion)
                            : practiceQuestion.stem}
                        </div>
                      )}

                      <label className="import-field">
                        <span>
                          {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                            ? "Choose the correct answer"
                            : isEnglishWordReminderQuestion(practiceQuestion.questionType)
                            ? "Fill in the hidden English word"
                            : isObjectiveQuestionType(practiceQuestion.questionType)
                              ? "Enter your answer"
                              : "Enter your response"}
                        </span>
                        {isEnglishSingleChoiceQuestion(practiceQuestion.questionType) ? (
                          <input value={practiceAnswer} readOnly placeholder="Click an option above to answer" />
                        ) : isEnglishWordReminderQuestion(practiceQuestion.questionType) ? (
                          <div className="word-reminder-answer-row">
                            <input
                              className={
                                practiceResult?.attempt.isCorrect === true
                                  ? "word-reminder-answer-input correct"
                                  : practiceResult && practiceResult.attempt.isCorrect === false
                                    ? "word-reminder-answer-input wrong"
                                    : "word-reminder-answer-input"
                              }
                              value={practiceAnswer}
                              onChange={(event) => setPracticeAnswer(event.target.value)}
                              placeholder="Enter the missing English word"
                            />
                            {practiceResult && (
                              <span
                                className={
                                  practiceResult.attempt.isCorrect === true
                                    ? "word-reminder-feedback correct"
                                    : "word-reminder-feedback wrong"
                                }
                              >
                                {practiceResult.attempt.isCorrect === true
                                  ? "Correct"
                                  : `Incorrect. Correct answer: ${practiceResult.correctAnswer || practiceQuestion.answer}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <textarea
                            className="import-textarea"
                            value={practiceAnswer}
                            onChange={(event) => setPracticeAnswer(event.target.value)}
                            placeholder={
                              isObjectiveQuestionType(practiceQuestion.questionType)
                                  ? "For example: A or A,C"
                                  : "Enter your response"
                            }
                            rows={6}
                          />
                        )}
                      </label>
                    </>
                  )}

                  {isEnglishWordReminderQuestion(practiceQuestion.questionType) && (
                    <div className="practice-hint-block">
                      <button type="button" className="link" onClick={() => setPracticeHintVisible((current) => !current)}>
                        {practiceHintVisible ? "Hide Hint" : "Show Hint"}
                      </button>
                      {practiceHintVisible && (
                        <span className="practice-hint-text">Hint: {buildReminderHint(practiceQuestion.reminderWord || practiceQuestion.answer)}</span>
                      )}
                    </div>
                  )}

                  {!isEnglishCommonSentenceQuestion(practiceQuestion.questionType) && (
                    <div className="practice-hint-block">
                      <button type="button" className="link" onClick={() => setPracticeAnswerVisible((current) => !current)}>
                        {practiceAnswerVisible ? "Hide Answer" : "Show Answer"}
                      </button>
                      {isEnglishBlankPassageQuestion(practiceQuestion.questionType) && (
                        <button type="button" className="link" onClick={() => void togglePracticeWordStats()}>
                          {practiceWordStatsVisible ? "Hide Word Stats" : "View Word Stats"}
                        </button>
                      )}
                    </div>
                  )}

                  {isEnglishBlankPassageQuestion(practiceQuestion.questionType) && practiceWordStatsVisible && (
                    <div className="practice-result">
                      <strong>{practiceWordStatsLoading ? "Loading word stats..." : "Word Success Count / Total Attempts"}</strong>
                      {!practiceWordStatsLoading && (
                        <div className="essay-word-stats-list">
                          {practiceWordStats.map((item) => (
                            <div key={`${item.index}-${item.word}`} className="essay-word-stat-item">
                              <span>{item.index}. {item.word}</span>
                              <strong>{item.correctCount}/{item.attemptCount}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="import-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => navigatePracticeQuestion("previous")}
                      disabled={
                        !previousPracticeQuestion ||
                        practiceSubmitting ||
                        (practiceQuestion && isEnglishWordReminderQuestion(practiceQuestion.questionType) && !wordReminderPassed)
                      }
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => navigatePracticeQuestion("next")}
                      disabled={
                        !nextPracticeQuestion ||
                        practiceSubmitting ||
                        (practiceQuestion && isEnglishWordReminderQuestion(practiceQuestion.questionType) && !wordReminderPassed)
                      }
                    >
                      Next
                    </button>
                    {!isEnglishCommonSentenceQuestion(practiceQuestion.questionType) && (
                      <button
                        type="button"
                        onClick={() => void submitPracticeAnswer()}
                        disabled={
                          practiceSubmitting ||
                          (isEnglishBlankCompletionQuestion(practiceQuestion.questionType)
                            ? (isEnglishBlankPassageQuestion(practiceQuestion.questionType) ? essayExercise.answers.length : synthesisExercise.answers.length) === 0
                            : !practiceAnswer.trim())
                        }
                      >
                        Submit Answer
                      </button>
                    )}
                  </div>

                  {practiceAnswerVisible &&
                    (isEnglishBlankPassageQuestion(practiceQuestion.questionType) ? (
                      <div className="practice-result">
                        <strong>Reference Answer</strong>
                        <div className="essay-correct-list">
                          {parseEssayCorrectAnswer(practiceResult?.correctAnswer || practiceQuestion.answer).map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ) : isEnglishSynthesisQuestion(practiceQuestion.questionType) ? (
                      <div className="practice-result">
                        <strong>Reference Answer</strong>
                        <div className="essay-correct-list">
                          {parseEssayCorrectAnswer(practiceResult?.correctAnswer || JSON.stringify(synthesisExercise.answers)).map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ) : isRichTextQuestionType(practiceQuestion.questionType) ? (
                      <div className="practice-result">
                        <strong>Reference Answer</strong>
                        <div
                          className="rich-render practice-reference-answer"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(practiceResult?.correctAnswer || practiceQuestion.answer) || "<p>-</p>" }}
                        />
                      </div>
                    ) : (
                      <div className="practice-result">
                        <strong>Reference Answer</strong>
                        <div>
                          {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                            ? resolveChoiceAnswerLabel(practiceQuestion, practiceResult?.correctAnswer || practiceQuestion.answer)
                            : practiceResult?.correctAnswer || practiceQuestion.answer || "-"}
                        </div>
                      </div>
                    ))}

                  {practiceResult && (
                    <div className="practice-result">
                      <strong>{practiceResult.message}</strong>
                      {isEnglishWordReminderQuestion(practiceQuestion.questionType) && practiceQuestion.exampleSentence && (
                        <div>Original sentence: {practiceQuestion.exampleSentence}</div>
                      )}
                      {isEnglishWordReminderQuestion(practiceQuestion.questionType) ? null : isEnglishBlankCompletionQuestion(practiceQuestion.questionType) ? null : isRichTextQuestionType(practiceQuestion.questionType) ? (
                        <div>
                          <div>Your answer: {practiceResult.attempt.answerText}</div>
                          <div>Reference answer:</div>
                          <div
                            className="rich-render practice-reference-answer"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(practiceResult.correctAnswer) || "<p>-</p>" }}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            Your answer:
                            {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                              ? resolveChoiceAnswerLabel(practiceQuestion, practiceResult.attempt.answerText)
                              : practiceResult.attempt.answerText}
                          </div>
                          <div>
                            Reference answer:
                            {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                              ? resolveChoiceAnswerLabel(practiceQuestion, practiceResult.correctAnswer)
                              : practiceResult.correctAnswer}
                          </div>
                        </>
                      )}
                      {!isObjectiveQuestionType(practiceQuestion.questionType) && practiceQuestion.analysis && (
                        <div>Analysis: {practiceQuestion.analysis}</div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {tagQuestion && (
              <div className="import-modal-overlay" role="presentation" onClick={closeTagModal}>
                <section className="panel tag-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="panel-head import-panel-head">
                    <div>
                      <h2>{tagQuestion.title}</h2>
                      <p className="panel-tip panel-tip-inline">Separate tags with commas. Saved tags can be used immediately for quick filtering.</p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeTagModal}>
                      Close
                    </button>
                  </div>

                  <label className="import-field">
                    <span>Tags</span>
                    <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="For example: common mistake, midterm review, fractions" />
                  </label>

                  <div className="import-actions">
                    <button type="button" onClick={() => void saveQuestionTags()} disabled={tagSaving}>
                      Save Tags
                    </button>
                  </div>
                </section>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

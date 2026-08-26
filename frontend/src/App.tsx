import { ChangeEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

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

type UploadItem = {
  name: string;
  subject: string;
  url: string;
  createdAt: string;
};

type UploadResponse = {
  items: UploadItem[];
  combinedItems?: UploadItem[];
  history?: UploadLink;
};

type UploadLink = {
  id: string;
  subject: string;
  createdAt: string;
  batchId?: string;
  href?: string;
};

type UploadListResponse = {
  items: UploadItem[];
  history?: UploadLink[];
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

const uploadLinksStorageKey = "psle-upload-links";

const subjectTabs: SubjectMeta[] = [
  { key: "english", label: "英文", value: "English", aliases: ["English"] },
  { key: "science", label: "科学", value: "Science", aliases: ["Science"] },
  { key: "chinese", label: "华文", value: "Chinese", aliases: ["Chinese"] },
  { key: "math", label: "数学", value: "Mathematics", aliases: ["Mathematics"] }
];

const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

const questionTypeLabels: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  short_answer: "简答题",
  fill_in_blank: "填空题",
  true_false: "判断题",
  essay: "作文题",
  english_essay: "英文作文",
  english_word_reminder: "英文单词提醒",
  english_single_choice: "英文选择题"
};

const essaySpeechRateOptions = [1, 1.25, 1.5] as const;
const essaySpeechVoiceOptions = ["male", "female"] as const;
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

function isGalleryPage() {
  return window.location.pathname === "/gallery";
}

function isViewerPage() {
  return window.location.pathname === "/viewer";
}

function isSettingsPage() {
  return window.location.pathname === "/settings";
}

function buildHomeHref(subject: string, questionType?: string) {
  const params = new URLSearchParams({ subject });
  if (questionType) {
    params.set("questionType", questionType);
  }
  return `/?${params.toString()}`;
}

function buildGalleryHref(subject: string, batchId?: string) {
  const params = new URLSearchParams({ subject });
  if (batchId) {
    params.set("batch", batchId);
  }
  return `/gallery?${params.toString()}`;
}

function buildViewerHref(subject: string, startIndex?: number, count?: number) {
  const params = new URLSearchParams({ subject });
  if (typeof startIndex === "number") {
    params.set("start", String(startIndex));
  }
  if (typeof count === "number") {
    params.set("count", String(count));
  }
  return `/viewer?${params.toString()}`;
}

function buildSettingsHref() {
  return "/settings";
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
  return value === "essay" || value === "english_essay";
}

function isEnglishEssayQuestion(value: string) {
  return value === "english_essay";
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

  const matchedVoice =
    englishVoices.find((voice) => {
      const voiceText = `${voice.name} ${voice.voiceURI}`.toLowerCase();
      return hints.some((hint) => voiceText.includes(hint));
    }) ?? null;

  return matchedVoice ?? englishVoices[0] ?? null;
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

  return `${sentence}\n\n请根据题意填写对应英文单词。`;
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
  }
]`;
  }

  return `[
  {
    "questionType": "single_choice",
    "topic": "分数加法",
    "problemDescription": "计算 12 + 18 的结果。",
    "answer": "30",
    "childAnswer": "28"
  }
]`;
}

function mergeUploadLinks(...groups: UploadLink[][]) {
  const merged = new Map<string, UploadLink>();
  groups.flat().forEach((item) => {
    const key = `${item.subject}|${item.batchId ?? ""}|${item.href ?? ""}|${item.createdAt}`;
    merged.set(key, item);
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return (b.id || "").localeCompare(a.id || "");
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function getImportStatusHint(subjectLabel: string) {
  return `粘贴${subjectLabel} JSON 后先校验，再导入数据库；示例默认使用英文字段名，如果 JSON 里没写 subject，会自动使用当前页面学科。中文字段也兼容导入。`;
}

export default function App() {
  const galleryMode = isGalleryPage();
  const viewerMode = isViewerPage();
  const settingsMode = isSettingsPage();

  const [activeSubject, setActiveSubject] = useState(getInitialSubject);
  const [items, setItems] = useState<Question[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [activeQuestionType, setActiveQuestionType] = useState(getInitialQuestionType);
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("正在加载题目数据...");
  const [uploadLinks, setUploadLinks] = useState<UploadLink[]>([]);
  const [pendingUploadSubject, setPendingUploadSubject] = useState<string | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [savedPromptTemplate, setSavedPromptTemplate] = useState<string | null>(null);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptStatus, setPromptStatus] = useState("正在加载提示词配置...");
  const [importPayload, setImportPayload] = useState("");
  const [importStatus, setImportStatus] = useState(getImportStatusHint(getSubjectMeta(getInitialSubject()).label));
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState<Question | null>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [essayBlankAnswers, setEssayBlankAnswers] = useState<string[]>([]);
  const [practiceSubmitting, setPracticeSubmitting] = useState(false);
  const [practiceResult, setPracticeResult] = useState<SubmitAttemptResponse | null>(null);
  const [practiceHintVisible, setPracticeHintVisible] = useState(false);
  const [practiceAnswerVisible, setPracticeAnswerVisible] = useState(false);
  const [practiceEssayReading, setPracticeEssayReading] = useState(false);
  const [practiceEssayRate, setPracticeEssayRate] = useState<number>(1);
  const [practiceEssayVoice, setPracticeEssayVoice] = useState<EssaySpeechVoice>("male");
  const [essayListSpeechMenuOpen, setEssayListSpeechMenuOpen] = useState(false);
  const [practiceSpeechMenuOpen, setPracticeSpeechMenuOpen] = useState(false);
  const [essayListReading, setEssayListReading] = useState(false);
  const [essayListReadingQuestionId, setEssayListReadingQuestionId] = useState<number | null>(null);
  const [practiceWordStatsVisible, setPracticeWordStatsVisible] = useState(false);
  const [practiceWordStatsLoading, setPracticeWordStatsLoading] = useState(false);
  const [practiceWordStats, setPracticeWordStats] = useState<EssayWordStat[]>([]);
  const [essayModalOpen, setEssayModalOpen] = useState(false);
  const [editingEssayQuestion, setEditingEssayQuestion] = useState<Question | null>(null);
  const [essayTitle, setEssayTitle] = useState("");
  const [essayTopic, setEssayTopic] = useState("");
  const [essaySelectedWords, setEssaySelectedWords] = useState<string[]>([]);
  const [essayStatus, setEssayStatus] = useState("左边粘贴作文内容，选中文字后点“添加下划线出题”，右边会同步生成答题词。");
  const [essaySaving, setEssaySaving] = useState(false);
  const [tagQuestion, setTagQuestion] = useState<Question | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagSaving, setTagSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMenuRef = useRef<HTMLDivElement | null>(null);
  const essayListSpeechMenuRef = useRef<HTMLDivElement | null>(null);
  const practiceSpeechMenuRef = useRef<HTMLDivElement | null>(null);
  const essayStemRef = useRef<HTMLDivElement | null>(null);
  const essaySelectionRangeRef = useRef<Range | null>(null);
  const practiceEssayUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const essayListSpeechTimerRef = useRef<number | null>(null);
  const speechRestartTimerRef = useRef<number | null>(null);
  const viewerRangeRef = useRef<{ start: number; count: number } | null>(
    (() => {
      const params = new URLSearchParams(window.location.search);
      const startRaw = params.get("start");
      const countRaw = params.get("count");
      if (!startRaw || !countRaw) {
        return null;
      }

      const start = Number(startRaw);
      const count = Number(countRaw);
      if (Number.isNaN(start) || Number.isNaN(count) || start < 0 || count <= 0) {
        return null;
      }

      return { start, count };
    })()
  );
  const viewerCombinedRef = useRef<{ url: string; createdAt: string } | null>(
    (() => {
      const params = new URLSearchParams(window.location.search);
      const url = params.get("combined");
      if (!url) {
        return null;
      }

      return {
        url,
        createdAt: params.get("createdAt") ?? new Date().toISOString()
      };
    })()
  );
  const galleryBatchRef = useRef<string | null>(new URLSearchParams(window.location.search).get("batch"));

  const activeSubjectMeta = useMemo(
    () => subjectTabs.find((item) => item.value === activeSubject) ?? subjectTabs[0],
    [activeSubject]
  );

  const subjectItems = useMemo(
    () => items.filter((item) => activeSubjectMeta.aliases.includes(item.subject)),
    [activeSubjectMeta.aliases, items]
  );

  const subjectQuestionTypes = useMemo(() => {
    const values = Array.from(new Set(subjectItems.map((item) => item.questionType).filter(Boolean)));
    return values.sort((a, b) => getQuestionTypeLabel(a).localeCompare(getQuestionTypeLabel(b), "zh-CN"));
  }, [subjectItems]);

  const englishQuestionTypes = useMemo(() => ["english_word_reminder", "english_single_choice", "english_essay"], []);

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

  const essayExercise = useMemo(() => {
    if (!practiceQuestion || !isEnglishEssayQuestion(practiceQuestion.questionType)) {
      return { html: "", answers: [] as string[] };
    }
    return buildEnglishEssayExercise(practiceQuestion.stem);
  }, [practiceQuestion]);

  const essayListItems = useMemo(
    () => filteredItems.filter((item) => isEnglishEssayQuestion(item.questionType)),
    [filteredItems]
  );

  const showWordColumns = useMemo(() => {
    if (activeSubject !== "English") {
      return true;
    }
    return activeQuestionType === "" || activeQuestionType === "english_word_reminder";
  }, [activeQuestionType, activeSubject]);

  const viewerGroups = useMemo(() => {
    if (!viewerMode) {
      return [];
    }

    if (viewerCombinedRef.current) {
      return [
        [
          {
            name: "combined-image",
            subject: activeSubject,
            url: viewerCombinedRef.current.url,
            createdAt: viewerCombinedRef.current.createdAt
          }
        ]
      ];
    }

    const scopedUploads = viewerRangeRef.current
      ? uploads.slice(viewerRangeRef.current.start, viewerRangeRef.current.start + viewerRangeRef.current.count)
      : uploads;

    if (scopedUploads.length > 10) {
      const groups: UploadItem[][] = [];
      for (let index = 0; index < scopedUploads.length; index += 2) {
        groups.push(scopedUploads.slice(index, index + 2));
      }
      return groups;
    }

    return scopedUploads.map((item) => [item]);
  }, [uploads, viewerMode]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(uploadLinksStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as UploadLink[];
      if (Array.isArray(parsed)) {
        setUploadLinks(parsed);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(uploadLinksStorageKey, JSON.stringify(uploadLinks));
  }, [uploadLinks]);

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
    if (galleryMode || viewerMode || settingsMode) {
      return;
    }

    setImportModalOpen(false);
    setEssayModalOpen(false);
    setImportPayload("");
    setImportPreview([]);
    setImportErrors([]);
    setImportStatus(getImportStatusHint(activeSubjectMeta.label));
  }, [activeSubjectMeta.label, galleryMode, settingsMode, viewerMode]);

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
    if (!essayModalOpen || !essayStemRef.current) {
      return;
    }

    essayStemRef.current.innerHTML = editingEssayQuestion ? sanitizeRichHtml(editingEssayQuestion.stem) : "";
    setEssaySelectedWords(editingEssayQuestion ? extractUnderlinedWords(editingEssayQuestion.stem) : []);
  }, [editingEssayQuestion, essayModalOpen]);

  useEffect(() => {
    return () => {
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
    };
  }, []);

  useEffect(() => {
    if (galleryMode || viewerMode || settingsMode) {
      return;
    }

    function handlePopState() {
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
  }, [galleryMode, settingsMode, viewerMode]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(target)) {
        setUploadMenuOpen(false);
      }
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
      if (galleryMode || viewerMode || settingsMode) {
        return;
      }

      setLoading(true);
      setMessage("正在同步题目列表...");
      try {
        const response = await fetch(`${apiBase}/questions`);
        if (!response.ok) throw new Error("load failed");
        const data = await response.json();
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        setMessage("题目加载失败，请检查后端服务是否启动");
      } finally {
        setLoading(false);
      }
    }

    void loadQuestions();
  }, [galleryMode, settingsMode, viewerMode]);

  useEffect(() => {
    async function loadUploads() {
      if (settingsMode) {
        return;
      }

      setUploadLoading(true);
      try {
        const query = new URLSearchParams({ subject: activeSubject });
        if (galleryBatchRef.current) {
          query.set("batch", galleryBatchRef.current);
        }
        const response = await fetch(`${apiBase}/uploads?${query.toString()}`);
        if (!response.ok) throw new Error("upload list failed");
        const data: UploadListResponse = await response.json();
        setUploads(data.items ?? []);
        const historyItems = Array.isArray(data.history) ? data.history : [];
        if (historyItems.length > 0) {
          setUploadLinks((current) =>
            mergeUploadLinks(
              current,
              historyItems.map((item) => ({
                ...item,
                href: item.href ?? buildGalleryHref(item.subject, item.batchId)
              }))
            )
          );
        }
      } catch (error) {
        console.error(error);
        setUploads([]);
        setMessage("上传图片列表加载失败");
      } finally {
        setUploadLoading(false);
      }
    }

    void loadUploads();
  }, [activeSubject, settingsMode]);

  useEffect(() => {
    async function loadPromptSettings() {
      if (!settingsMode) {
        return;
      }

      setPromptLoading(true);
      setPromptStatus("正在加载提示词配置...");

      try {
        const response = await fetch(`${apiBase}/settings/prompt`);
        if (!response.ok) throw new Error("load prompt settings failed");

        const data: PromptSettingsResponse = await response.json();
        const nextValue = data.promptTemplate ?? "";
        setPromptTemplate(nextValue);
        setSavedPromptTemplate(nextValue);
        setPromptUpdatedAt(data.updatedAt ?? null);
        setPromptStatus(nextValue ? "已加载数据库中的提示词配置" : "还没有保存提示词配置，输入后会自动保存");
      } catch (error) {
        console.error(error);
        setPromptStatus("提示词配置加载失败，请检查后端服务");
      } finally {
        setPromptLoading(false);
      }
    }

    void loadPromptSettings();
  }, [settingsMode]);

  useEffect(() => {
    if (!settingsMode || savedPromptTemplate === null || promptTemplate === savedPromptTemplate) {
      return;
    }

    setPromptStatus("正在自动保存提示词配置...");

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`${apiBase}/settings/prompt`, {
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
          setPromptStatus("提示词配置已自动保存到数据库");
        } catch (error) {
          console.error(error);
          setPromptStatus("提示词配置保存失败，请稍后重试");
        }
      })();
    }, 600);

    return () => window.clearTimeout(timer);
  }, [promptTemplate, savedPromptTemplate, settingsMode]);

  useEffect(() => {
    if (settingsMode) {
      setMessage(promptLoading ? "正在加载系统配置..." : promptStatus);
      return;
    }
    if (galleryMode) {
      setMessage(`${activeSubjectMeta.label}上传图片共 ${uploads.length} 张`);
      return;
    }
    if (viewerMode) {
      const viewerCount = viewerGroups.reduce((count, group) => count + group.length, 0);
      setMessage(`${activeSubjectMeta.label}当前查看 ${viewerCount} 张图片`);
      return;
    }
    setMessage(`${activeSubjectMeta.label}题库共 ${filteredItems.length} 道题目`);
  }, [activeSubjectMeta.label, filteredItems.length, galleryMode, promptLoading, promptStatus, settingsMode, viewerGroups, viewerMode, uploads.length]);

  function switchSubject(subject: string) {
    stopEssayListReading();
    stopPracticeEssayReading();
    const nextSubject = getSubjectMeta(subject).value;
    const nextQuestionType = nextSubject === "English" ? "english_word_reminder" : "";
    if (settingsMode) {
      window.location.href = buildHomeHref(nextSubject, nextQuestionType);
      return;
    }
    if (viewerMode) {
      window.location.href = buildViewerHref(nextSubject);
      return;
    }
    if (galleryMode) {
      window.location.href = buildGalleryHref(nextSubject);
      return;
    }
    window.history.pushState({}, "", buildHomeHref(nextSubject, nextQuestionType));
    setActiveSubject(nextSubject);
    setActiveQuestionType(nextQuestionType);
    setActiveTag("");
    setEssayModalOpen(false);
    setImportModalOpen(false);
    setPracticeQuestion(null);
    setPracticeResult(null);
    setTagQuestion(null);
    setMessage(`已切换到${getSubjectMeta(nextSubject).label}页面`);
  }

  function switchQuestionType(questionType: string) {
    stopEssayListReading();
    stopPracticeEssayReading();
    window.history.pushState({}, "", buildHomeHref(activeSubject, questionType));
    setActiveQuestionType(questionType);
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
    setImportStatus(`已填入${activeSubjectMeta.label}示例 JSON，可先校验再导入。`);
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

  function openEssayModal(question?: Question) {
    stopEssayListReading();
    setEssayModalOpen(true);
    setEditingEssayQuestion(question ?? null);
    setEssayTitle(question?.title ?? "");
    setEssayTopic(question?.topic ?? "");
    setEssaySelectedWords(question ? extractUnderlinedWords(question.stem) : []);
    setEssayStatus(
      question
        ? "可以继续修改正文、增减下划线单词，保存后会覆盖这道英文作文题。"
        : "左边粘贴作文内容，选中文字后点“添加下划线出题”，右边会同步生成答题词。"
    );
    if (essayStemRef.current) {
      essayStemRef.current.innerHTML = question ? sanitizeRichHtml(question.stem) : "";
    }
    essaySelectionRangeRef.current = null;
  }

  function closeEssayModal() {
    setEssayModalOpen(false);
    setEditingEssayQuestion(null);
    setEssayTitle("");
    setEssayTopic("");
    setEssaySelectedWords([]);
    setEssayStatus("左边粘贴作文内容，选中文字后点“添加下划线出题”，右边会同步生成答题词。");
    if (essayStemRef.current) {
      essayStemRef.current.innerHTML = "";
    }
    essaySelectionRangeRef.current = null;
  }

  function syncEssaySelectedWordsFromEditor() {
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
      setEssayStatus("请先在左侧作文里选中要出题的单词。");
      return;
    }

    if (essaySelectionRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(essaySelectionRangeRef.current);
    }

    if (selection.rangeCount === 0 || selection.isCollapsed) {
      setEssayStatus("请先在左侧作文里选中要出题的单词。");
      return;
    }

    document.execCommand("underline");
    essayStemRef.current.innerHTML = sanitizeRichHtml(essayStemRef.current.innerHTML);
    syncEssaySelectedWordsFromEditor();
    essaySelectionRangeRef.current = null;
    setEssayStatus("已把选中的内容加入考题，下划线单词会在做题时被挖空。");
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
    setEssayStatus("已移除一个出题词。");
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
    stopPracticeEssayReading();
    setPracticeQuestion(question);
    setPracticeAnswer("");
    setEssayBlankAnswers([]);
    setPracticeResult(null);
    setPracticeHintVisible(false);
    setPracticeAnswerVisible(false);
    setPracticeEssayReading(false);
    setPracticeWordStatsVisible(false);
    setPracticeWordStats([]);
  }

  function closePracticeModal() {
    stopPracticeEssayReading();
    setPracticeQuestion(null);
    setPracticeAnswer("");
    setEssayBlankAnswers([]);
    setPracticeResult(null);
    setPracticeHintVisible(false);
    setPracticeAnswerVisible(false);
    setPracticeWordStatsVisible(false);
    setPracticeWordStats([]);
  }

  function navigatePracticeQuestion(direction: "previous" | "next") {
    const target = direction === "previous" ? previousPracticeQuestion : nextPracticeQuestion;
    if (!target) {
      return;
    }
    stopPracticeEssayReading();
    setPracticeQuestion(target);
    setPracticeAnswer("");
    setEssayBlankAnswers([]);
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
      setMessage("当前浏览器不支持作文自动朗读");
      stopEssayListReading();
      return;
    }

    if (index >= questions.length) {
      stopEssayListReading();
      setMessage("作文列表已连续朗读完成");
      return;
    }

    const question = questions[index];
    const { headerText, contentText } = buildEssaySpeechParts(question);
    const voice = pickEnglishSpeechVoice(window.speechSynthesis.getVoices(), voicePreference);

    setEssayListReading(true);
    setEssayListReadingQuestionId(question.id);
    setMessage(`正在连续朗读第 ${index + 1}/${questions.length} 篇作文...`);

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
        setMessage("作文列表连续朗读失败，请稍后重试");
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
      setMessage("作文列表连续朗读失败，请稍后重试");
    };
    window.speechSynthesis.speak(headerUtterance);
  }

  function toggleEssayListReading() {
    if (essayListReading) {
      stopEssayListReading();
      setMessage("已停止作文列表连续朗读");
      return;
    }

    if (essayListItems.length === 0) {
      setMessage("当前作文列表没有可朗读的内容");
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
      setMessage("没有找到这篇作文，无法从这里开始朗读");
      return;
    }

    stopPracticeEssayReading();
    stopEssayListReading();
    restartSpeechAfterCancel(() => {
      speakEssayListItem(essayListItems, startIndex, practiceEssayRate, practiceEssayVoice);
    });
  }

  function startPracticeEssayReading(rate: number) {
    if (!practiceQuestion || !isEnglishEssayQuestion(practiceQuestion.questionType)) {
      return;
    }

    if (!("speechSynthesis" in window)) {
      setMessage("当前浏览器不支持作文自动朗读");
      return;
    }

    const speechText = buildEssaySpeechText(practiceQuestion);
    if (!speechText) {
      setMessage("这道作文题还没有可朗读的内容");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1;

    const voice = pickEnglishSpeechVoice(window.speechSynthesis.getVoices(), practiceEssayVoice);
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
      setMessage("作文朗读失败，请稍后重试");
    };

    practiceEssayUtteranceRef.current = utterance;
    setPracticeEssayReading(true);
    setMessage(`正在以 ${rate}x 速度朗读作文题目...`);
    restartSpeechAfterCancel(() => {
      window.speechSynthesis.speak(utterance);
    });
  }

  function togglePracticeEssayReading() {
    if (practiceEssayReading) {
      stopPracticeEssayReading();
      setMessage("已停止作文朗读");
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
    setMessage(`作文朗读速度已切换到 ${nextRate}x`);
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

    setMessage(`作文朗读声音已切换到${nextVoice === "male" ? "男声" : "女声"}`);
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

  function openUploadPicker(subject: string) {
    setPendingUploadSubject(subject);
    setUploadMenuOpen(false);
    fileInputRef.current?.click();
  }

  function toggleUploadMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setUploadMenuOpen((current) => !current);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !pendingUploadSubject) {
      event.target.value = "";
      return;
    }
    if (files.length > 50) {
      setMessage("一次最多上传 50 个图片文件");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${apiBase}/uploads?subject=${encodeURIComponent(pendingUploadSubject)}`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) throw new Error("upload failed");

      const data: UploadResponse = await response.json();
      const uploadedItems = data.items ?? [];
      if (!uploadedItems.length) throw new Error("empty upload result");
      const displayItems = data.combinedItems?.length ? data.combinedItems : uploadedItems;

      setUploadLinks((current) => [
        ...mergeUploadLinks(
          current,
          data.history
            ? [
                {
                  ...data.history,
                  href: data.history.href ?? buildGalleryHref(pendingUploadSubject, data.history.batchId)
                }
              ]
            : [
                {
                  id: `${Date.now()}-${uploadedItems[0].name}`,
                  subject: pendingUploadSubject,
                  createdAt: uploadedItems[0].createdAt,
                  href: buildGalleryHref(pendingUploadSubject)
                }
              ]
        )
      ]);

      if (activeSubject === pendingUploadSubject) {
        setUploads((current) => [...displayItems, ...current]);
      }

      setActiveSubject(pendingUploadSubject);
      setMessage(
        data.combinedItems?.length
          ? `${getSubjectMeta(pendingUploadSubject).label}图片上传成功，共 ${uploadedItems.length} 张，生成 ${displayItems.length} 张合并图`
          : `${getSubjectMeta(pendingUploadSubject).label}图片上传成功，共 ${uploadedItems.length} 张`
      );
    } catch (error) {
      console.error(error);
      setMessage("图片上传失败，请确认文件类型、大小或网关限制");
    } finally {
      setIsUploading(false);
      setPendingUploadSubject(null);
      event.target.value = "";
    }
  }

  async function removeQuestion(id: number) {
    if (!window.confirm("确认删除这道题目吗？")) return;
    try {
      const response = await fetch(`${apiBase}/questions/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("题目已删除");
    } catch (error) {
      console.error(error);
      setMessage("删除失败，请稍后重试");
    }
  }

  async function reloadQuestions() {
    const response = await fetch(`${apiBase}/questions`);
    if (!response.ok) throw new Error("load failed");
    const data = await response.json();
    setItems(data.items ?? []);
  }

  async function submitPracticeAnswer() {
    if (!practiceQuestion) {
      return;
    }

    const answerText = isEnglishEssayQuestion(practiceQuestion.questionType)
      ? JSON.stringify(essayBlankAnswers.map((item) => item.trim()))
      : practiceAnswer;

    if (isEnglishEssayQuestion(practiceQuestion.questionType)) {
      if (essayExercise.answers.length === 0) {
        setMessage("这道作文题暂时没有配置挖空单词");
        return;
      }
      const filledCount = essayBlankAnswers.filter((item) => item.trim()).length;
      if (filledCount !== essayExercise.answers.length) {
        setMessage("请先把所有挖空单词填写完整");
        return;
      }
    } else if (!practiceAnswer.trim()) {
      return;
    }

    setPracticeSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/questions/${practiceQuestion.id}/attempts`, {
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
      setPracticeAnswer("");
      setEssayBlankAnswers([]);
    setPracticeWordStats([]);
    setPracticeWordStatsVisible(false);
      setMessage(data.message);
    } catch (error) {
      console.error(error);
      setMessage("提交作答失败，请稍后重试");
    } finally {
      setPracticeSubmitting(false);
    }
  }

  async function togglePracticeWordStats() {
    if (!practiceQuestion || !isEnglishEssayQuestion(practiceQuestion.questionType)) {
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
      const response = await fetch(`${apiBase}/questions/${practiceQuestion.id}/essay-word-stats`);
      if (!response.ok) throw new Error("load essay word stats failed");
      const data: EssayWordStatsResponse = await response.json();
      setPracticeWordStats(data.items ?? []);
      setPracticeWordStatsVisible(true);
    } catch (error) {
      console.error(error);
      setMessage("加载单词统计失败，请稍后重试");
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
      const response = await fetch(`${apiBase}/questions/${tagQuestion.id}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tags })
      });
      if (!response.ok) throw new Error("save tags failed");

      const data: UpdateTagsResponse = await response.json();
      replaceQuestion(data);
      setTagQuestion(data);
      setTagDraft((data.tags ?? []).join(", "));
      setMessage(`已更新 ${data.title} 的标签`);
    } catch (error) {
      console.error(error);
      setMessage("保存标签失败，请稍后重试");
    } finally {
      setTagSaving(false);
    }
  }

  async function validateImportPayload() {
    if (!importPayload.trim()) {
      setImportStatus("请先粘贴需要导入的 JSON。");
      setImportErrors([]);
      setImportPreview([]);
      return;
    }

    setImportLoading(true);
    setImportStatus("正在校验 JSON...");
    try {
      const response = await fetch(`${apiBase}/questions/import/validate`, {
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
        data.valid ? `校验通过，共 ${data.count} 条，可直接导入${activeSubjectMeta.label}题库。` : "校验未通过，请先修正下面的问题。"
      );
    } catch (error) {
      console.error(error);
      setImportPreview([]);
      setImportErrors(["校验失败，请确认 JSON 格式是否正确。"]);
      setImportStatus("校验失败");
    } finally {
      setImportLoading(false);
    }
  }

  async function saveEnglishEssay() {
    const rawStem = essayStemRef.current?.innerHTML ?? "";
    const stem = sanitizeRichHtml(rawStem);
    const answerWords = extractUnderlinedWords(stem);
    const answer = JSON.stringify(answerWords);
    const nextTitle = essayTitle.trim() || htmlToPlainText(stem).slice(0, 24);
    const nextTopic = essayTopic.trim();

    if (!nextTopic || !stem) {
      setEssayStatus("请至少填写知识点，并粘贴作文题内容。");
      return;
    }
    if (answerWords.length === 0) {
      setEssayStatus("请先在左侧选中单词并添加下划线，至少配置一个考题。");
      return;
    }

    setEssaySaving(true);
    setEssayStatus(editingEssayQuestion ? "正在保存英文作文修改..." : "正在保存英文作文题...");
    try {
      const response = await fetch(`${apiBase}/questions${editingEssayQuestion ? `/${editingEssayQuestion.id}` : ""}`, {
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
          questionType: "english_essay",
          topic: nextTopic,
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
      setMessage(editingEssayQuestion ? "英文作文题已更新" : "英文作文题已添加到题库");
    } catch (error) {
      console.error(error);
      setEssayStatus("保存失败，请稍后重试。");
    } finally {
      setEssaySaving(false);
    }
  }

  async function importQuestionsFromJson() {
    if (!importPayload.trim()) {
      setImportStatus("请先粘贴需要导入的 JSON。");
      return;
    }

    setImportLoading(true);
    setImportStatus("正在导入数据库...");
    try {
      const response = await fetch(`${apiBase}/questions/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ payload: importPayload, defaultSubject: activeSubject })
      });

      const data = (await response.json()) as ImportResponse | ImportValidationResponse;
      if (!response.ok) {
        const nextErrors = "errors" in data ? data.errors ?? ["导入失败"] : ["导入失败"];
        setImportErrors(nextErrors);
        setImportStatus("导入失败，请先修正校验问题。");
        return;
      }

      const result = data as ImportResponse;
      await reloadQuestions();
      setImportErrors([]);
      setImportPreview([]);
      setImportPayload("");
      setActiveQuestionType("");
      setImportStatus(`已成功导入 ${result.importedCount} 条${activeSubjectMeta.label}题目，原始回答也已写入数据库。`);
      setMessage(`已成功导入 ${result.importedCount} 条${activeSubjectMeta.label}题目`);
      setImportModalOpen(false);
    } catch (error) {
      console.error(error);
      setImportStatus("导入失败，请检查后端服务或数据库状态。");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className={galleryMode || viewerMode ? "page-shell gallery-page" : "page-shell"}>
      <header className="topbar">
        <a className="brand brand-link" href={buildHomeHref(activeSubject, activeQuestionType)}>
          <img className="brand-mark" src="/logo.svg" alt="PSLE logo" />
          <div>
            <strong>考试题目管理系统</strong>
            <small>{settingsMode ? "系统设置与基础配置" : "按学科切换题库页面"}</small>
          </div>
        </a>

        <div className="topbar-actions">
          <nav className="subject-nav" aria-label="学科导航">
            {subjectTabs.map((item) =>
              galleryMode || viewerMode || settingsMode ? (
                <a
                  key={item.key}
                  className={item.value === activeSubject ? "nav-link active nav-anchor" : "nav-link nav-anchor"}
                  href={
                    viewerMode
                      ? buildViewerHref(item.value)
                      : galleryMode
                        ? buildGalleryHref(item.value)
                        : buildHomeHref(item.value, item.value === "English" ? "english_word_reminder" : "")
                  }
                >
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  className={item.value === activeSubject ? "nav-link active" : "nav-link"}
                  onClick={() => switchSubject(item.value)}
                >
                  {item.label}
                </button>
              )
            )}
          </nav>

          <a
            className={settingsMode ? "nav-link active nav-anchor settings-link" : "nav-link nav-anchor settings-link"}
            href={buildSettingsHref()}
          >
            设置
          </a>

          {!settingsMode && (
            <div ref={uploadMenuRef} className={uploadMenuOpen ? "upload-menu open" : "upload-menu"}>
              <button type="button" className="upload-trigger" onClick={toggleUploadMenu}>
                上传
              </button>
              <div className="upload-dropdown">
                {subjectTabs.map((item) => (
                  <button key={item.key} type="button" className="upload-option" onClick={() => openUploadPicker(item.value)}>
                    上传{item.label}图片
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {!settingsMode && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={handleFileChange}
        />
      )}

      <div className="page">
        <section className="subject-hero">
          <div>
            <p className="eyebrow">
              {settingsMode ? "系统设置" : galleryMode || viewerMode ? `${activeSubjectMeta.label}图片库` : `${activeSubjectMeta.label}题库`}
            </p>
            <h1>
              {settingsMode
                ? "提示词配置"
                : viewerMode
                  ? `${activeSubjectMeta.label}图片查看`
                  : galleryMode
                    ? `${activeSubjectMeta.label}合并长图`
                    : `${activeSubjectMeta.label}题目列表`}
            </h1>
            <p className="hero-text">
              {settingsMode
                ? "这里维护系统级提示词配置。输入内容后会自动保存到数据库，后续功能可以直接读取这份配置。"
                : viewerMode
                  ? viewerGroups.reduce((count, group) => count + group.length, 0) > 10
                    ? "当前按两张图片一组展示，每一组会尽量刚好铺满一屏，方便连续查看。"
                    : "当前只展示你点开的图片或合并图片，每一张都会按屏幕大小自适应，尽量完整显示全部内容。"
                  : galleryMode
                    ? "这里直接展示该学科的合并长图；如果还没有合成长图，就展示原始上传图片。"
                    : "右上角可以上传图片，当前学科可通过弹出面板导入 JSON；当前页还支持按题型继续筛选。"}
            </p>
          </div>
          <div className="hero-card">
            <span>数据状态</span>
            <strong>
              {settingsMode
                ? promptLoading
                  ? "读取中"
                  : promptTemplate !== savedPromptTemplate
                    ? "待保存"
                    : "已就绪"
                : importLoading
                  ? "处理中"
                : isUploading
                  ? "上传中"
                  : loading || uploadLoading
                  ? "同步中"
                  : "已就绪"}
            </strong>
            <small>{message}</small>
          </div>
        </section>

        {settingsMode ? (
          <main className="settings-layout">
            <section className="panel settings-panel">
              <div className="panel-head settings-panel-head">
                <div>
                  <h2>提示词配置</h2>
                  <p className="settings-copy">建议把后续 AI 能力需要复用的通用提示、角色说明和输出要求集中放在这里。</p>
                </div>
                <span className="settings-meta">
                  {promptUpdatedAt ? `最近保存：${formatDateTime(promptUpdatedAt)}` : "尚未保存到数据库"}
                </span>
              </div>

              <div className="settings-form">
                <label className="settings-field">
                  <span>提示词内容</span>
                  <textarea
                    className="settings-textarea"
                    value={promptTemplate}
                    onChange={(event) => setPromptTemplate(event.target.value)}
                    placeholder="例如：你是一个 PSLE 题目整理助手，需要输出结构化结果、保留学科信息、优先使用中文。"
                    rows={14}
                  />
                </label>

                <div className="settings-footer">
                  <span className="settings-status">{promptTemplate !== savedPromptTemplate ? "输入后 600ms 自动保存" : promptStatus}</span>
                  <span className="settings-status subtle">当前字数：{promptTemplate.length}</span>
                </div>
              </div>
            </section>
          </main>
        ) : viewerMode ? (
          <section className="panel viewer-page-panel">
            {uploadLoading ? (
              <p className="empty-copy">正在加载图片...</p>
            ) : viewerGroups.length ? (
              <div className="viewer-groups">
                {viewerGroups.map((group, groupIndex) => (
                  <section
                    key={`${group[0].url}-${groupIndex}`}
                    id={`viewer-group-${groupIndex}`}
                    className={group.length === 1 ? "viewer-group single" : "viewer-group"}
                  >
                    {group.map((item) => (
                      <a key={item.url} className="viewer-image-card" href={item.url} target="_blank" rel="noreferrer">
                        <img src={item.url} alt={item.name} loading="lazy" />
                        <div className="viewer-image-meta">{formatDateTime(item.createdAt)}</div>
                      </a>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <p className="empty-copy">这个学科还没有上传图片。</p>
            )}
          </section>
        ) : galleryMode ? (
          <section className="panel gallery-page-panel">
            {uploadLoading ? (
              <p className="empty-copy">正在加载图片...</p>
            ) : uploads.length ? (
              <div className="gallery-long-list">
                {uploads.map((item) => (
                  <a key={item.url} className="gallery-long-card" href={item.url} target="_blank" rel="noreferrer">
                    <img src={item.url} alt={item.name} loading="lazy" />
                    <div className="gallery-long-meta">{formatDateTime(item.createdAt)}</div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="empty-copy">这个学科还没有上传图片。</p>
            )}
          </section>
        ) : (
          <main className="content-layout">
            <section className="panel question-panel">
              <div className="panel-head">
                <h2>{activeSubjectMeta.label}题目列表</h2>
                <div className="question-panel-actions">
                  {activeSubject === "English" && (
                    <button type="button" className="secondary" onClick={() => openEssayModal()}>
                      新增英文作文
                    </button>
                  )}
                  {activeSubject === "English" && activeQuestionType === "english_essay" && (
                    <div
                      ref={essayListSpeechMenuRef}
                      className={essayListSpeechMenuOpen ? "speech-menu open" : "speech-menu"}
                      onMouseEnter={() => openSpeechMenu("list")}
                    >
                      <button type="button" className="link speech-menu-trigger" onClick={() => toggleSpeechMenu("list")}>
                        朗读...
                      </button>
                      <div className="speech-menu-panel">
                        <div className="speech-rate-group" aria-label="作文朗读声音">
                          {essaySpeechVoiceOptions.map((voice) => (
                            <button
                              key={`list-voice-${voice}`}
                              type="button"
                              className={practiceEssayVoice === voice ? "speech-rate-chip active" : "speech-rate-chip"}
                              onClick={() => updatePracticeEssayVoice(voice)}
                            >
                              {voice === "male" ? "男声" : "女声"}
                            </button>
                          ))}
                        </div>
                        <button type="button" className="secondary speech-menu-action" onClick={toggleEssayListReading}>
                          {essayListReading ? "停止连续朗读" : "连续朗读作文"}
                        </button>
                        <div className="speech-rate-group" aria-label="作文列表朗读速度">
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
                    导入{activeSubjectMeta.label} JSON
                  </button>
                  <button className="secondary" onClick={() => window.location.reload()}>
                    刷新
                  </button>
                </div>
              </div>

              <div className="type-nav" aria-label="题型导航">
                {activeSubject === "English" ? (
                  englishQuestionTypes.map((questionType) => (
                    <button
                      key={questionType}
                      type="button"
                      className={activeQuestionType === questionType ? "type-chip active" : "type-chip"}
                      onClick={() => switchQuestionType(questionType)}
                    >
                      {questionType === "english_essay" ? "作文列表" : getQuestionTypeLabel(questionType)}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      className={activeQuestionType === "" ? "type-chip active" : "type-chip"}
                      onClick={() => switchQuestionType("")}
                    >
                      全部题型
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

              <div className="type-nav tag-nav" aria-label="标签导航">
                <button
                  type="button"
                  className={activeTag === "" ? "type-chip active" : "type-chip"}
                  onClick={() => setActiveTag("")}
                >
                  全部标签
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
                  placeholder={`搜索${activeSubjectMeta.label}题目编号、标题、题干、知识点或标签`}
                />
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">全部状态</option>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="archived">已归档</option>
                </select>
                <button onClick={() => setMessage(`${activeSubjectMeta.label}题库共 ${filteredItems.length} 道题目`)}>
                  查看结果
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>题目信息</th>
                      <th>题型</th>
                      <th>知识点</th>
                      {showWordColumns && <th>单词</th>}
                      {showWordColumns && <th>例句</th>}
                      <th>标签</th>
                      <th>答对/作答</th>
                      <th>难度</th>
                      <th>状态</th>
                      <th>更新时间</th>
                      <th>操作</th>
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
                            {item.questionType === "english_essay" && (
                              <button type="button" className="link question-summary-link" onClick={() => startEssayListReadingFrom(item.id)}>
                                从这开始朗读
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
                              <span className="muted-text">未设标签</span>
                            )}
                          </div>
                        </td>
                        <td>{`${item.correctCount ?? 0}/${item.attemptsCount ?? 0}`}</td>
                        <td>{item.difficulty}</td>
                        <td>{item.status}</td>
                        <td>{formatDateTime(item.updatedAt)}</td>
                        <td className="actions">
                          <button className="link" onClick={() => openPracticeModal(item)}>
                            做题
                          </button>
                          {item.questionType === "english_essay" && (
                            <button className="link" onClick={() => openEssayModal(item)}>
                              编辑
                            </button>
                          )}
                          <button className="link" onClick={() => openTagModal(item)}>
                            标签
                          </button>
                          <button className="link danger" onClick={() => void removeQuestion(item.id)}>
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredItems.length && (
                      <tr>
                        <td colSpan={showWordColumns ? 11 : 9} className="empty">
                          当前学科暂无题目
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
                      <h2 id="import-modal-title">{activeSubjectMeta.label} JSON 导入</h2>
                      <p className="panel-tip panel-tip-inline">
                        字段要求：建议统一使用 `questionType / topic / problemDescription / answer / childAnswer`；英文单词提醒补 `word / exampleSentence`，英文选择题补 `optionItems`；`childAnswer` 可留空，`subject` 可省略，中文字段仍兼容。
                      </p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeImportModal}>
                      关闭
                    </button>
                  </div>

                  <label className="import-field">
                    <span>粘贴导入 JSON</span>
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
                      填入示例
                    </button>
                    <button type="button" className="secondary" onClick={() => void validateImportPayload()} disabled={importLoading}>
                      校验 JSON
                    </button>
                    <button type="button" onClick={() => void importQuestionsFromJson()} disabled={importLoading}>
                      导入数据库
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
                      <div className="import-preview-head">校验预览（前 5 条）</div>
                      {importPreview.slice(0, 5).map((item) => (
                        <div key={`${item.index}-${item.generatedCode}`} className="import-preview-item">
                          <strong>{item.generatedTitle}</strong>
                          <span>
                            {getSubjectMeta(item.subject).label} / {getQuestionTypeLabel(item.questionType)}
                          </span>
                          <small>知识点：{item.topic}</small>
                          {item.reminderWord && <small>单词：{item.reminderWord}</small>}
                          {item.exampleSentence && <small>例句：{item.exampleSentence}</small>}
                          {item.optionItems?.length > 0 && <small>选项：{item.optionItems.join(" / ")}</small>}
                          <small>答案：{item.answer || "-"}</small>
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
                      <h2>{editingEssayQuestion ? "编辑英文作文" : "新增英文作文"}</h2>
                      <p className="panel-tip panel-tip-inline">左边粘贴作文内容，选中文字后一键加下划线；右边会同步生成做题答案框，可继续修改或删除。</p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeEssayModal}>
                      关闭
                    </button>
                  </div>

                  <div className="essay-form-grid">
                    <label className="import-field">
                      <span>标题</span>
                      <input value={essayTitle} onChange={(event) => setEssayTitle(event.target.value)} placeholder="可选；不填会自动从作文内容生成" />
                    </label>
                    <label className="import-field">
                      <span>知识点</span>
                      <input value={essayTopic} onChange={(event) => setEssayTopic(event.target.value)} placeholder="例如：argumentative essay / formal letter" />
                    </label>
                  </div>

                  <div className="essay-editor-layout">
                    <section className="essay-editor-pane">
                      <div className="essay-editor-toolbar">
                        <button type="button" className="secondary" onMouseDown={(event) => event.preventDefault()} onClick={addUnderlineQuestionWord}>
                          给选中文字加下划线
                        </button>
                        <span className="panel-tip">先在左侧选中单词，再点这个按钮</span>
                      </div>

                      <label className="import-field">
                        <span>作文题内容</span>
                        <div
                          ref={essayStemRef}
                          className="rich-editor essay-editor-main"
                          contentEditable
                          suppressContentEditableWarning
                          data-placeholder="在这里直接粘贴英文作文题内容，原有粗体和高亮会尽量保留"
                          onMouseUp={rememberEssaySelection}
                          onKeyUp={rememberEssaySelection}
                          onInput={syncEssaySelectedWordsFromEditor}
                        />
                      </label>
                    </section>

                    <section className="essay-answer-pane">
                      <div className="essay-answer-head">
                        <strong>答题框</strong>
                        <span className="panel-tip">右侧每一项就是学生做题时要填写的单词</span>
                      </div>

                      {essaySelectedWords.length > 0 ? (
                        <div className="essay-selected-list">
                          {essaySelectedWords.map((word, index) => (
                            <div key={`${index}-${word}`} className="essay-selected-item">
                              <span>{index + 1}</span>
                              <input value={word} onChange={(event) => updateEssaySelectedWord(index, event.target.value)} />
                              <button type="button" className="link danger" onClick={() => removeEssaySelectedWord(index)}>
                                删除
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-copy">还没有出题词。先在左侧选中文字，再点“给选中文字加下划线”。</p>
                      )}
                    </section>
                  </div>

                  <div className="import-actions">
                    <button type="button" onClick={() => void saveEnglishEssay()} disabled={essaySaving}>
                      {editingEssayQuestion ? "保存修改" : "保存作文"}
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
                      关闭
                    </button>
                  </div>

                  <div className="practice-meta">
                    <span>累计作答 {practiceQuestion.attemptsCount} 次</span>
                    <span>答对 {practiceQuestion.correctCount} 次</span>
                    {(practiceQuestion.tags ?? []).map((tag) => (
                      <span key={tag} className="tag-pill static">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isEnglishEssayQuestion(practiceQuestion.questionType) ? (
                    <div className="practice-essay-layout">
                      <div
                        className="practice-stem rich-render"
                        dangerouslySetInnerHTML={{
                          __html: essayExercise.html || "<p>-</p>"
                        }}
                      />

                      <label className="import-field practice-essay-answer-field">
                        <span>填写被挖空的单词</span>
                        <div className="essay-answer-grid essay-answer-grid-vertical">
                          {essayExercise.answers.map((_, index) => (
                            <label key={index} className="essay-answer-item essay-answer-item-inline">
                              <span>{index + 1}</span>
                              <input
                                value={essayBlankAnswers[index] ?? ""}
                                onChange={(event) =>
                                  setEssayBlankAnswers((current) => {
                                    const next = [...current];
                                    next[index] = event.target.value;
                                    return next;
                                  })
                                }
                                placeholder="输入单词"
                              />
                            </label>
                          ))}
                        </div>
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
                            ? "选择正确答案"
                            : isEnglishWordReminderQuestion(practiceQuestion.questionType)
                            ? "填写被隐藏的英文单词"
                            : isObjectiveQuestionType(practiceQuestion.questionType)
                              ? "输入你的答案"
                              : "输入你的回答"}
                        </span>
                        {isEnglishSingleChoiceQuestion(practiceQuestion.questionType) ? (
                          <input value={practiceAnswer} readOnly placeholder="点击上方选项进行作答" />
                        ) : (
                          <textarea
                            className="import-textarea"
                            value={practiceAnswer}
                            onChange={(event) => setPracticeAnswer(event.target.value)}
                            placeholder={
                              isEnglishWordReminderQuestion(practiceQuestion.questionType)
                                ? "请输入缺失的英文单词"
                                : isObjectiveQuestionType(practiceQuestion.questionType)
                                  ? "例如：A 或 A,C"
                                  : "请输入你的回答"
                            }
                            rows={isEnglishWordReminderQuestion(practiceQuestion.questionType) ? 3 : 6}
                          />
                        )}
                      </label>
                    </>
                  )}

                  {isEnglishWordReminderQuestion(practiceQuestion.questionType) && (
                    <div className="practice-hint-block">
                      <button type="button" className="link" onClick={() => setPracticeHintVisible((current) => !current)}>
                        {practiceHintVisible ? "隐藏提示" : "显示提示"}
                      </button>
                      {practiceHintVisible && (
                        <span className="practice-hint-text">提示：{buildReminderHint(practiceQuestion.reminderWord || practiceQuestion.answer)}</span>
                      )}
                    </div>
                  )}

                  <div className="practice-hint-block">
                    {isEnglishEssayQuestion(practiceQuestion.questionType) && (
                      <div
                        ref={practiceSpeechMenuRef}
                        className={practiceSpeechMenuOpen ? "speech-menu open" : "speech-menu"}
                        onMouseEnter={() => openSpeechMenu("practice")}
                      >
                        <button type="button" className="link speech-menu-trigger" onClick={() => toggleSpeechMenu("practice")}>
                          朗读...
                        </button>
                        <div className="speech-menu-panel">
                          <div className="speech-rate-group" aria-label="朗读声音">
                            {essaySpeechVoiceOptions.map((voice) => (
                              <button
                                key={`practice-voice-${voice}`}
                                type="button"
                                className={practiceEssayVoice === voice ? "speech-rate-chip active" : "speech-rate-chip"}
                                onClick={() => updatePracticeEssayVoice(voice)}
                              >
                                {voice === "male" ? "男声" : "女声"}
                              </button>
                            ))}
                          </div>
                          <button type="button" className="secondary speech-menu-action" onClick={togglePracticeEssayReading}>
                            {practiceEssayReading ? "停止朗读" : "朗读作文"}
                          </button>
                          <div className="speech-rate-group" aria-label="朗读速度">
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
                    )}
                    <button type="button" className="link" onClick={() => setPracticeAnswerVisible((current) => !current)}>
                      {practiceAnswerVisible ? "隐藏答案" : "显示答案"}
                    </button>
                    {isEnglishEssayQuestion(practiceQuestion.questionType) && (
                      <button type="button" className="link" onClick={() => void togglePracticeWordStats()}>
                        {practiceWordStatsVisible ? "隐藏单词统计" : "查看单词统计"}
                      </button>
                    )}
                  </div>

                  {isEnglishEssayQuestion(practiceQuestion.questionType) && practiceWordStatsVisible && (
                    <div className="practice-result">
                      <strong>{practiceWordStatsLoading ? "正在加载单词统计..." : "单词成功次数 / 总次数"}</strong>
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
                      disabled={!previousPracticeQuestion || practiceSubmitting}
                    >
                      上一题
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => navigatePracticeQuestion("next")}
                      disabled={!nextPracticeQuestion || practiceSubmitting}
                    >
                      下一题
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitPracticeAnswer()}
                      disabled={
                        practiceSubmitting ||
                        (isEnglishEssayQuestion(practiceQuestion.questionType)
                          ? essayExercise.answers.length === 0
                          : !practiceAnswer.trim())
                      }
                    >
                      提交作答
                    </button>
                  </div>

                  {practiceAnswerVisible &&
                    (isEnglishEssayQuestion(practiceQuestion.questionType) ? (
                      <div className="practice-result">
                        <strong>参考答案</strong>
                        <div className="essay-correct-list">
                          {parseEssayCorrectAnswer(practiceResult?.correctAnswer || practiceQuestion.answer).map((line) => (
                            <div key={line}>{line}</div>
                          ))}
                        </div>
                      </div>
                    ) : isRichTextQuestionType(practiceQuestion.questionType) ? (
                      <div className="practice-result">
                        <strong>参考答案</strong>
                        <div
                          className="rich-render practice-reference-answer"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(practiceResult?.correctAnswer || practiceQuestion.answer) || "<p>-</p>" }}
                        />
                      </div>
                    ) : (
                      <div className="practice-result">
                        <strong>参考答案</strong>
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
                        <div>例句原文：{practiceQuestion.exampleSentence}</div>
                      )}
                      {isEnglishEssayQuestion(practiceQuestion.questionType) ? (
                        <>
                          <div>你的答案：</div>
                          <div className="essay-correct-list">
                            {parseEssayCorrectAnswer(practiceResult.attempt.answerText).map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                          <div>正确答案：</div>
                          <div className="essay-correct-list">
                            {parseEssayCorrectAnswer(practiceResult.correctAnswer).map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                        </>
                      ) : isRichTextQuestionType(practiceQuestion.questionType) ? (
                        <div>
                          <div>你的答案：{practiceResult.attempt.answerText}</div>
                          <div>参考答案：</div>
                          <div
                            className="rich-render practice-reference-answer"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(practiceResult.correctAnswer) || "<p>-</p>" }}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            你的答案：
                            {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                              ? resolveChoiceAnswerLabel(practiceQuestion, practiceResult.attempt.answerText)
                              : practiceResult.attempt.answerText}
                          </div>
                          <div>
                            参考答案：
                            {isEnglishSingleChoiceQuestion(practiceQuestion.questionType)
                              ? resolveChoiceAnswerLabel(practiceQuestion, practiceResult.correctAnswer)
                              : practiceResult.correctAnswer}
                          </div>
                        </>
                      )}
                      {!isObjectiveQuestionType(practiceQuestion.questionType) && practiceQuestion.analysis && (
                        <div>解析：{practiceQuestion.analysis}</div>
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
                      <p className="panel-tip panel-tip-inline">用逗号分隔多个标签，保存后可直接用于快速过滤。</p>
                    </div>
                    <button type="button" className="secondary import-close" onClick={closeTagModal}>
                      关闭
                    </button>
                  </div>

                  <label className="import-field">
                    <span>标签</span>
                    <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="例如：易错题, 期中复习, 分数" />
                  </label>

                  <div className="import-actions">
                    <button type="button" onClick={() => void saveQuestionTags()} disabled={tagSaving}>
                      保存标签
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

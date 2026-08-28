package question

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/questions", h.list)
	mux.HandleFunc("POST /api/questions", h.create)
	mux.HandleFunc("POST /api/questions/import/validate", h.validateImport)
	mux.HandleFunc("POST /api/questions/import", h.importQuestions)
	mux.HandleFunc("GET /api/questions/{id}/essay-word-stats", h.essayWordStats)
	mux.HandleFunc("POST /api/questions/{id}/attempts", h.submitAttempt)
	mux.HandleFunc("PUT /api/questions/{id}/tags", h.updateTags)
	mux.HandleFunc("GET /api/questions/{id}", h.get)
	mux.HandleFunc("PUT /api/questions/{id}", h.update)
	mux.HandleFunc("DELETE /api/questions/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	filter := ListFilter{
		Keyword:      r.URL.Query().Get("keyword"),
		Subject:      r.URL.Query().Get("subject"),
		Status:       r.URL.Query().Get("status"),
		QuestionType: r.URL.Query().Get("questionType"),
	}

	questions, err := h.repo.List(r.Context(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list questions")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": questions})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	q, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get question")
		return
	}

	writeJSON(w, http.StatusOK, q)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeInput(w, r)
	if !ok {
		return
	}

	q, err := h.repo.Create(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create question")
		return
	}

	writeJSON(w, http.StatusCreated, q)
}

func (h *Handler) validateImport(w http.ResponseWriter, r *http.Request) {
	inputs, validation, ok := decodeImportPayload(w, r)
	if !ok {
		return
	}

	preview := buildImportPreview(inputs)
	validation.Valid = len(validation.Errors) == 0
	validation.Count = len(preview)
	validation.Items = preview
	writeJSON(w, http.StatusOK, validation)
}

func (h *Handler) importQuestions(w http.ResponseWriter, r *http.Request) {
	inputs, validation, ok := decodeImportPayload(w, r)
	if !ok {
		return
	}
	if len(validation.Errors) > 0 {
		validation.Valid = false
		validation.Count = 0
		writeJSON(w, http.StatusBadRequest, validation)
		return
	}

	result, err := h.repo.Import(r.Context(), inputs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to import questions")
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	input, ok := decodeInput(w, r)
	if !ok {
		return
	}

	q, err := h.repo.Update(r.Context(), id, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update question")
		return
	}

	writeJSON(w, http.StatusOK, q)
}

func (h *Handler) updateTags(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	var input UpdateTagsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	q, err := h.repo.UpdateTags(r.Context(), id, input.Tags)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update question tags")
		return
	}

	writeJSON(w, http.StatusOK, q)
}

func (h *Handler) submitAttempt(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	var input SubmitAttemptInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}
	input.AnswerText = strings.TrimSpace(input.AnswerText)
	if input.AnswerText == "" {
		writeError(w, http.StatusBadRequest, "answerText is required")
		return
	}

	result, err := h.repo.SubmitAttempt(r.Context(), id, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to submit attempt")
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func (h *Handler) essayWordStats(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	result, err := h.repo.EssayWordStats(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load essay word stats")
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "question not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete question")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid question id")
		return 0, false
	}

	return id, true
}

func decodeInput(w http.ResponseWriter, r *http.Request) (SaveQuestionInput, bool) {
	var input SaveQuestionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return SaveQuestionInput{}, false
	}

	input.Code = strings.TrimSpace(input.Code)
	input.Title = strings.TrimSpace(input.Title)
	input.Subject = strings.TrimSpace(input.Subject)
	input.GradeLevel = strings.TrimSpace(input.GradeLevel)
	input.Difficulty = strings.TrimSpace(input.Difficulty)
	input.QuestionType = strings.TrimSpace(input.QuestionType)
	input.Topic = strings.TrimSpace(input.Topic)
	input.ReminderWord = strings.TrimSpace(input.ReminderWord)
	input.ExampleSentence = strings.TrimSpace(input.ExampleSentence)
	input.OptionItems = normalizeOptionItems(input.OptionItems)
	input.Stem = strings.TrimSpace(input.Stem)
	input.Answer = strings.TrimSpace(input.Answer)
	input.Analysis = strings.TrimSpace(input.Analysis)
	input.Status = strings.TrimSpace(input.Status)

	if input.GradeLevel == "" {
		input.GradeLevel = "PSLE"
	}
	if input.Difficulty == "" {
		input.Difficulty = "medium"
	}
	if input.QuestionType == "" {
		input.QuestionType = "single_choice"
	}
	if input.Status == "" {
		input.Status = "draft"
	}

	if input.QuestionType == "english_word_reminder" {
		if input.ReminderWord != "" && input.Answer == "" {
			input.Answer = input.ReminderWord
		}
		if input.ExampleSentence != "" && input.Stem == "" {
			input.Stem = input.ExampleSentence
		}
		if input.Title == "" {
			input.Title = "英文单词提醒"
		}
	}
	if input.QuestionType == "english_single_choice" {
		if input.Title == "" {
			input.Title = buildManualTitle(input.QuestionType, input.Stem)
		}
	}
	if input.QuestionType == "english_common_sentence" {
		if input.Title == "" {
			input.Title = buildManualTitle(input.QuestionType, input.Stem)
		}
		if input.Answer == "" {
			input.Answer = input.Stem
		}
	}
	if input.QuestionType == "english_synthesis" {
		if input.Title == "" {
			input.Title = buildManualTitle(input.QuestionType, input.Stem)
		}
		if input.Answer == "" {
			input.Answer = stripHTML(input.Stem)
		}
	}
	if input.QuestionType == "english_essay" || input.QuestionType == "english_comprehension_close" {
		if input.Title == "" {
			input.Title = buildManualTitle(input.QuestionType, input.Stem)
		}
	}
	if input.Code == "" && input.Subject != "" {
		input.Code = buildManualCode(input.Subject, input.QuestionType, time.Now())
	}

	if input.QuestionType == "english_common_sentence" {
		if input.Title == "" || input.Subject == "" || input.Stem == "" {
			writeError(w, http.StatusBadRequest, "title, subject and stem are required")
			return SaveQuestionInput{}, false
		}
	} else if input.QuestionType == "english_synthesis" {
		if input.Title == "" || input.Subject == "" || input.ExampleSentence == "" || input.Stem == "" || input.Answer == "" {
			writeError(w, http.StatusBadRequest, "title, subject, exampleSentence, stem and answer are required")
			return SaveQuestionInput{}, false
		}
	} else if input.QuestionType == "english_essay" || input.QuestionType == "english_comprehension_close" {
		if input.Title == "" || input.Subject == "" || input.Stem == "" || input.Answer == "" {
			writeError(w, http.StatusBadRequest, "title, subject, stem and answer are required")
			return SaveQuestionInput{}, false
		}
	} else if input.Code == "" || input.Title == "" || input.Subject == "" || input.Stem == "" || input.Answer == "" {
		writeError(w, http.StatusBadRequest, "code, title, subject, stem and answer are required")
		return SaveQuestionInput{}, false
	}
	if input.QuestionType == "english_word_reminder" && (input.ReminderWord == "" || input.ExampleSentence == "") {
		writeError(w, http.StatusBadRequest, "english_word_reminder requires reminderWord and exampleSentence")
		return SaveQuestionInput{}, false
	}
	if input.QuestionType == "english_single_choice" {
		if input.Subject != "English" {
			writeError(w, http.StatusBadRequest, "english_single_choice only supports English subject")
			return SaveQuestionInput{}, false
		}
		if len(input.OptionItems) < 2 {
			writeError(w, http.StatusBadRequest, "english_single_choice requires at least two optionItems")
			return SaveQuestionInput{}, false
		}
		if !choiceAnswerMatchesOptions(input.Answer, input.OptionItems) {
			writeError(w, http.StatusBadRequest, "english_single_choice answer must match one option")
			return SaveQuestionInput{}, false
		}
	}
	if input.QuestionType == "english_comprehension_close" && input.Subject != "English" {
		writeError(w, http.StatusBadRequest, "english_comprehension_close only supports English subject")
		return SaveQuestionInput{}, false
	}
	if input.QuestionType == "english_common_sentence" && input.Subject != "English" {
		writeError(w, http.StatusBadRequest, "english_common_sentence only supports English subject")
		return SaveQuestionInput{}, false
	}
	if input.QuestionType == "english_synthesis" && input.Subject != "English" {
		writeError(w, http.StatusBadRequest, "english_synthesis only supports English subject")
		return SaveQuestionInput{}, false
	}

	return input, true
}

func buildManualTitle(questionType, stem string) string {
	plain := strings.TrimSpace(stripHTML(stem))
	if plain == "" {
		if questionType == "english_comprehension_close" {
			return "Comprehension Close"
		}
		if questionType == "english_synthesis" {
			return "Synthesis"
		}
		if questionType == "english_common_sentence" {
			return "Common Sentence"
		}
		return "English Essay"
	}

	runes := []rune(plain)
	if len(runes) <= 24 {
		return plain
	}
	return string(runes[:24]) + "..."
}

func stripHTML(raw string) string {
	withoutBreaks := strings.NewReplacer("<br>", "\n", "<br/>", "\n", "<br />", "\n", "</p>", "\n", "</div>", "\n").Replace(raw)
	withoutTags := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(withoutBreaks, "")
	return strings.TrimSpace(withoutTags)
}

func decodeImportPayload(w http.ResponseWriter, r *http.Request) ([]ImportQuestionInput, ImportValidationResult, bool) {
	var payload ImportPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return nil, ImportValidationResult{}, false
	}

	inputs, validation, err := parseImportPayload(payload.Payload, payload.DefaultSubject)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return nil, ImportValidationResult{}, false
	}

	return inputs, validation, true
}

func parseImportPayload(raw string, defaultSubjectRaw string) ([]ImportQuestionInput, ImportValidationResult, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, ImportValidationResult{}, errors.New("导入内容不能为空")
	}

	defaultSubject := ""
	if strings.TrimSpace(defaultSubjectRaw) != "" {
		normalized, subjectErr := normalizeSubject(defaultSubjectRaw)
		if subjectErr != "" {
			return nil, ImportValidationResult{}, errors.New("默认科目无效")
		}
		defaultSubject = normalized
	}

	var body any
	if err := json.Unmarshal([]byte(raw), &body); err != nil {
		return nil, ImportValidationResult{}, fmt.Errorf("JSON 解析失败: %w", err)
	}

	var records []any
	switch typed := body.(type) {
	case []any:
		records = typed
	case map[string]any:
		items, ok := typed["items"].([]any)
		if !ok {
			return nil, ImportValidationResult{}, errors.New("JSON 顶层需要是数组，或者包含 items 数组")
		}
		records = items
	default:
		return nil, ImportValidationResult{}, errors.New("JSON 顶层需要是数组，或者包含 items 数组")
	}

	inputs := make([]ImportQuestionInput, 0, len(records))
	validation := ImportValidationResult{
		Errors: make([]string, 0),
	}
	for index, record := range records {
		item, ok := record.(map[string]any)
		if !ok {
			validation.Errors = append(validation.Errors, fmt.Sprintf("第 %d 条不是对象", index+1))
			continue
		}

		input, errs := normalizeImportItem(item, defaultSubject)
		if len(errs) > 0 {
			for _, err := range errs {
				validation.Errors = append(validation.Errors, fmt.Sprintf("第 %d 条: %s", index+1, err))
			}
			continue
		}

		inputs = append(inputs, input)
	}

	return inputs, validation, nil
}

func normalizeImportItem(item map[string]any, defaultSubject string) (ImportQuestionInput, []string) {
	subjectRaw := getString(item, "科目", "subject")
	if strings.TrimSpace(subjectRaw) == "" {
		subjectRaw = defaultSubject
	}

	subject, subjectErr := normalizeSubject(subjectRaw)
	questionType := normalizeQuestionType(getString(item, "题型", "questionType", "type"))
	topic := strings.TrimSpace(getString(item, "topic", "Topic", "知识点", "课本知识点"))
	reminderWord := strings.TrimSpace(getString(item, "单词", "word", "reminderWord"))
	exampleSentence := strings.TrimSpace(getString(item, "原句", "originalSentence", "sourceSentence", "例句", "sentence", "exampleSentence"))
	optionItems := parseOptionItems(item)
	problemDesc := strings.TrimSpace(getString(item, "问题描述", "题目", "problemDescription", "stem"))
	answer := strings.TrimSpace(getString(item, "答案", "answer"))
	childAnswer := strings.TrimSpace(getString(item, "小朋友的回答", "小朋友 de回答", "学生回答", "childAnswer", "studentAnswer"))

	if questionType == "english_word_reminder" {
		if answer == "" {
			answer = reminderWord
		}
		if problemDesc == "" {
			problemDesc = exampleSentence
		}
	}

	errs := make([]string, 0, 8)
	if subjectErr != "" {
		errs = append(errs, subjectErr)
	}
	if questionType == "" {
		errs = append(errs, "缺少题型")
	}
	if questionType == "english_word_reminder" && subject == "English" {
		// valid
	} else if questionType == "english_single_choice" && subject == "English" {
		// valid
	} else if questionType == "english_comprehension_close" && subject == "English" {
		// valid
	} else if questionType == "english_synthesis" && subject == "English" {
		// valid
	} else if questionType == "english_common_sentence" && subject == "English" {
		// valid
	} else if questionType == "english_word_reminder" {
		errs = append(errs, "英文单词提醒只支持英文学科")
	} else if questionType == "english_single_choice" {
		errs = append(errs, "英文选择题只支持英文学科")
	} else if questionType == "english_comprehension_close" {
		errs = append(errs, "Comprehension Close 只支持英文学科")
	} else if questionType == "english_synthesis" {
		errs = append(errs, "Synthesis 只支持英文学科")
	} else if questionType == "english_common_sentence" {
		errs = append(errs, "常用句子只支持英文学科")
	}
	if topic == "" {
		errs = append(errs, "缺少 topic（知识点）")
	}
	if questionType == "english_word_reminder" && reminderWord == "" {
		errs = append(errs, "缺少单词")
	}
	if questionType == "english_word_reminder" && exampleSentence == "" {
		errs = append(errs, "缺少例句")
	}
	if questionType == "english_synthesis" && exampleSentence == "" {
		errs = append(errs, "缺少 originalSentence（原句）")
	}
	if questionType == "english_single_choice" && len(optionItems) < 2 {
		errs = append(errs, "英文选择题至少需要 2 个选项")
	}
	if questionType == "english_single_choice" && len(optionItems) >= 2 && !choiceAnswerMatchesOptions(answer, optionItems) {
		errs = append(errs, "英文选择题答案必须对应其中一个选项")
	}
	if problemDesc == "" {
		errs = append(errs, "缺少问题描述")
	}
	if questionType == "english_common_sentence" && answer == "" {
		answer = problemDesc
	}
	if questionType == "english_synthesis" && answer == "" {
		answer = stripHTML(problemDesc)
	}
	if answer == "" {
		errs = append(errs, "缺少答案")
	}
	if len(errs) > 0 {
		return ImportQuestionInput{}, errs
	}

	return ImportQuestionInput{
		Subject:          subject,
		QuestionType:     questionType,
		Topic:            topic,
		ReminderWord:     reminderWord,
		ExampleSentence:  exampleSentence,
		OptionItems:      optionItems,
		ProblemDesc:      problemDesc,
		Answer:           answer,
		OriginalResponse: childAnswer,
	}, nil
}

func buildImportPreview(inputs []ImportQuestionInput) []ImportPreviewItem {
	preview := make([]ImportPreviewItem, 0, len(inputs))
	batchTime := time.Now()
	for index, item := range inputs {
		preview = append(preview, ImportPreviewItem{
			Index:            index + 1,
			Subject:          item.Subject,
			QuestionType:     item.QuestionType,
			Topic:            item.Topic,
			ReminderWord:     item.ReminderWord,
			ExampleSentence:  item.ExampleSentence,
			OptionItems:      item.OptionItems,
			ProblemDesc:      item.ProblemDesc,
			Answer:           item.Answer,
			OriginalResponse: item.OriginalResponse,
			GeneratedCode:    buildImportCode(item.Subject, batchTime, index),
			GeneratedTitle:   buildImportTitle(item.QuestionType, item.ProblemDesc),
		})
	}
	return preview
}

func getString(item map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := item[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			return typed
		default:
			return strings.TrimSpace(fmt.Sprint(typed))
		}
	}
	return ""
}

func normalizeSubject(raw string) (string, string) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "mathematics", "math", "数学":
		return "Mathematics", ""
	case "chinese", "华文", "语文":
		return "Chinese", ""
	case "english", "英文", "英语":
		return "English", ""
	case "science", "科学":
		return "Science", ""
	case "":
		return "", "缺少科目"
	default:
		return "", "科目只支持 数学、华文、英文、科学"
	}
}

func normalizeQuestionType(raw string) string {
	value := strings.TrimSpace(strings.ToLower(raw))
	switch value {
	case "single_choice", "single choice", "单选", "单选题", "选择题":
		return "single_choice"
	case "multiple_choice", "multiple choice", "多选", "多选题":
		return "multiple_choice"
	case "short_answer", "short answer", "简答", "简答题":
		return "short_answer"
	case "fill_in_blank", "fill in blank", "填空", "填空题":
		return "fill_in_blank"
	case "true_false", "true false", "判断", "判断题":
		return "true_false"
	case "essay", "作文", "论述", "论述题":
		return "essay"
	case "english_essay", "english essay", "英文作文", "英语作文":
		return "english_essay"
	case "english_comprehension_close", "english comprehension close", "comprehension close", "英文完形填空", "英语完形填空", "英文 comprehension close":
		return "english_comprehension_close"
	case "english_synthesis", "english synthesis", "synthesis", "句型转换", "英文句型转换", "英语句型转换":
		return "english_synthesis"
	case "english_common_sentence", "english common sentence", "common sentence", "common sentences", "英文常用句子", "英语常用句子", "常用句子":
		return "english_common_sentence"
	case "english_word_reminder", "english word reminder", "word reminder", "英文单词提醒", "单词提醒", "英文单词":
		return "english_word_reminder"
	case "english_single_choice", "english choice", "english single choice", "英文选择题", "英语选择题":
		return "english_single_choice"
	case "":
		return ""
	default:
		return normalizeLooseType(value)
	}
}

func parseOptionItems(item map[string]any) []string {
	for _, key := range []string{"选项", "options", "optionItems", "choices"} {
		value, ok := item[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case []any:
			items := make([]string, 0, len(typed))
			for _, option := range typed {
				items = append(items, strings.TrimSpace(fmt.Sprint(option)))
			}
			return normalizeOptionItems(items)
		case []string:
			return normalizeOptionItems(typed)
		case map[string]any:
			optionKeys := make([]string, 0, len(typed))
			for optionKey := range typed {
				optionKeys = append(optionKeys, optionKey)
			}
			sort.Slice(optionKeys, func(i, j int) bool {
				return normalizeChoiceAnswer(optionKeys[i]) < normalizeChoiceAnswer(optionKeys[j])
			})
			items := make([]string, 0, len(typed))
			for _, optionKey := range optionKeys {
				option := typed[optionKey]
				items = append(items, fmt.Sprintf("%s. %s", strings.TrimSpace(optionKey), strings.TrimSpace(fmt.Sprint(option))))
			}
			return normalizeOptionItems(items)
		case string:
			parts := strings.Split(typed, "\n")
			return normalizeOptionItems(parts)
		}
	}
	return nil
}

func choiceAnswerMatchesOptions(answer string, optionItems []string) bool {
	normalizedAnswer := normalizeChoiceAnswer(answer)
	if normalizedAnswer == "" {
		return false
	}

	for _, optionItem := range optionItems {
		if normalizedAnswer == normalizeChoiceAnswer(optionItem) {
			return true
		}
	}
	return false
}

func normalizeLooseType(raw string) string {
	normalized := strings.Trim(raw, "_")
	normalized = strings.ReplaceAll(normalized, "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")
	normalized = regexp.MustCompile(`_+`).ReplaceAllString(normalized, "_")
	return normalized
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

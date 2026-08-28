package question

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
)

var ErrNotFound = errors.New("question not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureSchema(ctx context.Context) error {
	if err := ensureColumn(ctx, r.db, "questions", "topic", "ALTER TABLE questions ADD COLUMN topic VARCHAR(255) NOT NULL DEFAULT '' AFTER question_type"); err != nil {
		return fmt.Errorf("ensure questions.topic schema: %w", err)
	}
	if err := ensureColumn(ctx, r.db, "questions", "tags", "ALTER TABLE questions ADD COLUMN tags VARCHAR(1024) NOT NULL DEFAULT '[]' AFTER topic"); err != nil {
		return fmt.Errorf("ensure questions.tags schema: %w", err)
	}
	if err := ensureColumn(ctx, r.db, "questions", "reminder_word", "ALTER TABLE questions ADD COLUMN reminder_word VARCHAR(255) NOT NULL DEFAULT '' AFTER tags"); err != nil {
		return fmt.Errorf("ensure questions.reminder_word schema: %w", err)
	}
	if err := ensureColumn(ctx, r.db, "questions", "example_sentence", "ALTER TABLE questions ADD COLUMN example_sentence TEXT NOT NULL AFTER reminder_word"); err != nil {
		return fmt.Errorf("ensure questions.example_sentence schema: %w", err)
	}
	if err := ensureColumn(ctx, r.db, "questions", "option_items", "ALTER TABLE questions ADD COLUMN option_items TEXT NOT NULL AFTER example_sentence"); err != nil {
		return fmt.Errorf("ensure questions.option_items schema: %w", err)
	}

	questionAttemptsTable := `CREATE TABLE IF NOT EXISTS question_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  attempt_no INT NOT NULL DEFAULT 1,
  is_correct TINYINT(1) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_question_attempts_question_id FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_question_attempts_question_id (question_id),
  INDEX idx_question_attempts_source (source)
)`
	if _, err := r.db.ExecContext(ctx, questionAttemptsTable); err != nil {
		return fmt.Errorf("ensure question_attempts schema: %w", err)
	}
	if err := ensureColumn(ctx, r.db, "question_attempts", "is_correct", "ALTER TABLE question_attempts ADD COLUMN is_correct TINYINT(1) NULL AFTER attempt_no"); err != nil {
		return fmt.Errorf("ensure question_attempts.is_correct schema: %w", err)
	}

	return nil
}

func (r *Repository) List(ctx context.Context, filter ListFilter) ([]Question, error) {
	args := make([]any, 0, 4)
	conditions := make([]string, 0, 4)

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		conditions = append(conditions, "(code LIKE ? OR title LIKE ? OR stem LIKE ? OR topic LIKE ?)")
		pattern := "%" + keyword + "%"
		args = append(args, pattern, pattern, pattern, pattern)
	}
	if subject := strings.TrimSpace(filter.Subject); subject != "" {
		conditions = append(conditions, "subject = ?")
		args = append(args, subject)
	}
	if status := strings.TrimSpace(filter.Status); status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, status)
	}
	if questionType := strings.TrimSpace(filter.QuestionType); questionType != "" {
		conditions = append(conditions, "question_type = ?")
		args = append(args, questionType)
	}

	query := questionSelectSQL()
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(withQuestionAlias(conditions), " AND ")
	}
	query += " ORDER BY q.updated_at DESC, q.id DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query questions: %w", err)
	}
	defer rows.Close()

	questions := make([]Question, 0)
	for rows.Next() {
		q, scanErr := scanQuestion(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("scan question: %w", scanErr)
		}
		questions = append(questions, q)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate questions: %w", err)
	}

	return questions, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Question, error) {
	query := questionSelectSQL() + " WHERE q.id = ?"
	row := r.db.QueryRowContext(ctx, query, id)
	q, err := scanQuestion(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Question{}, ErrNotFound
		}
		return Question{}, fmt.Errorf("query question: %w", err)
	}

	return q, nil
}

func (r *Repository) Create(ctx context.Context, input SaveQuestionInput) (Question, error) {
	query := `INSERT INTO questions (code, title, subject, grade_level, difficulty, question_type, topic, tags, reminder_word, example_sentence, option_items, stem, answer, analysis, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	tagsValue, err := encodeTags(input.Tags)
	if err != nil {
		return Question{}, fmt.Errorf("encode tags: %w", err)
	}
	optionsValue, err := encodeOptionItems(input.OptionItems)
	if err != nil {
		return Question{}, fmt.Errorf("encode option items: %w", err)
	}
	result, err := r.db.ExecContext(ctx, query,
		input.Code,
		input.Title,
		input.Subject,
		input.GradeLevel,
		input.Difficulty,
		input.QuestionType,
		input.Topic,
		tagsValue,
		input.ReminderWord,
		input.ExampleSentence,
		optionsValue,
		input.Stem,
		input.Answer,
		input.Analysis,
		input.Status,
	)
	if err != nil {
		return Question{}, fmt.Errorf("insert question: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Question{}, fmt.Errorf("last insert id: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Update(ctx context.Context, id int64, input SaveQuestionInput) (Question, error) {
	tagsValue, err := encodeTags(input.Tags)
	if err != nil {
		return Question{}, fmt.Errorf("encode tags: %w", err)
	}
	optionsValue, err := encodeOptionItems(input.OptionItems)
	if err != nil {
		return Question{}, fmt.Errorf("encode option items: %w", err)
	}
	query := `UPDATE questions
SET code = ?, title = ?, subject = ?, grade_level = ?, difficulty = ?, question_type = ?, topic = ?, tags = ?, reminder_word = ?, example_sentence = ?, option_items = ?, stem = ?, answer = ?, analysis = ?, status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`
	result, err := r.db.ExecContext(ctx, query,
		input.Code,
		input.Title,
		input.Subject,
		input.GradeLevel,
		input.Difficulty,
		input.QuestionType,
		input.Topic,
		tagsValue,
		input.ReminderWord,
		input.ExampleSentence,
		optionsValue,
		input.Stem,
		input.Answer,
		input.Analysis,
		input.Status,
		id,
	)
	if err != nil {
		return Question{}, fmt.Errorf("update question: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return Question{}, fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return Question{}, ErrNotFound
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM questions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete question: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}

	return nil
}

func (r *Repository) UpdateTags(ctx context.Context, id int64, tags []string) (Question, error) {
	tagsValue, err := encodeTags(tags)
	if err != nil {
		return Question{}, fmt.Errorf("encode tags: %w", err)
	}

	result, err := r.db.ExecContext(ctx, `UPDATE questions
SET tags = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`, tagsValue, id)
	if err != nil {
		return Question{}, fmt.Errorf("update question tags: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return Question{}, fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return Question{}, ErrNotFound
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Import(ctx context.Context, inputs []ImportQuestionInput) (ImportResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return ImportResult{}, fmt.Errorf("begin import tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	imported := make([]Question, 0, len(inputs))
	batchTime := time.Now()
	for index, input := range inputs {
		saveInput := SaveQuestionInput{
			Code:            buildImportCode(input.Subject, batchTime, index),
			Title:           buildImportTitle(input.QuestionType, input.ProblemDesc),
			Subject:         input.Subject,
			GradeLevel:      "PSLE",
			Difficulty:      "medium",
			QuestionType:    input.QuestionType,
			Topic:           input.Topic,
			Tags:            nil,
			ReminderWord:    input.ReminderWord,
			ExampleSentence: input.ExampleSentence,
			OptionItems:     input.OptionItems,
			Stem:            input.ProblemDesc,
			Answer:          input.Answer,
			Analysis:        "通过 JSON 导入创建",
			Status:          "draft",
		}

		questionID, createErr := r.createQuestionTx(ctx, tx, saveInput)
		if createErr != nil {
			err = createErr
			return ImportResult{}, err
		}

		if strings.TrimSpace(input.OriginalResponse) != "" {
			if attemptErr := r.createAttemptTx(ctx, tx, questionID, input.OriginalResponse, "import_original", 1, nil); attemptErr != nil {
				err = attemptErr
				return ImportResult{}, err
			}
		}

		question, getErr := r.getByIDTx(ctx, tx, questionID)
		if getErr != nil {
			err = getErr
			return ImportResult{}, err
		}
		imported = append(imported, question)
	}

	if err = tx.Commit(); err != nil {
		return ImportResult{}, fmt.Errorf("commit import tx: %w", err)
	}

	return ImportResult{
		ImportedCount: len(imported),
		Questions:     imported,
	}, nil
}

func (r *Repository) createQuestionTx(ctx context.Context, tx *sql.Tx, input SaveQuestionInput) (int64, error) {
	query := `INSERT INTO questions (code, title, subject, grade_level, difficulty, question_type, topic, tags, reminder_word, example_sentence, option_items, stem, answer, analysis, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	tagsValue, err := encodeTags(input.Tags)
	if err != nil {
		return 0, fmt.Errorf("encode tags: %w", err)
	}
	optionsValue, err := encodeOptionItems(input.OptionItems)
	if err != nil {
		return 0, fmt.Errorf("encode option items: %w", err)
	}
	result, err := tx.ExecContext(ctx, query,
		input.Code,
		input.Title,
		input.Subject,
		input.GradeLevel,
		input.Difficulty,
		input.QuestionType,
		input.Topic,
		tagsValue,
		input.ReminderWord,
		input.ExampleSentence,
		optionsValue,
		input.Stem,
		input.Answer,
		input.Analysis,
		input.Status,
	)
	if err != nil {
		return 0, fmt.Errorf("insert imported question: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("last insert id: %w", err)
	}

	return id, nil
}

func (r *Repository) createAttemptTx(ctx context.Context, tx *sql.Tx, questionID int64, answerText, source string, attemptNo int, isCorrect *bool) error {
	var isCorrectValue any
	if isCorrect != nil {
		isCorrectValue = *isCorrect
	}

	_, err := tx.ExecContext(ctx, `INSERT INTO question_attempts (question_id, answer_text, source, attempt_no, is_correct)
VALUES (?, ?, ?, ?, ?)`, questionID, answerText, source, attemptNo, isCorrectValue)
	if err != nil {
		return fmt.Errorf("insert question attempt: %w", err)
	}
	return nil
}

func (r *Repository) getByIDTx(ctx context.Context, tx *sql.Tx, id int64) (Question, error) {
	row := tx.QueryRowContext(ctx, questionSelectSQL()+" WHERE q.id = ?", id)
	q, err := scanQuestion(row)
	if err != nil {
		return Question{}, fmt.Errorf("query imported question: %w", err)
	}

	return q, nil
}

func (r *Repository) SubmitAttempt(ctx context.Context, id int64, input SubmitAttemptInput) (SubmitAttemptResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SubmitAttemptResult{}, fmt.Errorf("begin attempt tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	question, err := r.getByIDTx(ctx, tx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SubmitAttemptResult{}, ErrNotFound
		}
		return SubmitAttemptResult{}, err
	}

	attemptNo, err := r.nextAttemptNoTx(ctx, tx, id)
	if err != nil {
		return SubmitAttemptResult{}, err
	}

	checked, isCorrect, message, correctAnswer := evaluateAttempt(question.QuestionType, question.Answer, question.Stem, input.AnswerText)
	if err = r.createAttemptTx(ctx, tx, id, input.AnswerText, "portal", attemptNo, isCorrect); err != nil {
		return SubmitAttemptResult{}, err
	}

	attempt, err := r.getLatestAttemptTx(ctx, tx, id)
	if err != nil {
		return SubmitAttemptResult{}, err
	}

	updatedQuestion, err := r.getByIDTx(ctx, tx, id)
	if err != nil {
		return SubmitAttemptResult{}, err
	}

	if err = tx.Commit(); err != nil {
		return SubmitAttemptResult{}, fmt.Errorf("commit attempt tx: %w", err)
	}

	return SubmitAttemptResult{
		Question:      updatedQuestion,
		Attempt:       attempt,
		Checked:       checked,
		CorrectAnswer: correctAnswer,
		Message:       message,
	}, nil
}

func (r *Repository) EssayWordStats(ctx context.Context, id int64) (EssayWordStatsResult, error) {
	question, err := r.GetByID(ctx, id)
	if err != nil {
		return EssayWordStatsResult{}, err
	}

	answers := parseEssayAnswerValues(question.Answer)
	items := make([]EssayWordStat, 0, len(answers))
	for index, word := range answers {
		items = append(items, EssayWordStat{
			Index: index + 1,
			Word:  word,
		})
	}

	rows, err := r.db.QueryContext(ctx, `SELECT answer_text FROM question_attempts WHERE question_id = ? AND source = 'portal' ORDER BY attempt_no ASC`, id)
	if err != nil {
		return EssayWordStatsResult{}, fmt.Errorf("query essay attempts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var answerText string
		if scanErr := rows.Scan(&answerText); scanErr != nil {
			return EssayWordStatsResult{}, fmt.Errorf("scan essay attempt: %w", scanErr)
		}

		submitted := parseEssayAnswerValues(answerText)
		for index := range items {
			items[index].AttemptCount++
			if index < len(submitted) && normalizeComparableAnswer(submitted[index]) == normalizeComparableAnswer(items[index].Word) {
				items[index].CorrectCount++
			}
		}
	}

	if err := rows.Err(); err != nil {
		return EssayWordStatsResult{}, fmt.Errorf("iterate essay attempts: %w", err)
	}

	return EssayWordStatsResult{
		QuestionID: id,
		Items:      items,
	}, nil
}

func (r *Repository) nextAttemptNoTx(ctx context.Context, tx *sql.Tx, questionID int64) (int, error) {
	var attemptNo int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(attempt_no), 0) + 1 FROM question_attempts WHERE question_id = ?`, questionID).Scan(&attemptNo); err != nil {
		return 0, fmt.Errorf("query next attempt no: %w", err)
	}
	return attemptNo, nil
}

func (r *Repository) getLatestAttemptTx(ctx context.Context, tx *sql.Tx, questionID int64) (QuestionAttempt, error) {
	var attempt QuestionAttempt
	var isCorrect sql.NullBool
	if err := tx.QueryRowContext(ctx, `SELECT id, question_id, answer_text, source, attempt_no, is_correct, created_at
FROM question_attempts
WHERE question_id = ?
ORDER BY id DESC
LIMIT 1`, questionID).Scan(
		&attempt.ID,
		&attempt.QuestionID,
		&attempt.AnswerText,
		&attempt.Source,
		&attempt.AttemptNo,
		&isCorrect,
		&attempt.CreatedAt,
	); err != nil {
		return QuestionAttempt{}, fmt.Errorf("query latest attempt: %w", err)
	}
	if isCorrect.Valid {
		value := isCorrect.Bool
		attempt.IsCorrect = &value
	}
	return attempt, nil
}

func questionSelectSQL() string {
	return `SELECT
  q.id,
  q.code,
  q.title,
  q.subject,
  q.grade_level,
  q.difficulty,
  q.question_type,
  q.topic,
  q.tags,
  q.reminder_word,
  q.example_sentence,
  q.option_items,
  q.stem,
  q.answer,
  q.analysis,
  q.status,
  COALESCE(stats.attempts_count, 0) AS attempts_count,
  COALESCE(stats.correct_count, 0) AS correct_count,
  q.created_at,
  q.updated_at
FROM questions q
LEFT JOIN (
  SELECT
    question_id,
    COUNT(*) AS attempts_count,
    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
  FROM question_attempts
  GROUP BY question_id
) stats ON stats.question_id = q.id`
}

type questionScanner interface {
	Scan(dest ...any) error
}

func scanQuestion(scanner questionScanner) (Question, error) {
	var q Question
	var rawTags string
	var rawOptionItems string
	if err := scanner.Scan(
		&q.ID,
		&q.Code,
		&q.Title,
		&q.Subject,
		&q.GradeLevel,
		&q.Difficulty,
		&q.QuestionType,
		&q.Topic,
		&rawTags,
		&q.ReminderWord,
		&q.ExampleSentence,
		&rawOptionItems,
		&q.Stem,
		&q.Answer,
		&q.Analysis,
		&q.Status,
		&q.AttemptsCount,
		&q.CorrectCount,
		&q.CreatedAt,
		&q.UpdatedAt,
	); err != nil {
		return Question{}, err
	}

	tags, err := decodeTags(rawTags)
	if err != nil {
		return Question{}, err
	}
	q.Tags = tags
	optionItems, err := decodeOptionItems(rawOptionItems)
	if err != nil {
		return Question{}, err
	}
	q.OptionItems = optionItems
	return q, nil
}

func encodeOptionItems(optionItems []string) (string, error) {
	normalized := normalizeOptionItems(optionItems)
	if len(normalized) == 0 {
		return "[]", nil
	}
	encoded, err := json.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func decodeOptionItems(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return []string{}, nil
	}

	var optionItems []string
	if err := json.Unmarshal([]byte(raw), &optionItems); err != nil {
		return nil, fmt.Errorf("decode option items: %w", err)
	}
	return normalizeOptionItems(optionItems), nil
}

func normalizeOptionItems(optionItems []string) []string {
	normalized := make([]string, 0, len(optionItems))
	for _, optionItem := range optionItems {
		value := strings.TrimSpace(optionItem)
		if value == "" {
			continue
		}
		normalized = append(normalized, value)
	}
	return normalized
}

func encodeTags(tags []string) (string, error) {
	normalized := normalizeTags(tags)
	if len(normalized) == 0 {
		return "[]", nil
	}
	encoded, err := json.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func decodeTags(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return []string{}, nil
	}

	var tags []string
	if err := json.Unmarshal([]byte(raw), &tags); err != nil {
		return nil, fmt.Errorf("decode tags: %w", err)
	}
	return normalizeTags(tags), nil
}

func normalizeTags(tags []string) []string {
	seen := make(map[string]struct{})
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		value := strings.TrimSpace(tag)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, value)
	}
	sort.Strings(normalized)
	return normalized
}

func withQuestionAlias(conditions []string) []string {
	aliased := make([]string, 0, len(conditions))
	for _, condition := range conditions {
		updated := condition
		updated = strings.ReplaceAll(updated, "code", "q.code")
		updated = strings.ReplaceAll(updated, "title", "q.title")
		updated = strings.ReplaceAll(updated, "stem", "q.stem")
		updated = strings.ReplaceAll(updated, "topic", "q.topic")
		updated = strings.ReplaceAll(updated, "subject", "q.subject")
		updated = strings.ReplaceAll(updated, "status", "q.status")
		updated = strings.ReplaceAll(updated, "question_type", "q.question_type")
		aliased = append(aliased, updated)
	}
	return aliased
}

func evaluateAttempt(questionType, answer, stem, answerText string) (bool, *bool, string, string) {
	switch questionType {
	case "single_choice", "true_false":
		correct := normalizeComparableAnswer(answer) == normalizeComparableAnswer(answerText)
		if correct {
			return true, boolPtr(true), "回答正确。", answer
		}
		return true, boolPtr(false), "回答已提交，正确答案已显示。", answer
	case "english_single_choice":
		correct := normalizeChoiceAnswer(answer) == normalizeChoiceAnswer(answerText)
		if correct {
			return true, boolPtr(true), "英文选择题回答正确。", answer
		}
		return true, boolPtr(false), "英文选择题回答已记录，正确答案已显示。", answer
	case "multiple_choice":
		correct := normalizeMultipleChoice(answer) == normalizeMultipleChoice(answerText)
		if correct {
			return true, boolPtr(true), "回答正确。", answer
		}
		return true, boolPtr(false), "回答已提交，正确答案已显示。", answer
	case "english_word_reminder":
		correct := normalizeComparableAnswer(answer) == normalizeComparableAnswer(answerText)
		if correct {
			return true, boolPtr(true), "单词填写正确。", answer
		}
		return true, boolPtr(false), "单词填写已记录，正确答案已显示。", answer
	case "english_synthesis":
		expected := parseUnderlinedAnswerValues(stem)
		if len(expected) == 0 {
			expected = parseEssayAnswerValues(answer)
		}
		correctAnswer := formatEssayAnswerValues(expected)
		if len(expected) == 0 {
			return false, nil, "这道 Synthesis 题还没有配置空白部分，已保留作答记录。", correctAnswer
		}
		submitted := parseEssayAnswerValues(answerText)
		if len(submitted) != len(expected) {
			return true, boolPtr(false), "Synthesis 填写数量不完整，正确答案已显示。", correctAnswer
		}
		for index := range expected {
			if normalizeComparableAnswer(expected[index]) != normalizeComparableAnswer(submitted[index]) {
				return true, boolPtr(false), "Synthesis 填写有误，正确答案已显示。", correctAnswer
			}
		}
		return true, boolPtr(true), "Synthesis 填写正确。", correctAnswer
	case "english_essay":
		expected := parseEssayAnswerValues(answer)
		correctAnswer := formatEssayAnswerValues(expected)
		if len(expected) == 0 {
			return false, nil, "这道作文题还没有配置挖空单词，已保留作答记录。", correctAnswer
		}
		submitted := parseEssayAnswerValues(answerText)
		if len(submitted) != len(expected) {
			return true, boolPtr(false), "挖空单词填写数量不完整，正确答案已显示。", correctAnswer
		}
		for index := range expected {
			if normalizeComparableAnswer(expected[index]) != normalizeComparableAnswer(submitted[index]) {
				return true, boolPtr(false), "挖空单词填写有误，正确答案已显示。", correctAnswer
			}
		}
		return true, boolPtr(true), "挖空单词填写正确。", correctAnswer
	case "english_comprehension_close":
		expected := parseEssayAnswerValues(answer)
		correctAnswer := formatEssayAnswerValues(expected)
		if len(expected) == 0 {
			return false, nil, "这道 Comprehension Close 还没有配置挖空单词，已保留作答记录。", correctAnswer
		}
		submitted := parseEssayAnswerValues(answerText)
		if len(submitted) != len(expected) {
			return true, boolPtr(false), "Comprehension Close 填写数量不完整，正确答案已显示。", correctAnswer
		}
		for index := range expected {
			if normalizeComparableAnswer(expected[index]) != normalizeComparableAnswer(submitted[index]) {
				return true, boolPtr(false), "Comprehension Close 填写有误，正确答案已显示。", correctAnswer
			}
		}
		return true, boolPtr(true), "Comprehension Close 填写正确。", correctAnswer
	case "english_common_sentence":
		return false, nil, "This Common Sentence item is for reading only and does not require answer submission.", ""
	default:
		return false, nil, "回答已提交；开放题暂不自动批改，直接展示参考答案。", answer
	}
}

func normalizeComparableAnswer(raw string) string {
	value := strings.TrimSpace(strings.ToUpper(raw))
	replacer := strings.NewReplacer(" ", "", "，", ",", "；", ";", "：", ":", "、", ",")
	return replacer.Replace(value)
}

func normalizeMultipleChoice(raw string) string {
	value := normalizeComparableAnswer(raw)
	if value == "" {
		return ""
	}
	splitter := regexp.MustCompile(`[;,/|]+`)
	parts := splitter.Split(value, -1)
	if len(parts) == 1 && len(parts[0]) > 1 && regexp.MustCompile(`^[A-Z]+$`).MatchString(parts[0]) {
		parts = strings.Split(parts[0], "")
	}

	normalized := make([]string, 0, len(parts))
	for _, part := range parts {
		token := strings.TrimSpace(part)
		if token == "" {
			continue
		}
		normalized = append(normalized, token)
	}
	sort.Strings(normalized)
	return strings.Join(normalized, ",")
}

func normalizeChoiceAnswer(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	matched := regexp.MustCompile(`(?i)^\s*([A-Z])(?:[\.\)、:：\-\s]|$)`).FindStringSubmatch(value)
	if len(matched) > 1 {
		return strings.ToUpper(strings.TrimSpace(matched[1]))
	}

	return normalizeComparableAnswer(value)
}

func parseEssayAnswerValues(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	var values []string
	if err := json.Unmarshal([]byte(trimmed), &values); err == nil {
		parsed := make([]string, 0, len(values))
		for _, value := range values {
			parsed = append(parsed, strings.ToLower(strings.TrimSpace(value)))
		}
		return parsed
	}

	lines := strings.Split(trimmed, "\n")
	parsed := make([]string, 0, len(lines))
	for _, line := range lines {
		value := strings.ToLower(strings.TrimSpace(line))
		if value == "" {
			continue
		}
		parsed = append(parsed, value)
	}
	return parsed
}

func parseUnderlinedAnswerValues(raw string) []string {
	matches := regexp.MustCompile(`(?is)<u[^>]*>(.*?)</u>`).FindAllStringSubmatch(raw, -1)
	if len(matches) == 0 {
		return nil
	}

	stripTags := regexp.MustCompile(`(?is)<[^>]+>`)
	values := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		value := strings.TrimSpace(stripTags.ReplaceAllString(match[1], ""))
		if value == "" {
			continue
		}
		values = append(values, strings.ToLower(value))
	}
	return values
}

func formatEssayAnswerValues(values []string) string {
	if len(values) == 0 {
		return ""
	}

	lines := make([]string, 0, len(values))
	for index, value := range values {
		lines = append(lines, fmt.Sprintf("%d. %s", index+1, value))
	}
	return strings.Join(lines, "\n")
}

func boolPtr(value bool) *bool {
	return &value
}

func ensureColumn(ctx context.Context, db *sql.DB, tableName, columnName, alterSQL string) error {
	var exists int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, tableName, columnName).Scan(&exists)
	if err != nil {
		return err
	}
	if exists > 0 {
		return nil
	}

	_, err = db.ExecContext(ctx, alterSQL)
	return err
}

func buildImportCode(subject string, batchTime time.Time, index int) string {
	return fmt.Sprintf("%s-%s-%03d", subjectPrefix(subject), batchTime.Format("20060102150405"), index+1)
}

func buildManualCode(subject, questionType string, currentTime time.Time) string {
	typePrefix := "Q"
	switch strings.TrimSpace(questionType) {
	case "english_essay":
		typePrefix = "ESSAY"
	case "english_synthesis":
		typePrefix = "SYN"
	case "english_common_sentence":
		typePrefix = "CS"
	case "essay":
		typePrefix = "ESSAY"
	case "english_word_reminder":
		typePrefix = "WORD"
	case "english_single_choice":
		typePrefix = "ESC"
	case "english_comprehension_close":
		typePrefix = "CCLOSE"
	case "single_choice":
		typePrefix = "SC"
	case "multiple_choice":
		typePrefix = "MC"
	case "short_answer":
		typePrefix = "SA"
	}

	return fmt.Sprintf("%s-%s-%s", subjectPrefix(subject), typePrefix, currentTime.Format("20060102150405"))
}

func buildImportTitle(questionType, stem string) string {
	if strings.TrimSpace(questionType) == "english_word_reminder" {
		return "英文单词提醒"
	}
	if strings.TrimSpace(questionType) == "english_single_choice" {
		return "英文选择题"
	}
	if strings.TrimSpace(questionType) == "english_comprehension_close" {
		return "Comprehension Close"
	}
	if strings.TrimSpace(questionType) == "english_synthesis" {
		return "Synthesis"
	}
	if strings.TrimSpace(questionType) == "english_common_sentence" {
		return "Common Sentence"
	}

	compact := strings.TrimSpace(stem)
	if compact == "" {
		return "Imported Question"
	}

	runes := []rune(compact)
	if len(runes) <= 24 {
		return compact
	}
	return string(runes[:24]) + "..."
}

func subjectPrefix(subject string) string {
	switch strings.TrimSpace(subject) {
	case "Mathematics":
		return "MATH"
	case "Chinese":
		return "CHN"
	case "English":
		return "ENG"
	case "Science":
		return "SCI"
	default:
		normalized := regexp.MustCompile(`[^A-Za-z0-9]+`).ReplaceAllString(strings.ToUpper(subject), "")
		if normalized == "" {
			return "Q"
		}
		if len(normalized) > 6 {
			return normalized[:6]
		}
		return normalized
	}
}

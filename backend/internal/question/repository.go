package question

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var ErrNotFound = errors.New("question not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, filter ListFilter) ([]Question, error) {
	args := make([]any, 0, 3)
	conditions := make([]string, 0, 3)

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		conditions = append(conditions, "(code LIKE ? OR title LIKE ? OR stem LIKE ?)")
		pattern := "%" + keyword + "%"
		args = append(args, pattern, pattern, pattern)
	}
	if subject := strings.TrimSpace(filter.Subject); subject != "" {
		conditions = append(conditions, "subject = ?")
		args = append(args, subject)
	}
	if status := strings.TrimSpace(filter.Status); status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, status)
	}

	query := `SELECT id, code, title, subject, grade_level, difficulty, question_type, stem, answer, analysis, status, created_at, updated_at
FROM questions`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY updated_at DESC, id DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query questions: %w", err)
	}
	defer rows.Close()

	questions := make([]Question, 0)
	for rows.Next() {
		var q Question
		if err := rows.Scan(
			&q.ID,
			&q.Code,
			&q.Title,
			&q.Subject,
			&q.GradeLevel,
			&q.Difficulty,
			&q.QuestionType,
			&q.Stem,
			&q.Answer,
			&q.Analysis,
			&q.Status,
			&q.CreatedAt,
			&q.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan question: %w", err)
		}
		questions = append(questions, q)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate questions: %w", err)
	}

	return questions, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Question, error) {
	var q Question
	query := `SELECT id, code, title, subject, grade_level, difficulty, question_type, stem, answer, analysis, status, created_at, updated_at
FROM questions
WHERE id = ?`
	if err := r.db.QueryRowContext(ctx, query, id).Scan(
		&q.ID,
		&q.Code,
		&q.Title,
		&q.Subject,
		&q.GradeLevel,
		&q.Difficulty,
		&q.QuestionType,
		&q.Stem,
		&q.Answer,
		&q.Analysis,
		&q.Status,
		&q.CreatedAt,
		&q.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Question{}, ErrNotFound
		}
		return Question{}, fmt.Errorf("query question: %w", err)
	}

	return q, nil
}

func (r *Repository) Create(ctx context.Context, input SaveQuestionInput) (Question, error) {
	query := `INSERT INTO questions (code, title, subject, grade_level, difficulty, question_type, stem, answer, analysis, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := r.db.ExecContext(ctx, query,
		input.Code,
		input.Title,
		input.Subject,
		input.GradeLevel,
		input.Difficulty,
		input.QuestionType,
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
	query := `UPDATE questions
SET code = ?, title = ?, subject = ?, grade_level = ?, difficulty = ?, question_type = ?, stem = ?, answer = ?, analysis = ?, status = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`
	result, err := r.db.ExecContext(ctx, query,
		input.Code,
		input.Title,
		input.Subject,
		input.GradeLevel,
		input.Difficulty,
		input.QuestionType,
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

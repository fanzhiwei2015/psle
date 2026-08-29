package student

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	mysql "github.com/go-sql-driver/mysql"
)

var ErrNotFound = errors.New("student not found")
var ErrNameExists = errors.New("student name already exists")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureSchema(ctx context.Context) error {
	const createStudentsTable = `CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

	if _, err := r.db.ExecContext(ctx, createStudentsTable); err != nil {
		return fmt.Errorf("create students table: %w", err)
	}

	const ensureDefaultStudent = `INSERT INTO students (id, name)
VALUES (1, ?)
ON DUPLICATE KEY UPDATE name = name`
	if _, err := r.db.ExecContext(ctx, ensureDefaultStudent, DefaultStudentName); err != nil {
		return fmt.Errorf("ensure default student: %w", err)
	}

	return nil
}

func (r *Repository) List(ctx context.Context) ([]Student, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, created_at, updated_at FROM students ORDER BY created_at ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("query students: %w", err)
	}
	defer rows.Close()

	items := make([]Student, 0)
	for rows.Next() {
		var item Student
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan student: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate students: %w", err)
	}

	return items, nil
}

func (r *Repository) Create(ctx context.Context, input SaveStudentInput) (Student, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return Student{}, fmt.Errorf("student name is required")
	}

	result, err := r.db.ExecContext(ctx, `INSERT INTO students (name) VALUES (?)`, name)
	if err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			return Student{}, ErrNameExists
		}
		return Student{}, fmt.Errorf("insert student: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Student{}, fmt.Errorf("last insert id: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Student, error) {
	var item Student
	err := r.db.QueryRowContext(ctx, `SELECT id, name, created_at, updated_at FROM students WHERE id = ?`, id).Scan(
		&item.ID,
		&item.Name,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Student{}, ErrNotFound
		}
		return Student{}, fmt.Errorf("query student: %w", err)
	}
	return item, nil
}

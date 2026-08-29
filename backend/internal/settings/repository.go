package settings

import (
	"context"
	"database/sql"
	"fmt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureSchema(ctx context.Context) error {
	const query = `CREATE TABLE IF NOT EXISTS app_settings (
  student_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

	if _, err := r.db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("create app_settings table: %w", err)
	}

        if err := ensureColumn(ctx, r.db, "app_settings", "student_id", "ALTER TABLE app_settings ADD COLUMN student_id BIGINT UNSIGNED NOT NULL DEFAULT 1 FIRST"); err != nil {
                return fmt.Errorf("ensure app_settings.student_id schema: %w", err)
        }
        if _, err := r.db.ExecContext(ctx, "UPDATE app_settings SET student_id = 1 WHERE student_id IS NULL OR student_id = 0"); err != nil {
                return fmt.Errorf("backfill app_settings.student_id: %w", err)
        }
        if err := ensureCompositePrimaryKey(ctx, r.db); err != nil {
                return fmt.Errorf("ensure app_settings primary key: %w", err)
        }

	return nil
}

func (r *Repository) GetPromptSettings(ctx context.Context, studentID int64) (PromptSettings, error) {
	const query = `SELECT setting_value, updated_at
FROM app_settings
WHERE student_id = ? AND setting_key = ?`

	var settings PromptSettings
	var updatedAt sql.NullTime
        err := r.db.QueryRowContext(ctx, query, normalizeStudentID(studentID), PromptTemplateKey).Scan(&settings.PromptTemplate, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return PromptSettings{}, nil
		}
		return PromptSettings{}, fmt.Errorf("query prompt settings: %w", err)
	}

	if updatedAt.Valid {
		settings.UpdatedAt = &updatedAt.Time
	}

	return settings, nil
}

func (r *Repository) SavePromptSettings(ctx context.Context, studentID int64, input SavePromptSettingsInput) (PromptSettings, error) {
        const query = `INSERT INTO app_settings (student_id, setting_key, setting_value)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  updated_at = CURRENT_TIMESTAMP`

        if _, err := r.db.ExecContext(ctx, query, normalizeStudentID(studentID), PromptTemplateKey, input.PromptTemplate); err != nil {
		return PromptSettings{}, fmt.Errorf("save prompt settings: %w", err)
	}

        return r.GetPromptSettings(ctx, studentID)
}

func normalizeStudentID(studentID int64) int64 {
        if studentID <= 0 {
                return 1
        }
        return studentID
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

func ensureCompositePrimaryKey(ctx context.Context, db *sql.DB) error {
        rows, err := db.QueryContext(ctx, `SELECT column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND constraint_name = 'PRIMARY'
ORDER BY ordinal_position`)
        if err != nil {
                return err
        }
        defer rows.Close()

        columns := make([]string, 0, 2)
        for rows.Next() {
                var columnName string
                if err := rows.Scan(&columnName); err != nil {
                        return err
                }
                columns = append(columns, columnName)
        }
        if err := rows.Err(); err != nil {
                return err
        }

        if len(columns) == 2 && columns[0] == "student_id" && columns[1] == "setting_key" {
                return nil
        }

        _, err = db.ExecContext(ctx, `ALTER TABLE app_settings DROP PRIMARY KEY, ADD PRIMARY KEY (student_id, setting_key)`)
        return err
}

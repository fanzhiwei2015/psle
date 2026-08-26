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
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

	if _, err := r.db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("create app_settings table: %w", err)
	}

	return nil
}

func (r *Repository) GetPromptSettings(ctx context.Context) (PromptSettings, error) {
	const query = `SELECT setting_value, updated_at
FROM app_settings
WHERE setting_key = ?`

	var settings PromptSettings
	var updatedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, PromptTemplateKey).Scan(&settings.PromptTemplate, &updatedAt)
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

func (r *Repository) SavePromptSettings(ctx context.Context, input SavePromptSettingsInput) (PromptSettings, error) {
	const query = `INSERT INTO app_settings (setting_key, setting_value)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  updated_at = CURRENT_TIMESTAMP`

	if _, err := r.db.ExecContext(ctx, query, PromptTemplateKey, input.PromptTemplate); err != nil {
		return PromptSettings{}, fmt.Errorf("save prompt settings: %w", err)
	}

	return r.GetPromptSettings(ctx)
}

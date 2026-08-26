package settings

import "time"

const PromptTemplateKey = "prompt_template"

type PromptSettings struct {
	PromptTemplate string     `json:"promptTemplate"`
	UpdatedAt      *time.Time `json:"updatedAt,omitempty"`
}

type SavePromptSettingsInput struct {
	PromptTemplate string `json:"promptTemplate"`
}

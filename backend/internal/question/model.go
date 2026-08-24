package question

import "time"

type Question struct {
	ID           int64     `json:"id"`
	Code         string    `json:"code"`
	Title        string    `json:"title"`
	Subject      string    `json:"subject"`
	GradeLevel   string    `json:"gradeLevel"`
	Difficulty   string    `json:"difficulty"`
	QuestionType string    `json:"questionType"`
	Stem         string    `json:"stem"`
	Answer       string    `json:"answer"`
	Analysis     string    `json:"analysis"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type SaveQuestionInput struct {
	Code         string `json:"code"`
	Title        string `json:"title"`
	Subject      string `json:"subject"`
	GradeLevel   string `json:"gradeLevel"`
	Difficulty   string `json:"difficulty"`
	QuestionType string `json:"questionType"`
	Stem         string `json:"stem"`
	Answer       string `json:"answer"`
	Analysis     string `json:"analysis"`
	Status       string `json:"status"`
}

type ListFilter struct {
	Keyword string
	Subject string
	Status  string
}

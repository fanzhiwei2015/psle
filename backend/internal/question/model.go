package question

import "time"

type Question struct {
	ID              int64     `json:"id"`
	Code            string    `json:"code"`
	Title           string    `json:"title"`
	Subject         string    `json:"subject"`
	GradeLevel      string    `json:"gradeLevel"`
	Difficulty      string    `json:"difficulty"`
	QuestionType    string    `json:"questionType"`
	Topic           string    `json:"topic"`
	Tags            []string  `json:"tags"`
	ReminderWord    string    `json:"reminderWord"`
	ExampleSentence string    `json:"exampleSentence"`
	OptionItems     []string  `json:"optionItems"`
	Stem            string    `json:"stem"`
	Answer          string    `json:"answer"`
	Analysis        string    `json:"analysis"`
	Status          string    `json:"status"`
	AttemptsCount   int       `json:"attemptsCount"`
	CorrectCount    int       `json:"correctCount"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type QuestionAttempt struct {
	ID         int64     `json:"id"`
	QuestionID int64     `json:"questionId"`
	AnswerText string    `json:"answerText"`
	Source     string    `json:"source"`
	AttemptNo  int       `json:"attemptNo"`
	IsCorrect  *bool     `json:"isCorrect,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

type SaveQuestionInput struct {
	Code            string   `json:"code"`
	Title           string   `json:"title"`
	Subject         string   `json:"subject"`
	GradeLevel      string   `json:"gradeLevel"`
	Difficulty      string   `json:"difficulty"`
	QuestionType    string   `json:"questionType"`
	Topic           string   `json:"topic"`
	Tags            []string `json:"tags"`
	ReminderWord    string   `json:"reminderWord"`
	ExampleSentence string   `json:"exampleSentence"`
	OptionItems     []string `json:"optionItems"`
	Stem            string   `json:"stem"`
	Answer          string   `json:"answer"`
	Analysis        string   `json:"analysis"`
	Status          string   `json:"status"`
}

type ListFilter struct {
        StudentID    int64
	Keyword      string
	Subject      string
	Status       string
	QuestionType string
}

type ImportPayload struct {
	Payload        string `json:"payload"`
	DefaultSubject string `json:"defaultSubject"`
}

type ImportQuestionInput struct {
	Subject          string   `json:"subject"`
	QuestionType     string   `json:"questionType"`
	Topic            string   `json:"topic"`
	ReminderWord     string   `json:"reminderWord"`
	ExampleSentence  string   `json:"exampleSentence"`
	OptionItems      []string `json:"optionItems"`
	ProblemDesc      string   `json:"problemDescription"`
	Answer           string   `json:"answer"`
	OriginalResponse string   `json:"childAnswer"`
}

type ImportPreviewItem struct {
	Index            int      `json:"index"`
	Subject          string   `json:"subject"`
	QuestionType     string   `json:"questionType"`
	Topic            string   `json:"topic"`
	ReminderWord     string   `json:"reminderWord"`
	ExampleSentence  string   `json:"exampleSentence"`
	OptionItems      []string `json:"optionItems,omitempty"`
	ProblemDesc      string   `json:"problemDescription"`
	Answer           string   `json:"answer"`
	OriginalResponse string   `json:"childAnswer"`
	GeneratedCode    string   `json:"generatedCode"`
	GeneratedTitle   string   `json:"generatedTitle"`
}

type ImportValidationResult struct {
	Valid  bool                `json:"valid"`
	Count  int                 `json:"count"`
	Items  []ImportPreviewItem `json:"items,omitempty"`
	Errors []string            `json:"errors,omitempty"`
}

type ImportResult struct {
	ImportedCount int        `json:"importedCount"`
	Questions     []Question `json:"questions"`
}

type UpdateTagsInput struct {
	Tags []string `json:"tags"`
}

type SubmitAttemptInput struct {
	AnswerText string `json:"answerText"`
}

type SubmitAttemptResult struct {
	Question      Question        `json:"question"`
	Attempt       QuestionAttempt `json:"attempt"`
	Checked       bool            `json:"checked"`
	CorrectAnswer string          `json:"correctAnswer"`
	Message       string          `json:"message"`
}

type EssayWordStat struct {
	Index        int    `json:"index"`
	Word         string `json:"word"`
	CorrectCount int    `json:"correctCount"`
	AttemptCount int    `json:"attemptCount"`
}

type EssayWordStatsResult struct {
	QuestionID int64           `json:"questionId"`
	Items      []EssayWordStat `json:"items"`
}

package student

import "time"

const DefaultStudentName = "Default Student"

type Student struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SaveStudentInput struct {
	Name string `json:"name"`
}

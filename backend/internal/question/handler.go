package question

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
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
	mux.HandleFunc("GET /api/questions/{id}", h.get)
	mux.HandleFunc("PUT /api/questions/{id}", h.update)
	mux.HandleFunc("DELETE /api/questions/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	filter := ListFilter{
		Keyword: r.URL.Query().Get("keyword"),
		Subject: r.URL.Query().Get("subject"),
		Status:  r.URL.Query().Get("status"),
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
	input.Stem = strings.TrimSpace(input.Stem)
	input.Answer = strings.TrimSpace(input.Answer)
	input.Analysis = strings.TrimSpace(input.Analysis)
	input.Status = strings.TrimSpace(input.Status)

	if input.Code == "" || input.Title == "" || input.Subject == "" || input.Stem == "" || input.Answer == "" {
		writeError(w, http.StatusBadRequest, "code, title, subject, stem and answer are required")
		return SaveQuestionInput{}, false
	}
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

	return input, true
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

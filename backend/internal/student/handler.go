package student

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/students", h.list)
	mux.HandleFunc("POST /api/students", h.create)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list students")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var input SaveStudentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	item, err := h.repo.Create(r.Context(), input)
	if err != nil {
		if errors.Is(err, ErrNameExists) {
			writeError(w, http.StatusConflict, "student name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create student")
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

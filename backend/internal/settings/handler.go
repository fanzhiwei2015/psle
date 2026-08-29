package settings

import (
	"encoding/json"
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
	mux.HandleFunc("GET /api/settings/prompt", h.getPromptSettings)
	mux.HandleFunc("PUT /api/settings/prompt", h.savePromptSettings)
}

func (h *Handler) getPromptSettings(w http.ResponseWriter, r *http.Request) {
        settings, err := h.repo.GetPromptSettings(r.Context(), parseStudentID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get prompt settings")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) savePromptSettings(w http.ResponseWriter, r *http.Request) {
	var input SavePromptSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	input.PromptTemplate = strings.TrimSpace(input.PromptTemplate)

        settings, err := h.repo.SavePromptSettings(r.Context(), parseStudentID(r), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save prompt settings")
		return
	}

	writeJSON(w, http.StatusOK, settings)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func parseStudentID(r *http.Request) int64 {
        studentID, err := strconv.ParseInt(strings.TrimSpace(r.URL.Query().Get("studentId")), 10, 64)
        if err != nil || studentID <= 0 {
                return 1
        }
        return studentID
}

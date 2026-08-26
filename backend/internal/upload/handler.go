package upload

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	_ "golang.org/x/image/webp"
)

const (
	maxUploadFileSize     = 10 << 20
	maxUploadBatchCount   = 50
	maxUploadRequestSize  = maxUploadFileSize * maxUploadBatchCount
	maxCombinedFileSize   = 100 << 20
	maxCombineChunkCount  = 10
	uploadHistoryFileName = "history.jsonl"
)

var allowedSubjects = map[string]string{
	"Mathematics": "mathematics",
	"Chinese":     "chinese",
	"English":     "english",
	"Science":     "science",
}

var allowedExts = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".webp": {},
	".gif":  {},
}

type Handler struct {
	rootDir string
}

type Item struct {
	Name      string `json:"name"`
	Subject   string `json:"subject"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
}

type HistoryItem struct {
	ID        string `json:"id"`
	Subject   string `json:"subject"`
	BatchID   string `json:"batchId"`
	CreatedAt string `json:"createdAt"`
	Href      string `json:"href,omitempty"`
}

type uploadResponse struct {
	Items         []Item       `json:"items"`
	CombinedItems []Item       `json:"combinedItems,omitempty"`
	History       *HistoryItem `json:"history,omitempty"`
}

type listResponse struct {
	Items   []Item        `json:"items"`
	History []HistoryItem `json:"history,omitempty"`
}

func NewHandler(rootDir string) *Handler {
	return &Handler{rootDir: rootDir}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/uploads", h.list)
	mux.HandleFunc("POST /api/uploads", h.upload)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(h.rootDir))))
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	subject, subjectKey, ok := parseSubject(w, r)
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(maxUploadRequestSize); err != nil {
		writeError(w, http.StatusBadRequest, "invalid upload form")
		return
	}

	headers := r.MultipartForm.File["files"]
	if len(headers) == 0 {
		headers = r.MultipartForm.File["file"]
	}
	if len(headers) == 0 {
		writeError(w, http.StatusBadRequest, "at least one file is required")
		return
	}
	if len(headers) > maxUploadBatchCount {
		writeError(w, http.StatusBadRequest, "you can upload up to 50 images at once")
		return
	}

	targetDir := filepath.Join(h.rootDir, subjectKey)
	err := os.MkdirAll(targetDir, 0o755)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create upload directory")
		return
	}

	batchID := fmt.Sprintf("%d", time.Now().UnixNano())
	createdAt := time.Now().Format(time.RFC3339)
	items := make([]Item, 0, len(headers))
	savedPaths := make([]string, 0, len(headers))
	for _, header := range headers {
		filename, fileErr := validateFile(header)
		if fileErr != nil {
			writeError(w, http.StatusBadRequest, fileErr.Error())
			return
		}

		file, fileErr := header.Open()
		if fileErr != nil {
			writeError(w, http.StatusInternalServerError, "failed to open uploaded file")
			return
		}

		storedName := buildStoredName(batchID, filename)
		targetPath := filepath.Join(targetDir, storedName)
		item := Item{
			Name:      storedName,
			Subject:   subject,
			URL:       fmt.Sprintf("/uploads/%s/%s", subjectKey, storedName),
			CreatedAt: createdAt,
		}

		if fileErr := saveUploadedFile(targetPath, filename, file); fileErr != nil {
			_ = file.Close()
			writeError(w, http.StatusInternalServerError, "failed to save file")
			return
		}
		if fileErr := file.Close(); fileErr != nil {
			writeError(w, http.StatusInternalServerError, "failed to finalize file")
			return
		}

		items = append(items, item)
		savedPaths = append(savedPaths, targetPath)
	}

	response := uploadResponse{Items: items}
	displayItems := items
	if len(savedPaths) > 1 {
		combinedItems, err := h.createCombinedImages(subject, subjectKey, targetDir, batchID, createdAt, savedPaths)
		if err != nil {
			log.Printf("create combined image failed for subject=%s: %v", subject, err)
			writeError(w, http.StatusInternalServerError, "failed to create combined image")
			return
		}
		response.CombinedItems = combinedItems
		displayItems = combinedItems
	}

	historyItem := HistoryItem{
		ID:        batchID,
		Subject:   subject,
		BatchID:   batchID,
		CreatedAt: createdAt,
	}
	if len(displayItems) > 0 {
		historyItem.Href = fmt.Sprintf("/gallery?subject=%s&batch=%s", subject, batchID)
	}
	if err := appendHistory(targetDir, historyItem); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save upload history")
		return
	}
	response.History = &historyItem

	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	subject, subjectKey, ok := parseSubject(w, r)
	if !ok {
		return
	}

	targetDir := filepath.Join(h.rootDir, subjectKey)
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to prepare upload directory")
		return
	}

	batchID := strings.TrimSpace(r.URL.Query().Get("batch"))
	items, err := listDisplayItems(subject, subjectKey, targetDir, batchID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list uploads")
		return
	}
	history, err := readHistory(targetDir, subject, subjectKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list upload history")
		return
	}

	slices.SortFunc(items, func(a, b Item) int {
		if a.CreatedAt == b.CreatedAt {
			return strings.Compare(b.Name, a.Name)
		}
		return strings.Compare(b.CreatedAt, a.CreatedAt)
	})

	slices.SortFunc(history, func(a, b HistoryItem) int {
		if a.CreatedAt == b.CreatedAt {
			return strings.Compare(b.ID, a.ID)
		}
		return strings.Compare(b.CreatedAt, a.CreatedAt)
	})

	writeJSON(w, http.StatusOK, listResponse{Items: items, History: history})
}

func listDisplayItems(subject, subjectKey, targetDir, batchID string) ([]Item, error) {
	combinedDir := filepath.Join(targetDir, "combined")
	if combinedItems, err := listItemsFromDir(subject, filepath.Join(subjectKey, "combined"), combinedDir, batchID); err == nil && len(combinedItems) > 0 {
		return combinedItems, nil
	}

	return listItemsFromDir(subject, subjectKey, targetDir, batchID)
}

func listItemsFromDir(subject, urlPath, dir, batchID string) ([]Item, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []Item{}, nil
		}
		return nil, err
	}

	items := make([]Item, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !isDisplayImage(entry.Name()) {
			continue
		}
		if batchID != "" && !strings.HasPrefix(entry.Name(), batchID+"-") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		items = append(items, Item{
			Name:      entry.Name(),
			Subject:   subject,
			URL:       fmt.Sprintf("/uploads/%s/%s", urlPath, entry.Name()),
			CreatedAt: info.ModTime().Format(time.RFC3339),
		})
	}

	return items, nil
}

func isDisplayImage(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	_, ok := allowedExts[ext]
	if ok {
		return true
	}
	return ext == ".png"
}

func parseSubject(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	subject := strings.TrimSpace(r.URL.Query().Get("subject"))
	subjectKey, ok := allowedSubjects[subject]
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid subject")
		return "", "", false
	}
	return subject, subjectKey, true
}

func validateFile(header *multipart.FileHeader) (string, error) {
	if header.Size <= 0 {
		return "", errors.New("empty file is not allowed")
	}
	if header.Size > maxUploadFileSize {
		return "", errors.New("file must be smaller than 10MB")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if _, ok := allowedExts[ext]; !ok {
		return "", errors.New("only jpg, png, webp and gif images are supported")
	}

	return sanitizeBaseName(strings.TrimSuffix(header.Filename, ext)) + ext, nil
}

func saveUploadedFile(targetPath, originalName string, src multipart.File) error {
	data, err := io.ReadAll(src)
	if err != nil {
		return err
	}

	normalized, err := normalizeImageOrientation(data, originalName)
	if err != nil {
		normalized = data
	}

	return os.WriteFile(targetPath, normalized, 0o644)
}

func normalizeImageOrientation(data []byte, originalName string) ([]byte, error) {
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext != ".jpg" && ext != ".jpeg" {
		return data, nil
	}

	orientation, err := readOrientation(data)
	if err != nil || orientation <= 1 {
		return data, nil
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, err
	}

	oriented := applyOrientation(img, orientation)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, oriented, &jpeg.Options{Quality: 92}); err != nil {
		return data, err
	}

	return buf.Bytes(), nil
}

func readOrientation(data []byte) (int, error) {
	if len(data) < 4 || data[0] != 0xff || data[1] != 0xd8 {
		return 1, errors.New("not a jpeg file")
	}

	for i := 2; i+4 <= len(data); {
		if data[i] != 0xff {
			i++
			continue
		}

		marker := data[i+1]
		if marker == 0xda || marker == 0xd9 {
			break
		}

		if i+4 > len(data) {
			break
		}

		segmentLength := int(binary.BigEndian.Uint16(data[i+2 : i+4]))
		if segmentLength < 2 || i+2+segmentLength > len(data) {
			break
		}

		if marker == 0xe1 {
			payload := data[i+4 : i+2+segmentLength]
			if orientation, err := parseExifOrientation(payload); err == nil {
				return orientation, nil
			}
		}

		i += 2 + segmentLength
	}

	return 1, errors.New("orientation not found")
}

func parseExifOrientation(payload []byte) (int, error) {
	if len(payload) < 14 || !bytes.HasPrefix(payload, []byte("Exif\x00\x00")) {
		return 1, errors.New("exif header not found")
	}

	tiff := payload[6:]
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1, errors.New("invalid byte order")
	}

	ifdOffset := int(order.Uint32(tiff[4:8]))
	if ifdOffset < 0 || ifdOffset+2 > len(tiff) {
		return 1, errors.New("invalid ifd offset")
	}

	entryCount := int(order.Uint16(tiff[ifdOffset : ifdOffset+2]))
	entryBase := ifdOffset + 2
	for idx := 0; idx < entryCount; idx++ {
		entryOffset := entryBase + idx*12
		if entryOffset+12 > len(tiff) {
			break
		}

		tag := order.Uint16(tiff[entryOffset : entryOffset+2])
		if tag != 0x0112 {
			continue
		}

		valueOffset := entryOffset + 8
		value := order.Uint16(tiff[valueOffset : valueOffset+2])
		if value < 1 || value > 8 {
			return 1, errors.New("invalid orientation value")
		}
		return int(value), nil
	}

	return 1, errors.New("orientation tag not found")
}

func applyOrientation(src image.Image, orientation int) image.Image {
	if orientation <= 1 || orientation > 8 {
		return src
	}

	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	dstWidth := width
	dstHeight := height

	if orientation >= 5 && orientation <= 8 {
		dstWidth = height
		dstHeight = width
	}

	dst := image.NewNRGBA(image.Rect(0, 0, dstWidth, dstHeight))
	for y := 0; y < dstHeight; y++ {
		for x := 0; x < dstWidth; x++ {
			srcX, srcY := orientedSourcePoint(x, y, width, height, orientation)
			dst.Set(x, y, src.At(bounds.Min.X+srcX, bounds.Min.Y+srcY))
		}
	}

	return dst
}

func orientedSourcePoint(x, y, width, height, orientation int) (int, int) {
	switch orientation {
	case 2:
		return width - 1 - x, y
	case 3:
		return width - 1 - x, height - 1 - y
	case 4:
		return x, height - 1 - y
	case 5:
		return y, x
	case 6:
		return y, height - 1 - x
	case 7:
		return width - 1 - y, height - 1 - x
	case 8:
		return width - 1 - y, x
	default:
		return x, y
	}
}

func buildStoredName(batchID, name string) string {
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	return fmt.Sprintf("%s-%s%s", batchID, base, ext)
}

func (h *Handler) createCombinedImages(subject, subjectKey, targetDir, batchID, createdAt string, savedPaths []string) ([]Item, error) {
	if len(savedPaths) == 0 {
		return nil, nil
	}

	items := make([]Item, 0, (len(savedPaths)+maxCombineChunkCount-1)/maxCombineChunkCount)
	for start := 0; start < len(savedPaths); start += maxCombineChunkCount {
		end := min(start+maxCombineChunkCount, len(savedPaths))
		partItems, err := h.createCombinedChunk(subject, subjectKey, targetDir, batchID, createdAt, savedPaths[start:end], len(items)+1)
		if err != nil {
			return nil, err
		}
		items = append(items, partItems...)
	}

	return items, nil
}

func (h *Handler) createCombinedChunk(subject, subjectKey, targetDir, batchID, createdAt string, savedPaths []string, part int) ([]Item, error) {
	images := make([]image.Image, 0, len(savedPaths))
	maxWidth := 0
	totalHeight := 0

	for _, path := range savedPaths {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}

		img, _, err := image.Decode(file)
		_ = file.Close()
		if err != nil {
			return nil, err
		}

		// Normalize obviously horizontal document pages into a portrait reading direction
		// before stitching them into a vertical long image.
		img = normalizeReadingOrientation(img)

		bounds := img.Bounds()
		width := bounds.Dx()
		height := bounds.Dy()
		if width > maxWidth {
			maxWidth = width
		}
		totalHeight += height
		images = append(images, img)
	}

	if maxWidth <= 0 || totalHeight <= 0 {
		return nil, errors.New("empty image set")
	}

	canvas := image.NewNRGBA(image.Rect(0, 0, maxWidth, totalHeight))
	draw.Draw(canvas, canvas.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)

	offsetY := 0
	for _, img := range images {
		bounds := img.Bounds()
		width := bounds.Dx()
		height := bounds.Dy()
		offsetX := (maxWidth - width) / 2
		targetRect := image.Rect(offsetX, offsetY, offsetX+width, offsetY+height)
		draw.Draw(canvas, targetRect, img, bounds.Min, draw.Over)
		offsetY += height
	}

	combinedDir := filepath.Join(targetDir, "combined")
	if err := os.MkdirAll(combinedDir, 0o755); err != nil {
		return nil, err
	}

	var encoded bytes.Buffer
	if err := pngEncode(&encoded, canvas); err != nil {
		return nil, err
	}
	if encoded.Len() > maxCombinedFileSize {
		if len(savedPaths) == 1 {
			return nil, fmt.Errorf("combined image exceeds 100MB limit")
		}

		mid := len(savedPaths) / 2
		left, err := h.createCombinedChunk(subject, subjectKey, targetDir, batchID, createdAt, savedPaths[:mid], part*10)
		if err != nil {
			return nil, err
		}
		right, err := h.createCombinedChunk(subject, subjectKey, targetDir, batchID, createdAt, savedPaths[mid:], part*10+1)
		if err != nil {
			return nil, err
		}
		return append(left, right...), nil
	}

	filename := fmt.Sprintf("%s-part-%02d-combined.png", batchID, part)
	targetPath := filepath.Join(combinedDir, filename)

	if err := os.WriteFile(targetPath, encoded.Bytes(), 0o644); err != nil {
		return nil, err
	}

	return []Item{{
		Name:      filename,
		Subject:   subject,
		URL:       fmt.Sprintf("/uploads/%s/combined/%s", subjectKey, filename),
		CreatedAt: createdAt,
	}}, nil
}

func normalizeReadingOrientation(src image.Image) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= height {
		return src
	}

	// Use a simple reading heuristic: scanned pages and screenshots are usually
	// easier to read in portrait. Only rotate when the image is clearly wider
	// than tall, so we avoid flipping nearly square images.
	if float64(width) < float64(height)*1.15 {
		return src
	}

	return rotateClockwise(src)
}

func rotateClockwise(src image.Image) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, height, width))

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			dst.Set(height-1-y, x, src.At(bounds.Min.X+x, bounds.Min.Y+y))
		}
	}

	return dst
}

func pngEncode(dst io.Writer, img image.Image) error {
	return png.Encode(dst, img)
}

func appendHistory(targetDir string, item HistoryItem) error {
	file, err := os.OpenFile(filepath.Join(targetDir, uploadHistoryFileName), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewEncoder(file).Encode(item)
}

func readHistory(targetDir, subject, subjectKey string) ([]HistoryItem, error) {
	history := make([]HistoryItem, 0)
	file, err := os.Open(filepath.Join(targetDir, uploadHistoryFileName))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			file = nil
		} else {
			return nil, err
		}
	}

	if file != nil {
		defer file.Close()

		decoder := json.NewDecoder(file)
		for {
			var item HistoryItem
			if err := decoder.Decode(&item); err != nil {
				if errors.Is(err, io.EOF) {
					break
				}
				return nil, err
			}

			if item.Subject == "" {
				item.Subject = subject
			}
			if item.Href == "" && item.BatchID != "" {
				item.Href = fmt.Sprintf("/gallery?subject=%s&batch=%s", item.Subject, item.BatchID)
			}
			history = append(history, item)
		}
	}

	existingBatchIDs := make(map[string]struct{}, len(history))
	for _, item := range history {
		if item.BatchID != "" {
			existingBatchIDs[item.BatchID] = struct{}{}
		}
	}

	displayItems, err := listDisplayItems(subject, subjectKey, targetDir, "")
	if err != nil {
		return nil, err
	}
	for _, item := range displayItems {
		batchID := extractBatchID(item.Name)
		if batchID == "" {
			continue
		}
		if _, ok := existingBatchIDs[batchID]; ok {
			continue
		}
		history = append(history, HistoryItem{
			ID:        batchID,
			Subject:   subject,
			BatchID:   batchID,
			CreatedAt: item.CreatedAt,
			Href:      fmt.Sprintf("/gallery?subject=%s&batch=%s", subject, batchID),
		})
		existingBatchIDs[batchID] = struct{}{}
	}

	return history, nil
}

func extractBatchID(name string) string {
	parts := strings.SplitN(name, "-", 2)
	if len(parts) != 2 {
		return ""
	}
	return parts[0]
}

func sanitizeBaseName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	replacer := strings.NewReplacer(" ", "-", "/", "-", "\\", "-", "_", "-", ".", "-")
	name = replacer.Replace(name)
	name = strings.Trim(name, "-")
	if name == "" {
		return "image"
	}
	return name
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

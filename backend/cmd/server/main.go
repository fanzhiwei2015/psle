package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/bytedance/psle/backend/internal/question"
	"github.com/bytedance/psle/backend/internal/settings"
	"github.com/bytedance/psle/backend/internal/upload"
)

func main() {
	db, err := openDB()
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	settingsRepo := settings.NewRepository(db)
	if err := settingsRepo.EnsureSchema(context.Background()); err != nil {
		log.Fatalf("ensure settings schema: %v", err)
	}
	questionRepo := question.NewRepository(db)
	if err := questionRepo.EnsureSchema(context.Background()); err != nil {
		log.Fatalf("ensure question schema: %v", err)
	}

	mux := http.NewServeMux()
	registerRoutes(mux, questionRepo, settingsRepo)

	server := &http.Server{
		Addr:              ":" + getEnv("APP_PORT", "8080"),
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("psle backend listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func registerRoutes(mux *http.ServeMux, questionRepo *question.Repository, settingsRepo *settings.Repository) {
	handler := question.NewHandler(questionRepo)
	handler.Register(mux)
	upload.NewHandler(getUploadRoot()).Register(mux)
	settings.NewHandler(settingsRepo).Register(mux)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
}

func openDB() (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local",
		getEnv("DB_USER", "root"),
		getEnv("DB_PASSWORD", "root_password"),
		getEnv("DB_HOST", "127.0.0.1"),
		getEnv("DB_PORT", "3306"),
		getEnv("DB_NAME", "psle_db"),
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)

	return db, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getUploadRoot() string {
	return getEnv("UPLOAD_ROOT", filepath.Join(".", "uploads"))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

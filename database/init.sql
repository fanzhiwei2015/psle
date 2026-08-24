CREATE DATABASE IF NOT EXISTS psle_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE psle_db;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  grade_level VARCHAR(32) NOT NULL DEFAULT 'PSLE',
  difficulty VARCHAR(32) NOT NULL DEFAULT 'medium',
  question_type VARCHAR(64) NOT NULL DEFAULT 'single_choice',
  stem TEXT NOT NULL,
  answer TEXT NOT NULL,
  analysis TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_questions_subject (subject),
  INDEX idx_questions_status (status),
  INDEX idx_questions_updated_at (updated_at)
);

INSERT INTO questions (code, title, subject, grade_level, difficulty, question_type, stem, answer, analysis, status)
VALUES
  (
    'MATH-2026-001',
    '分数加法基础题',
    'Mathematics',
    'PSLE',
    'easy',
    'single_choice',
    '计算 1/4 + 2/4 的结果，并从选项中选择正确答案。',
    '3/4',
    '同分母分数相加时，分母不变，分子相加，1 + 2 = 3。',
    'published'
  ),
  (
    'ENG-2026-001',
    '阅读理解主旨题',
    'English',
    'PSLE',
    'medium',
    'short_answer',
    '阅读短文后，概括作者想表达的主要观点。',
    '围绕短文中心思想进行总结，答案需覆盖人物、事件和结论。',
    '先找高频关键词，再用一句完整陈述归纳全文。',
    'draft'
  ),
  (
    'SCI-2026-001',
    '植物生长条件判断',
    'Science',
    'PSLE',
    'medium',
    'single_choice',
    '植物进行光合作用最需要下列哪组条件？',
    '阳光、水和二氧化碳',
    '光合作用离不开光照、水分与二氧化碳，这也是小学科学常见考点。',
    'published'
  );

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
  topic VARCHAR(255) NOT NULL DEFAULT '',
  tags VARCHAR(1024) NOT NULL DEFAULT '[]',
  reminder_word VARCHAR(255) NOT NULL DEFAULT '',
  example_sentence TEXT NOT NULL,
  option_items TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS question_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  attempt_no INT NOT NULL DEFAULT 1,
  is_correct TINYINT(1) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_question_attempts_question_id FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_question_attempts_question_id (question_id),
  INDEX idx_question_attempts_source (source)
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('prompt_template', '')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO questions (code, title, subject, grade_level, difficulty, question_type, topic, tags, reminder_word, example_sentence, option_items, stem, answer, analysis, status)
VALUES
  (
    'MATH-2026-001',
    '分数加法基础题',
    'Mathematics',
    'PSLE',
    'easy',
    'single_choice',
    '分数加法',
    '["分数","加法","基础"]',
    '',
    '',
    '[]',
    '计算 1/4 + 2/4 的结果，并从选项中选择正确答案。',
    '3/4',
    '同分母分数相加时，分母不变，分子相加，1 + 2 = 3。',
    'published'
  ),
  (
    'CHN-2026-001',
    '阅读理解主旨题',
    'Chinese',
    'PSLE',
    'medium',
    'short_answer',
    '阅读理解中心思想',
    '["阅读理解","中心思想"]',
    '',
    '',
    '[]',
    '阅读短文后，概括作者想表达的主要观点。',
    '围绕短文中心思想进行总结，答案需覆盖人物、事件和结论。',
    '先找高频关键词，再用一句完整陈述归纳全文。',
    'draft'
  ),
  (
    'ENG-2026-001',
    'Grammar Error Correction',
    'English',
    'PSLE',
    'medium',
    'short_answer',
    '主谓一致与时态',
    '["语法","主谓一致","时态"]',
    '',
    '',
    '[]',
    'Read the sentence and correct the grammar mistake.',
    'Students should rewrite the sentence using the correct verb tense and subject-verb agreement.',
    'Check tense clues first, then confirm whether the subject and verb agree.',
    'published'
  ),
  (
    'SCI-2026-001',
    '植物生长条件判断',
    'Science',
    'PSLE',
    'medium',
    'single_choice',
    '光合作用条件',
    '["科学","植物","光合作用"]',
    '',
    '',
    '[]',
    '植物进行光合作用最需要下列哪组条件？',
    '阳光、水和二氧化碳',
    '光合作用离不开光照、水分与二氧化碳，这也是小学科学常见考点。',
    'published'
  );

INSERT INTO question_attempts (question_id, answer_text, source, attempt_no)
SELECT id, '3/4', 'seed_original', 1 FROM questions WHERE code = 'MATH-2026-001'
UNION ALL
SELECT id, '作者想告诉我们要从人物和事件中归纳中心思想。', 'seed_original', 1 FROM questions WHERE code = 'CHN-2026-001'
UNION ALL
SELECT id, 'Students should goes to school every day.', 'seed_original', 1 FROM questions WHERE code = 'ENG-2026-001'
UNION ALL
SELECT id, '阳光、水和空气。', 'seed_original', 1 FROM questions WHERE code = 'SCI-2026-001';

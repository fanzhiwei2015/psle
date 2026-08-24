import { FormEvent, useEffect, useMemo, useState } from "react";

type Question = {
  id: number;
  code: string;
  title: string;
  subject: string;
  gradeLevel: string;
  difficulty: string;
  questionType: string;
  stem: string;
  answer: string;
  analysis: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  code: string;
  title: string;
  subject: string;
  gradeLevel: string;
  difficulty: string;
  questionType: string;
  stem: string;
  answer: string;
  analysis: string;
  status: string;
};

const emptyForm: FormState = {
  code: "",
  title: "",
  subject: "Mathematics",
  gradeLevel: "PSLE",
  difficulty: "medium",
  questionType: "single_choice",
  stem: "",
  answer: "",
  analysis: "",
  status: "draft"
};

const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

export default function App() {
  const [items, setItems] = useState<Question[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("正在加载题目数据...");

  const subjectOptions = useMemo(() => ["Mathematics", "English", "Science"], []);

  async function loadQuestions() {
    setLoading(true);
    setMessage("正在同步题目列表...");

    const query = new URLSearchParams();
    if (keyword.trim()) query.set("keyword", keyword.trim());
    if (subject) query.set("subject", subject);
    if (status) query.set("status", status);

    try {
      const response = await fetch(`${apiBase}/questions?${query.toString()}`);
      if (!response.ok) throw new Error("load failed");
      const data = await response.json();
      setItems(data.items ?? []);
      setMessage(`共加载 ${data.items?.length ?? 0} 道题目`);
    } catch (error) {
      console.error(error);
      setMessage("题目加载失败，请检查后端服务是否启动");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("已切换到新增模式");
  }

  function startEdit(item: Question) {
    setEditingId(item.id);
    setForm({
      code: item.code,
      title: item.title,
      subject: item.subject,
      gradeLevel: item.gradeLevel,
      difficulty: item.difficulty,
      questionType: item.questionType,
      stem: item.stem,
      answer: item.answer,
      analysis: item.analysis,
      status: item.status
    });
    setMessage(`正在编辑 ${item.code}`);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${apiBase}/questions/${editingId}` : `${apiBase}/questions`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      await loadQuestions();
      startCreate();
      setMessage(editingId ? "题目已更新" : "题目已创建");
    } catch (error) {
      console.error(error);
      setMessage("保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeQuestion(id: number) {
    if (!window.confirm("确认删除这道题目吗？")) return;

    try {
      const response = await fetch(`${apiBase}/questions/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("delete failed");

      await loadQuestions();
      if (editingId === id) {
        startCreate();
      }
      setMessage("题目已删除");
    } catch (error) {
      console.error(error);
      setMessage("删除失败，请稍后重试");
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">PSLE Admin</p>
          <h1>考试题目管理系统</h1>
          <p className="hero-text">
            面向小学升学考试场景的题库后台，当前支持题目列表、筛选、创建、编辑与删除。
          </p>
        </div>
        <div className="hero-card">
          <span>数据状态</span>
          <strong>{loading ? "同步中" : "已就绪"}</strong>
          <small>{message}</small>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2>题目列表</h2>
            <button className="secondary" onClick={() => void loadQuestions()}>
              刷新
            </button>
          </div>

          <div className="filters">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="按编号、标题、题干搜索"
            />
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="">全部学科</option>
              {subjectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
            <button onClick={() => void loadQuestions()}>查询</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>标题</th>
                  <th>学科</th>
                  <th>难度</th>
                  <th>状态</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.title}</td>
                    <td>{item.subject}</td>
                    <td>{item.difficulty}</td>
                    <td>{item.status}</td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td className="actions">
                      <button className="link" onClick={() => startEdit(item)}>
                        编辑
                      </button>
                      <button className="link danger" onClick={() => void removeQuestion(item.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel form-panel">
          <div className="panel-head">
            <h2>{editingId ? "编辑题目" : "新增题目"}</h2>
            <button className="secondary" onClick={startCreate}>
              清空
            </button>
          </div>

          <form className="form" onSubmit={submitForm}>
            <div className="grid two">
              <label>
                题目编号
                <input value={form.code} onChange={(event) => updateField("code", event.target.value)} required />
              </label>
              <label>
                学科
                <select value={form.subject} onChange={(event) => updateField("subject", event.target.value)}>
                  {subjectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              标题
              <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
            </label>

            <div className="grid three">
              <label>
                年级
                <input value={form.gradeLevel} onChange={(event) => updateField("gradeLevel", event.target.value)} />
              </label>
              <label>
                难度
                <select value={form.difficulty} onChange={(event) => updateField("difficulty", event.target.value)}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
              <label>
                题型
                <select
                  value={form.questionType}
                  onChange={(event) => updateField("questionType", event.target.value)}
                >
                  <option value="single_choice">single_choice</option>
                  <option value="multiple_choice">multiple_choice</option>
                  <option value="short_answer">short_answer</option>
                  <option value="essay">essay</option>
                </select>
              </label>
            </div>

            <label>
              题干
              <textarea value={form.stem} onChange={(event) => updateField("stem", event.target.value)} rows={5} required />
            </label>

            <label>
              参考答案
              <textarea
                value={form.answer}
                onChange={(event) => updateField("answer", event.target.value)}
                rows={3}
                required
              />
            </label>

            <label>
              解析
              <textarea value={form.analysis} onChange={(event) => updateField("analysis", event.target.value)} rows={4} />
            </label>

            <div className="grid two">
              <label>
                状态
                <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <div className="submit-wrap">
                <button type="submit" disabled={submitting}>
                  {submitting ? "保存中..." : editingId ? "更新题目" : "创建题目"}
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

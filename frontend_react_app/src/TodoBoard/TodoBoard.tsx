import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill } from "remotion";
import { FONT_FAMILY } from "../HelloWorld/constants";

type ColumnId = "today" | "tomorrow" | "later";

type Task = {
  id: string;
  title: string;
  notes?: string;
  createdAt: number;
};

type BoardData = Record<ColumnId, Task[]>;

const STORAGE_KEY = "smart-todo-board:v1";

const ACCENTS = {
  primary: "#3b82f6",
  success: "#06b6d4",
  error: "#EF4444",
  background: "#f9fafb",
  surface: "#ffffff",
  text: "#111827",
  mutedText: "#6b7280",
  border: "#e5e7eb",
};

const COLUMN_META: Array<{
  id: ColumnId;
  title: string;
  hint: string;
  pillBg: string;
  pillFg: string;
}> = [
  {
    id: "today",
    title: "Today",
    hint: "Focus items for the day",
    pillBg: "rgba(59,130,246,0.12)",
    pillFg: ACCENTS.primary,
  },
  {
    id: "tomorrow",
    title: "Tomorrow",
    hint: "Plan ahead",
    pillBg: "rgba(6,182,212,0.14)",
    pillFg: ACCENTS.success,
  },
  {
    id: "later",
    title: "Later",
    hint: "Backlog & ideas",
    pillBg: "rgba(100,116,139,0.14)",
    pillFg: "#475569",
  },
];

const createId = () => {
  // Low-collision id suitable for localStorage persistence.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

const getEmptyBoard = (): BoardData => ({
  today: [],
  tomorrow: [],
  later: [],
});

const safeParseBoard = (raw: string | null): BoardData | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Partial<Record<string, unknown>>;
    const result: BoardData = getEmptyBoard();

    (["today", "tomorrow", "later"] as const).forEach((col) => {
      const maybe = obj[col];
      if (!Array.isArray(maybe)) return;
      const tasks: Task[] = [];
      for (const t of maybe) {
        if (typeof t !== "object" || t === null) continue;
        const tt = t as Partial<Task>;
        if (typeof tt.id !== "string") continue;
        if (typeof tt.title !== "string") continue;
        const createdAt = typeof tt.createdAt === "number" ? tt.createdAt : Date.now();
        tasks.push({
          id: tt.id,
          title: tt.title,
          notes: typeof tt.notes === "string" ? tt.notes : undefined,
          createdAt,
        });
      }
      result[col] = tasks;
    });

    return result;
  } catch {
    return null;
  }
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    fontFamily: FONT_FAMILY,
    background: `linear-gradient(180deg, rgba(59,130,246,0.10), ${ACCENTS.background} 220px)`,
    color: ACCENTS.text,
  },
  frame: {
    padding: 28,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 750,
    letterSpacing: -0.2,
  },
  subtitle: {
    margin: 0,
    color: ACCENTS.mutedText,
    fontSize: 13,
    lineHeight: 1.4,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  button: {
    border: `1px solid ${ACCENTS.border}`,
    background: ACCENTS.surface,
    color: ACCENTS.text,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonPrimary: {
    border: `1px solid rgba(59,130,246,0.35)`,
    background: "rgba(59,130,246,0.10)",
    color: ACCENTS.primary,
  },
  buttonDanger: {
    border: `1px solid rgba(239,68,68,0.35)`,
    background: "rgba(239,68,68,0.08)",
    color: ACCENTS.error,
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },
  column: {
    border: `1px solid ${ACCENTS.border}`,
    background: ACCENTS.surface,
    borderRadius: 16,
    padding: 14,
    minHeight: 520,
    display: "flex",
    flexDirection: "column",
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  columnTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: 0,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.2,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  count: {
    color: ACCENTS.mutedText,
    fontSize: 12,
    fontWeight: 600,
  },
  dropZone: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "transparent",
    transition: "background 120ms ease, box-shadow 120ms ease",
  },
  dropZoneActive: {
    background: "rgba(59,130,246,0.06)",
    boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.18)",
  },
  addBox: {
    borderTop: `1px solid ${ACCENTS.border}`,
    paddingTop: 12,
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  input: {
    border: `1px solid ${ACCENTS.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    background: "#fff",
  },
  textarea: {
    border: `1px solid ${ACCENTS.border}`,
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    background: "#fff",
    minHeight: 70,
    resize: "vertical",
    fontFamily: FONT_FAMILY,
  },
  addRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  addHint: {
    color: ACCENTS.mutedText,
    fontSize: 12,
    lineHeight: 1.3,
  },
  card: {
    border: `1px solid ${ACCENTS.border}`,
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    boxShadow: "0 1px 0 rgba(17,24,39,0.02)",
    cursor: "grab",
  },
  cardDragging: {
    opacity: 0.55,
  },
  cardTitle: {
    margin: 0,
    fontSize: 13.5,
    fontWeight: 750,
    letterSpacing: -0.1,
  },
  cardNotes: {
    marginTop: 6,
    marginBottom: 0,
    fontSize: 12.5,
    color: ACCENTS.mutedText,
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  cardMeta: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 650,
  },
  iconButton: {
    border: `1px solid ${ACCENTS.border}`,
    background: ACCENTS.surface,
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  iconButtonPrimary: {
    border: `1px solid rgba(59,130,246,0.25)`,
    background: "rgba(59,130,246,0.08)",
    color: ACCENTS.primary,
  },
  iconButtonDanger: {
    border: `1px solid rgba(239,68,68,0.25)`,
    background: "rgba(239,68,68,0.07)",
    color: ACCENTS.error,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
};

type DragPayload = {
  taskId: string;
  fromColumn: ColumnId;
};

const isColumnId = (x: string): x is ColumnId =>
  x === "today" || x === "tomorrow" || x === "later";

const moveTask = (data: BoardData, payload: DragPayload, toColumn: ColumnId): BoardData => {
  if (payload.fromColumn === toColumn) return data;

  const fromList = data[payload.fromColumn];
  const idx = fromList.findIndex((t) => t.id === payload.taskId);
  if (idx === -1) return data;

  const task = fromList[idx];
  const nextFrom = [...fromList.slice(0, idx), ...fromList.slice(idx + 1)];
  const nextTo = [task, ...data[toColumn]]; // place on top for quick visibility

  return {
    ...data,
    [payload.fromColumn]: nextFrom,
    [toColumn]: nextTo,
  };
};

// PUBLIC_INTERFACE
export const TodoBoard: React.FC = () => {
  /**
   * Remotion Studio composition that renders an interactive 3-column to-do board.
   * Supports add/edit/delete, HTML5 drag-and-drop between columns, and localStorage persistence.
   */
  const isBrowser = typeof globalThis !== "undefined" && "localStorage" in globalThis;

  const [board, setBoard] = useState<BoardData>(() => {
    // localStorage is available in Remotion Studio (browser).
    if (!isBrowser) return getEmptyBoard();
    const parsed = safeParseBoard(globalThis.localStorage.getItem(STORAGE_KEY));
    return parsed ?? getEmptyBoard();
  });

  const [activeDropCol, setActiveDropCol] = useState<ColumnId | null>(null);

  // Per-column "add task" draft state
  const [drafts, setDrafts] = useState<Record<ColumnId, { title: string; notes: string }>>({
    today: { title: "", notes: "" },
    tomorrow: { title: "", notes: "" },
    later: { title: "", notes: "" },
  });

  const persistTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  // Persist changes (debounced a tiny bit to avoid excessive writes)
  useEffect(() => {
    if (!isBrowser) return;

    if (persistTimer.current) globalThis.clearTimeout(persistTimer.current);
    persistTimer.current = globalThis.setTimeout(() => {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    }, 80);

    return () => {
      if (persistTimer.current) globalThis.clearTimeout(persistTimer.current);
    };
  }, [board, isBrowser]);

  const totalCount = useMemo(
    () => board.today.length + board.tomorrow.length + board.later.length,
    [board],
  );

  const addTask = useCallback(
    (columnId: ColumnId) => {
      const title = drafts[columnId].title.trim();
      const notes = drafts[columnId].notes.trim();

      if (!title) return;

      const newTask: Task = {
        id: createId(),
        title,
        notes: notes ? notes : undefined,
        createdAt: Date.now(),
      };

      setBoard((prev) => ({
        ...prev,
        [columnId]: [newTask, ...prev[columnId]],
      }));

      setDrafts((prev) => ({
        ...prev,
        [columnId]: { title: "", notes: "" },
      }));
    },
    [drafts],
  );

  const deleteTask = useCallback((columnId: ColumnId, taskId: string) => {
    setBoard((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== taskId),
    }));
  }, []);

  const editTask = useCallback((columnId: ColumnId, taskId: string) => {
    if (!isBrowser) return;

    setBoard((prev) => {
      const list = prev[columnId];
      const idx = list.findIndex((t) => t.id === taskId);
      if (idx === -1) return prev;

      const current = list[idx];

      const newTitle = globalThis.prompt("Edit task title", current.title);
      if (newTitle === null) return prev;

      const trimmedTitle = newTitle.trim();
      if (!trimmedTitle) return prev;

      const newNotes = globalThis.prompt("Edit notes (optional)", current.notes ?? "");
      if (newNotes === null) {
        // user cancelled notes prompt: keep current notes, but apply title change
        const updated: Task = { ...current, title: trimmedTitle };
        const next = [...list];
        next[idx] = updated;
        return { ...prev, [columnId]: next };
      }

      const trimmedNotes = newNotes.trim();

      const updated: Task = {
        ...current,
        title: trimmedTitle,
        notes: trimmedNotes ? trimmedNotes : undefined,
      };

      const next = [...list];
      next[idx] = updated;
      return { ...prev, [columnId]: next };
    });
  }, [isBrowser]);

  const clearAll = useCallback(() => {
    if (!isBrowser) return;

    const ok = globalThis.confirm("Clear all tasks? This cannot be undone.");
    if (!ok) return;
    setBoard(getEmptyBoard());
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }, [isBrowser]);

  const handleDragStart = useCallback((e: React.DragEvent, from: ColumnId, taskId: string) => {
    const payload: DragPayload = { taskId, fromColumn: from };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, to: ColumnId) => {
    e.preventDefault();
    setActiveDropCol(null);

    const rawJson = e.dataTransfer.getData("application/json");
    if (!rawJson) return;

    try {
      const parsed = JSON.parse(rawJson) as Partial<DragPayload>;
      if (!parsed || typeof parsed.taskId !== "string" || typeof parsed.fromColumn !== "string")
        return;
      if (!isColumnId(parsed.fromColumn)) return;

      const payload: DragPayload = { taskId: parsed.taskId, fromColumn: parsed.fromColumn };

      setBoard((prev) => moveTask(prev, payload, to));
    } catch {
      // ignore invalid drops
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: ColumnId) => {
    e.preventDefault();
    setActiveDropCol(col);
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragLeave = useCallback((_e: React.DragEvent, col: ColumnId) => {
    // Avoid flicker: only clear if the active column matches.
    setActiveDropCol((prev) => (prev === col ? null : prev));
  }, []);

  return (
    <AbsoluteFill style={{ ...styles.app }}>
      <div style={styles.frame}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>Smart To‑Do Organizer</h1>
            <p style={styles.subtitle}>
              Drag tasks between <strong>Today</strong>, <strong>Tomorrow</strong>, and{" "}
              <strong>Later</strong>. Changes persist in localStorage.
            </p>
          </div>

          <div style={styles.toolbar}>
            <div style={{ ...styles.count }}>{totalCount} tasks</div>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonPrimary }}
              onClick={() => {
                // Quick add into Today
                setDrafts((prev) => ({
                  ...prev,
                  today: { ...prev.today, title: prev.today.title || "New task" },
                }));
              }}
              title="Quick add placeholder text into Today"
            >
              Quick add
            </button>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonDanger }}
              onClick={clearAll}
              title="Clear all tasks"
            >
              Clear all
            </button>
          </div>
        </div>

        <div style={styles.board}>
          {COLUMN_META.map((col) => {
            const items = board[col.id];
            const isActive = activeDropCol === col.id;

            return (
              <section key={col.id} style={styles.column} aria-label={`${col.title} column`}>
                <div style={styles.columnHeader}>
                  <h2 style={styles.columnTitle}>
                    <span style={{ ...styles.pill, background: col.pillBg, color: col.pillFg }}>
                      {col.title}
                    </span>
                    <span style={styles.count}>{items.length}</span>
                  </h2>

                  <span style={{ ...styles.count }} title={col.hint}>
                    {col.hint}
                  </span>
                </div>

                <div
                  style={{
                    ...styles.dropZone,
                    ...(isActive ? styles.dropZoneActive : null),
                  }}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  role="list"
                  aria-label={`${col.title} tasks`}
                >
                  {items.length === 0 ? (
                    <div
                      style={{
                        color: ACCENTS.mutedText,
                        fontSize: 12.5,
                        padding: "10px 8px",
                        borderRadius: 12,
                        border: `1px dashed ${ACCENTS.border}`,
                        background: "rgba(17,24,39,0.01)",
                      }}
                    >
                      Drop tasks here, or add a new one below.
                    </div>
                  ) : null}

                  {items.map((t) => (
                    <article
                      key={t.id}
                      style={styles.card}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id, t.id)}
                      role="listitem"
                      aria-label={`Task: ${t.title}`}
                      title="Drag to move"
                    >
                      <h3 style={styles.cardTitle}>{t.title}</h3>
                      {t.notes ? <p style={styles.cardNotes}>{t.notes}</p> : null}

                      <div style={styles.cardFooter}>
                        <div style={styles.cardMeta}>
                          {new Date(t.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "2-digit",
                          })}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            style={{ ...styles.iconButton, ...styles.iconButtonPrimary }}
                            onClick={() => editTask(col.id, t.id)}
                            aria-label="Edit task"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={{ ...styles.iconButton, ...styles.iconButtonDanger }}
                            onClick={() => deleteTask(col.id, t.id)}
                            aria-label="Delete task"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div style={styles.addBox}>
                  <label style={styles.srOnly} htmlFor={`${col.id}-title`}>
                    Add task title
                  </label>
                  <input
                    id={`${col.id}-title`}
                    style={styles.input}
                    placeholder="Add a task…"
                    value={drafts[col.id].title}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [col.id]: { ...prev[col.id], title: e.target.value },
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTask(col.id);
                    }}
                  />

                  <label style={styles.srOnly} htmlFor={`${col.id}-notes`}>
                    Add task notes (optional)
                  </label>
                  <textarea
                    id={`${col.id}-notes`}
                    style={styles.textarea}
                    placeholder="Notes (optional)…"
                    value={drafts[col.id].notes}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [col.id]: { ...prev[col.id], notes: e.target.value },
                      }))
                    }
                  />

                  <div style={styles.addRow}>
                    <button
                      type="button"
                      style={{ ...styles.button, ...styles.buttonPrimary }}
                      onClick={() => addTask(col.id)}
                    >
                      Add
                    </button>
                    <div style={styles.addHint}>
                      Tip: press <strong>Enter</strong> in the title field to add quickly. Drag
                      cards between columns.
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

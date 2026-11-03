"use client";

import { useEffect, useState, type ComponentType } from "react";
import { EditorDialog } from "./EditorDialog";

/** Keep editor code off the initial route while giving immediate, cancellable feedback. */
export function DeferredEditor<P extends { onClose: () => void }>({ load, title, editorProps }: {
  load: () => Promise<{ default: ComponentType<P> }>;
  title: string;
  editorProps: P;
}) {
  const [Editor, setEditor] = useState<ComponentType<P> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    load().then(module => {
      if (active) setEditor(() => module.default);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [load, attempt]);
  if (Editor) return <Editor {...editorProps} />;
  return <EditorDialog open title={title} onClose={editorProps.onClose}>
    {failed ? <><p role="alert">编辑器加载失败，请重试。</p><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重试</button></> : <p role="status">正在加载…</p>}
  </EditorDialog>;
}

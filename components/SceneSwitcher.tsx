"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SCENES, SCENE_BY_HOTKEY, type SceneId } from "@/lib/scenes";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";

export function SceneSwitcher({
  current,
  variant = "bar",
}: {
  current: SceneId;
  variant?: "bar" | "compact";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { tScene } = useLocale();

  const goto = (id: SceneId) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("scene", id);
    router.replace(`/broadcast?${sp.toString()}`);
  };

  // Alt+digit hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (inField) return;
      const sceneId = SCENE_BY_HOTKEY.get(e.key);
      if (sceneId) {
        e.preventDefault();
        goto(sceneId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto",
        variant === "bar"
          ? "px-3 py-2 bg-black/50 border-t border-white/10"
          : "p-1 bg-[var(--bg-card)] rounded-md",
      )}
    >
      {SCENES.map((s) => (
        <button
          key={s.id}
          onClick={() => goto(s.id)}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider whitespace-nowrap border transition-colors",
            current === s.id
              ? "bg-[var(--accent-counting)]/30 border-[var(--accent-counting)]/60 text-[var(--accent-counting)]"
              : "border-transparent text-white/60 hover:text-white hover:bg-white/5",
          )}
          title={s.description}
        >
          <kbd className="px-1 rounded bg-black/40 border border-white/15 text-[9px] tabular">
            ⌥{s.hotkey}
          </kbd>
          {tScene(s.id)}
        </button>
      ))}
    </div>
  );
}

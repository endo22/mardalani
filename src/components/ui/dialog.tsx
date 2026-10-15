"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "fixed inset-0 m-auto max-h-[min(90vh,40rem)] w-[min(100%-1.5rem,32rem)] overflow-auto rounded-[var(--radius-lg)] bg-cream p-0 text-charcoal shadow-[var(--shadow-lift)] open:flex open:flex-col backdrop:bg-forest/55",
        className,
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-forest/10 px-5 py-4">
        <div>
          <h2 id={titleId} className="text-h3 font-display text-forest">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1 text-body-sm text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close dialog"
          onClick={onClose}
          className="shrink-0"
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

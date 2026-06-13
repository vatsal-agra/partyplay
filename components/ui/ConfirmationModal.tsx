"use client";

import React from 'react';

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="glass-strong w-full max-w-md p-6 shadow-soft">
        <h2 className="font-display text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-all hover:brightness-110 active:scale-95"
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

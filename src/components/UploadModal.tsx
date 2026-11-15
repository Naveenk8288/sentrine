'use client';

import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import type { FeedbackReview } from '@/lib/analysis/types';
import { OBSIDIAN_INPUT, ViewfinderBrackets } from './ObsidianPrimitives';
import type { UploadApiResponse } from './types';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: (reviews: FeedbackReview[], datasetLabel: string) => void;
}

const SAMPLE_CSV_SNIPPET = `id,date,product,category,rating,review_text
REV-9001,2026-10-01,NovaBuds,Audio,5,"Battery lasts all day and setup was effortless."
REV-9002,2026-10-02,NovaBuds,Audio,1,"Firmware update v2.1 broke Bluetooth pairing and battery drains fast."
REV-9003,2026-10-02,NovaBuds,Audio,1,"After update v2.1 the left earbud disconnects constantly."`;

export default function UploadModal({
  open,
  onClose,
  onUploadSuccess,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [csvText, setCsvText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadApiResponse | null>(null);

  if (!open) return null;

  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      let res: Response;
      let label = 'Custom CSV';

      if (mode === 'file') {
        if (!selectedFile) {
          throw new Error('Please choose a CSV file first.');
        }
        label = selectedFile.name;
        const formData = new FormData();
        formData.append('file', selectedFile);
        res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      } else {
        if (!csvText.trim()) {
          throw new Error('Please paste CSV rows first.');
        }
        label = 'Pasted CSV Dataset';
        res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText }),
        });
      }

      const json = (await res.json()) as UploadApiResponse;
      if (!res.ok || !json.success || !json.reviews) {
        throw new Error(json.error || 'CSV processing failed');
      }

      setSummary(json);
      onUploadSuccess(json.reviews, label);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#080503]/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-[#d4a55c]/30 bg-[#150f0b] p-5 pb-7 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:pb-5">
        <ViewfinderBrackets className="border-[#c9644c]/60" sizeClass="h-3.5 w-3.5" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="upload-modal-title"
              className="font-editorial flex items-center gap-2 text-lg font-bold text-[#faf5ee]"
            >
              <FileSpreadsheet className="h-5 w-5 text-[#e6b86e]" />
              <span>Upload Customer Feedback CSV</span>
            </h2>
            <p className="mt-1 text-xs text-[#9b8a76]">
              Required columns: <code className="font-mono text-[#e6b86e]">date</code>,{' '}
              <code className="font-mono text-[#e6b86e]">review_text</code>. Optional:{' '}
              <code className="font-mono text-[#d6c7b4]">id, product, category, rating</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9b8a76] hover:bg-[#231910] hover:text-[#faf5ee]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-[#d4a55c]/22 bg-[#0e0a07] p-1">
          <button
            type="button"
            onClick={() => setMode('file')}
            className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'file'
                ? 'bg-[#e6b86e] font-semibold text-[#140e0a]'
                : 'text-[#b6a592] hover:text-[#faf5ee]'
            }`}
          >
            Choose File
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'paste'
                ? 'bg-[#e6b86e] font-semibold text-[#140e0a]'
                : 'text-[#b6a592] hover:text-[#faf5ee]'
            }`}
          >
            Paste CSV Text
          </button>
        </div>

        {mode === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setSelectedFile(file);
            }}
            className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragOver
                ? 'border-[#e6b86e] bg-[#241a10]'
                : 'border-[#d4a55c]/30 bg-[#1a130d]/80'
            }`}
          >
            <Upload className="h-8 w-8 text-[#e6b86e]" />
            <p className="mt-2 text-sm font-medium text-[#faf5ee]">
              {selectedFile ? selectedFile.name : 'Tap to choose a CSV file or drag & drop'}
            </p>
            <p className="mt-1 text-xs text-[#9b8a76]">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB ready for sentiment & topic analysis`
                : 'Works on Android, iOS/macOS Files & desktop browsers'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 min-h-[40px] rounded-lg border border-[#d4a55c]/35 bg-[#0e0a07] px-4 py-2 text-xs font-medium text-[#e6b86e] transition hover:border-[#e6b86e] hover:bg-[#1f160f]"
            >
              Browse CSV File
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-[#cbbba7]">CSV Content</label>
              <button
                type="button"
                onClick={() => setCsvText(SAMPLE_CSV_SNIPPET)}
                className="text-xs font-medium text-[#e6b86e] hover:underline"
              >
                Insert Sample Rows
              </button>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE_CSV_SNIPPET}
              className={`${OBSIDIAN_INPUT} w-full p-3 font-mono text-base sm:text-xs`}
            />
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-[#d96b52]/40 bg-[#d96b52]/12 p-3 text-xs text-[#f29b87]">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-4 rounded-xl border border-[#8bb87e]/40 bg-[#8bb87e]/12 p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[#b2d9a5]">
              <CheckCircle2 className="h-4 w-4" />
              <span>{summary.message}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[#e6d5bf] sm:grid-cols-4">
              <div>Valid: {summary.validationSummary.validRows}</div>
              <div>Dropped: {summary.validationSummary.droppedRows}</div>
              <div>Bad Dates: {summary.validationSummary.invalidDates}</div>
              <div>Empty Text: {summary.validationSummary.emptyTexts}</div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-lg border border-[#d4a55c]/28 bg-[#1b140e] px-4 py-2 text-sm font-medium text-[#e6d5bf] hover:bg-[#241a11]"
          >
            {summary ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleUpload()}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#e6b86e] px-4 py-2 text-sm font-semibold text-[#140e0a] hover:bg-[#f0c783] disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Analyze &amp; Load Dataset</span>
          </button>
        </div>
      </div>
    </div>
  );
}

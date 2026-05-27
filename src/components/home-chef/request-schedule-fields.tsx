"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const date = parseDateInput(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function formatTimeLabel(value: string) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function buildTimeWindow(startTime: string, endTime: string) {
  const startLabel = formatTimeLabel(startTime);
  const endLabel = formatTimeLabel(endTime);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel || endLabel;
}

function getMonthDays(viewMonth: Date) {
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index + 1)),
  ];
}

export function RequestScheduleFields({
  defaultDate,
  defaultStartTime = "16:00",
  defaultEndTime = "20:00",
}: {
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [draftDate, setDraftDate] = useState(defaultDate);
  const [viewMonth, setViewMonth] = useState(() => parseDateInput(defaultDate));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  const monthDays = useMemo(() => getMonthDays(viewMonth), [viewMonth]);
  const requestedTimeWindow = buildTimeWindow(startTime, endTime);

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <input type="hidden" name="requestedDate" value={selectedDate} />
      <input type="hidden" name="requestedTimeWindow" value={requestedTimeWindow} />

      <div className="relative">
        <span className="mb-2 block text-sm font-medium text-[var(--color-ink)]">Requested date</span>
        <button
          type="button"
          aria-expanded={isCalendarOpen}
          onClick={() => {
            setDraftDate(selectedDate);
            setViewMonth(parseDateInput(selectedDate));
            setIsCalendarOpen((open) => !open);
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-left text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
        >
          <span>{formatDateLabel(selectedDate)}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Change</span>
        </button>

        {isCalendarOpen ? (
          <div className="absolute z-20 mt-2 w-full min-w-72 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm font-semibold"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              >
                Prev
              </button>
              <p className="text-sm font-semibold text-[var(--color-ink)]">{monthFormatter.format(viewMonth)}</p>
              <button
                type="button"
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm font-semibold"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              >
                Next
              </button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {monthDays.map((date, index) => {
                const value = date ? toDateInputValue(date) : "";
                const isSelected = value === draftDate;
                return date ? (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraftDate(value)}
                    className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-ink)] hover:bg-slate-100"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                ) : (
                  <span key={`blank-${index}`} />
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsCalendarOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSelectedDate(draftDate);
                  setIsCalendarOpen(false);
                }}
              >
                Save date
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Start time"
          type="time"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <TextInput
          label="End time"
          type="time"
          value={endTime}
          onChange={(event) => setEndTime(event.target.value)}
        />
      </div>
    </div>
  );
}

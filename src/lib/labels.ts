import type { TFunction } from "i18next";
import type { ProblemType, ReportEventKind, ReportStatus, Severity } from "../types";

/**
 * Thin wrappers around the translation keys for the app's closed enum sets
 * (problem type, severity, status, event kind). Centralized here so every
 * call site does `xLabel(t, value)` instead of re-typing the key template.
 */

export function problemTypeLabel(t: TFunction, type: ProblemType): string {
  return t(`problemType.${type}`);
}

/**
 * The responsible department is always a deterministic function of the
 * problem type (see backend/app/mock_ai.py and
 * supabase/functions/urbaneye-api/index.ts — every AI backend picks it from
 * problem_type alone). Deriving it here instead of showing the raw
 * `analysis.department` string stored on the report keeps department
 * display/filtering correct and language-consistent even for reports that
 * were created before this fix, or in the other language.
 */
export function departmentLabel(t: TFunction, type: ProblemType): string {
  return t(`department.${type}`);
}

export function severityLabel(t: TFunction, severity: Severity): string {
  return t(`severity.${severity}`);
}

export function statusLabel(t: TFunction, status: ReportStatus): string {
  return t(`status.${status}`);
}

export function eventLabel(t: TFunction, kind: ReportEventKind): string {
  return t(`event.${kind}`);
}

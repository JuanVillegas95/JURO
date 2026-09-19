import type { ReactNode } from "react";

export type DisplayError = {
  message: string;
  hint?: string;
  code?: string;
  requestId?: string;
};

export function ErrorMessage({ error, children, className }: { error: DisplayError | string; children?: ReactNode; className?: string }) {
  const value = typeof error === "string" ? { message: error } : error;
  return (
    <div className={`error-message${className ? ` ${className}` : ""}`} role="alert">
      <strong>{value.message}</strong>
      {value.hint ? <span>{value.hint}</span> : null}
      {children}
      {value.requestId ? <small>Request ID: {value.requestId}</small> : null}
    </div>
  );
}

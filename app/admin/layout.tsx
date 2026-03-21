import type { ReactNode } from "react";

/** Admin has long forms: scroll inside this shell only; root body stays overflow-hidden. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
      {children}
    </div>
  );
}

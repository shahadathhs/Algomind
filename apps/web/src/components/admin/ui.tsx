import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** A labelled text field: a chamfered tile with a 2 px ink outline. */
export function Field({
  label,
  id,
  hint,
  ...input
}: { label: string; id: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs tracking-[2px] text-mute uppercase">
        {label}
      </label>
      <span className="tile block bg-ink p-[2px]" style={{ ["--chamfer" as string]: "12px" }}>
        <input
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="block h-12 w-full bg-floor px-4 text-base text-ink focus-visible:outline-offset-[-7px]"
          {...input}
        />
      </span>
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm font-semibold text-mute">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The one primary action on a screen: a signal-yellow tile. */
export function PrimaryAction({
  children,
  className = "",
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`tile inline-flex h-14 items-center justify-center bg-signal px-8 text-lg tracking-[2px] text-on-signal uppercase disabled:bg-faint disabled:text-mute ${className}`}
      style={{ ["--chamfer" as string]: "12px" }}
      {...button}
    >
      {children}
    </button>
  );
}

/** A secondary action: an outlined tile. */
export function OutlineAction({
  children,
  className = "",
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`tile inline-block bg-ink p-[2px] disabled:bg-faint ${className}`}
      style={{ ["--chamfer" as string]: "10px" }}
      {...button}
    >
      <span
        className="tile flex h-11 items-center justify-center bg-ground px-5 text-[13px] tracking-[2px] text-ink uppercase"
        style={{ ["--chamfer" as string]: "8.8px" }}
      >
        {children}
      </span>
    </button>
  );
}

/** An error or status message. The label means the state is never only a color. */
export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className="flex items-start gap-3 text-[15px] font-semibold"
    >
      <span
        className="tile mt-px shrink-0 bg-ink px-2 py-0.5 text-xs tracking-[2px] text-on-ink uppercase"
        style={{ ["--chamfer" as string]: "6px" }}
      >
        {kind === "error" ? "Error" : "Note"}
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Screen title block: a small caption over the title. */
export function PageHeading({ caption, title }: { caption: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs tracking-[2px] text-mute uppercase">{caption}</p>
      <h1 className="text-[34px] leading-tight tracking-[1px] uppercase">{title}</h1>
    </div>
  );
}

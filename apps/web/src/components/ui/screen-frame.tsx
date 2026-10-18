import type { ReactNode } from "react";

/**
 * A flat chamfered frame around a drawn game screen: an ink outline, top-right corner cut, no
 * bezel, no shadow. `sm` is for the row of small screens.
 */
export function ScreenFrame({
  children,
  size = "lg",
  className = "",
}: {
  children: ReactNode;
  size?: "lg" | "sm";
  className?: string;
}) {
  const large = size === "lg";
  return (
    <div
      className={`tile bg-ink ${large ? "p-[3px]" : "p-[2px]"} ${className}`}
      style={{ ["--chamfer" as string]: large ? "20px" : "12px" }}
    >
      <div
        className="tile bg-ground"
        style={{ ["--chamfer" as string]: large ? "18.3px" : "10.8px" }}
      >
        {children}
      </div>
    </div>
  );
}

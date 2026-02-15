"use client";

/**
 * Premium loading UI: ring spinner + optional message.
 * Use variant="screen" for full-page or section loading; variant="inline" for buttons/small areas.
 */
export default function Loading({
  message,
  size = "md",
  variant = "screen",
  className = "",
  invert = false,
}) {
  const sizeClass =
    size === "sm" ? "loader-ring-sm" : size === "lg" ? "loader-ring-lg" : "loader-ring-md";

  const spinner = (
    <div
      className={`loader-ring ${sizeClass} ${invert ? "loader-ring-white" : ""}`}
      role="status"
      aria-label={message || "Loading"}
    />
  );

  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center justify-center gap-2 ${className}`}>
        {spinner}
        {message && (
          <span className="text-sm font-bold uppercase tracking-widest text-muted">{message}</span>
        )}
      </span>
    );
  }

  const isScreen = variant === "screen";
  return (
    <div
      className={`animate-fade-in flex flex-col items-center justify-center gap-5 ${className}`}
      style={{
        minHeight: isScreen ? "60vh" : undefined,
        paddingTop: isScreen ? "6rem" : undefined,
      }}
    >
      {spinner}
      {message && (
        <p className="text-sm font-black uppercase tracking-widest text-muted">{message}</p>
      )}
    </div>
  );
}

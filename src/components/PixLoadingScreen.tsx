export function PixLoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-white"
      role="status"
      aria-live="polite"
      aria-label="Gerando Pix"
    >
      <span className="h-14 w-14 animate-spin rounded-full border-[4px] border-[#3483fa] border-r-transparent" />
      <span className="sr-only">Gerando Pix…</span>
    </div>
  );
}

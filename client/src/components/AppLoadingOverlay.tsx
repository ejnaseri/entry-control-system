type AppLoadingOverlayProps = {
  show: boolean;
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
  dir?: "ltr" | "rtl";
};

export function AppLoadingOverlay({
  show,
  message = "Loading...",
  subtitle,
  fullScreen = true,
  dir,
}: AppLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={`app-loader-overlay ${fullScreen ? "app-loader-overlay--fixed" : "app-loader-overlay--absolute"}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      dir={dir}
    >
      <div className="app-loader-card">
        <span className="app-loader-orb app-loader-orb--one" aria-hidden />
        <span className="app-loader-orb app-loader-orb--two" aria-hidden />
        <span className="app-loader-orb app-loader-orb--three" aria-hidden />
        <div className="app-loader-ring" aria-hidden>
          <span className="app-loader-ring__inner" />
        </div>
        <p className="app-loader-title">{message}</p>
        {subtitle ? <p className="app-loader-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  );
}

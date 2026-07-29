type StoreBadgeProps = {
  store: "apple" | "google";
};

export function StoreBadge({ store }: StoreBadgeProps) {
  const isApple = store === "apple";

  return (
    <div
      className="store-badge store-badge--pending"
      aria-label={isApple ? "Kommer til App Store" : "Kommer til Google Play"}
    >
      {isApple ? (
        <svg
          width="26"
          height="30"
          viewBox="0 0 24 28"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M19.7 14.9c0-3.3 2.7-4.9 2.8-5-1.5-2.2-3.9-2.5-4.8-2.5-2-.2-4 1.2-5 1.2-1.1 0-2.8-1.2-4.6-1.1-2.3 0-4.5 1.4-5.7 3.4-2.5 4.3-.6 10.5 1.7 14 1.2 1.7 2.5 3.5 4.4 3.4 1.7-.1 2.4-1.1 4.5-1.1 2 0 2.7 1.1 4.5 1 1.9 0 3-1.7 4.1-3.4 1.3-1.9 1.9-3.8 1.9-3.9-.1 0-3.8-1.5-3.8-6Zm-3.3-9.6c.9-1.1 1.5-2.7 1.3-4.3-1.4.1-3 .9-4 2-.9 1-1.6 2.6-1.4 4.1 1.5.1 3.1-.7 4.1-1.8Z" />
        </svg>
      ) : (
        <svg width="27" height="30" viewBox="0 0 28 31" aria-hidden="true">
          <path
            fill="#00d7fe"
            d="M1.4 1.8 16 15.4 1.5 29.2c-.8-.6-1.3-1.6-1.3-2.8V4.5c0-1.1.4-2 1.2-2.7Z"
          />
          <path
            fill="#00f076"
            d="m18 13.5-4-3.8L3.8.4c.7-.3 1.5-.2 2.3.2L22 9.5l-4 4Z"
          />
          <path
            fill="#ffca28"
            d="m18 17.3 4.2 4.1-16 9c-.8.4-1.6.5-2.3.2L14 21l4-3.7Z"
          />
          <path
            fill="#ff3d56"
            d="M26.2 13.1c2 1.1 2 3 0 4.1l-4.1 2.3-4.2-4.1 4.2-4 4.1 1.7Z"
          />
        </svg>
      )}

      <span>
        <span className="store-badge__small">Kommer til</span>
        <span className="store-badge__large">
          {isApple ? "App Store" : "Google Play"}
        </span>
        <span className="store-badge__status">Under udvikling</span>
      </span>
    </div>
  );
}

export const Skeleton = ({ width, height = 14, radius = 6, className = '', style }) => (
  <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />
);

export const ProjectCardSkeleton = () => (
  <div className="project-card project-card-skeleton" aria-hidden="true">
    <div className="project-thumb">
      <Skeleton height="100%" radius={0} />
    </div>
    <div className="project-meta">
      <Skeleton width="62%" height={16} />
      <Skeleton width="40%" height={12} style={{ marginTop: 10 }} />
    </div>
  </div>
);

export const PaperSkeleton = ({ label }) => (
  <div className="paper-skeleton" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {[0, 1].map((page) => (
      <div className="paper-skeleton-page" key={page} aria-hidden="true">
        <Skeleton width="55%" height={22} style={{ margin: '0 auto 10px' }} />
        <Skeleton width="30%" height={10} style={{ margin: '0 auto 28px' }} />
        {Array.from({ length: 13 }, (_, i) => (
          <Skeleton key={i} width={`${i % 5 === 4 ? 62 : 100 - ((i * 7) % 14)}%`} height={8} style={{ marginBottom: 11 }} />
        ))}
      </div>
    ))}
  </div>
);

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronUp, CircleAlert, Info, ScrollText, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, timeAgo } from '../../lib/format.js';

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info };

export const BuildPanel = ({ build, compiling, onJump, open, onOpenChange }) => {
  const [tab, setTab] = useState('problems');
  const previousStamp = useRef(null);

  const counts = useMemo(() => {
    const result = { error: 0, warning: 0, info: 0 };
    for (const item of build?.diagnostics ?? []) result[item.type] += 1;
    return result;
  }, [build]);

  useEffect(() => {
    if (!build || build.builtAt === previousStamp.current) return;
    previousStamp.current = build.builtAt;
    if (counts.error > 0) {
      setTab('problems');
      onOpenChange(true);
    }
  }, [build, counts.error, onOpenChange]);

  const status = compiling ? 'busy' : !build ? 'none' : build.ok ? 'ok' : 'failed';

  return (
    <section className={`build ${open ? 'is-open' : ''}`} aria-label="Build results">
      <div className="build-bar">
        <button type="button" className="build-toggle" onClick={() => onOpenChange(!open)} aria-expanded={open}>
          <ChevronUp size={15} className="build-chevron" aria-hidden />
          <span className={`build-status is-${status}`}>
            {status === 'ok' && <CheckCircle2 size={15} aria-hidden />}
            {status === 'failed' && <CircleAlert size={15} aria-hidden />}
            {status === 'busy' && <span className="pulse-dot" aria-hidden="true" />}
            {status === 'none' && <ScrollText size={15} aria-hidden />}
            {status === 'busy' ? 'Compiling…' : status === 'ok' ? 'Compiled' : status === 'failed' ? 'Build failed' : 'Not compiled yet'}
          </span>
        </button>
        {build && (
          <span className="build-meta tabular">
            {formatDuration(build.durationMs)} · {timeAgo(build.builtAt)}
          </span>
        )}
        <span className="build-counts">
          <span className={`count ${counts.error ? 'has-error' : ''}`} title="Errors">
            <CircleAlert size={13} aria-hidden /> {counts.error}
          </span>
          <span className={`count ${counts.warning ? 'has-warning' : ''}`} title="Warnings">
            <TriangleAlert size={13} aria-hidden /> {counts.warning}
          </span>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="build-body" initial={{ height: 0 }} animate={{ height: 190 }} exit={{ height: 0 }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="build-tabs" role="tablist" aria-label="Build output">
              {[
                ['problems', 'Problems'],
                ['log', 'Log'],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`build-tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="build-scroll" role="tabpanel">
              {!build ? (
                <p className="build-empty">Compile your project to see problems and the full log here.</p>
              ) : tab === 'log' ? (
                <pre className="build-log">{build.log || 'The build produced no log output.'}</pre>
              ) : build.diagnostics.length === 0 ? (
                <p className="build-empty">
                  <CheckCircle2 size={16} aria-hidden /> No problems found.
                </p>
              ) : (
                <ul className="problems">
                  {build.diagnostics.map((item, index) => {
                    const Icon = ICONS[item.type];
                    const jumpable = item.file && item.line;
                    return (
                      <li key={`${item.type}-${item.file}-${item.line}-${index}`}>
                        <button type="button" className={`problem is-${item.type}`} disabled={!jumpable} onClick={() => jumpable && onJump(item.file, item.line)}>
                          <Icon size={15} aria-hidden />
                          <span className="problem-text">{item.message}</span>
                          {jumpable && (
                            <span className="problem-loc tabular">
                              {item.file}:{item.line}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

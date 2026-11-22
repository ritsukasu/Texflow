import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, FileText, Play, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SOURCE = String.raw`\documentclass{article}
\usepackage{amsmath}

\title{Stability of Gradient Flows}
\author{A. Researcher}

\begin{document}
\maketitle

\begin{abstract}
We show that the energy decays
exponentially along the flow.
\end{abstract}

\section{Introduction}
Consider the Dirichlet energy
\begin{equation}
  E(u) = \int_\Omega \tfrac12 |\nabla u|^2 \, dx
\end{equation}
\end{document}`;

const marker = (text) => SOURCE.indexOf(text) + text.length;
const STAGES = [
  { id: 'title', at: marker('\\maketitle') },
  { id: 'abstract', at: marker('\\end{abstract}') },
  { id: 'section', at: marker('Consider the Dirichlet energy') },
  { id: 'equation', at: marker('\\end{equation}') },
];

const TOKEN = /(%.*$|\\[A-Za-z]+|[{}[\]]|\$[^$]*\$)/g;

const highlight = (line) => {
  const parts = line.split(TOKEN);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('%')) return <span key={index} className="tok-comment">{part}</span>;
    if (part.startsWith('\\')) return <span key={index} className="tok-command">{part}</span>;
    if (part.startsWith('$')) return <span key={index} className="tok-math">{part}</span>;
    if ('{}[]'.includes(part)) return <span key={index} className="tok-bracket">{part}</span>;
    return part;
  });
};

const reveal = {
  initial: { opacity: 0, y: 10, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.55, ease: [0.2, 0.8, 0.2, 1] },
};

export const LandingDemo = () => {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);
  const finished = count >= SOURCE.length;

  useEffect(() => {
    if (reduced) {
      setCount(SOURCE.length);
      return undefined;
    }
    if (!inView) return undefined;
    setCount(0);
    let index = 0;
    let timer;
    const tick = () => {
      index = Math.min(SOURCE.length, index + 2);
      setCount(index);
      if (index >= SOURCE.length) return;
      timer = window.setTimeout(tick, SOURCE[index - 1] === '\n' ? 110 : 17);
    };
    timer = window.setTimeout(tick, run === 0 ? 1700 : 300);
    return () => window.clearTimeout(timer);
  }, [inView, reduced, run]);

  const typed = SOURCE.slice(0, count);
  const lines = useMemo(() => typed.split('\n'), [typed]);
  const visible = useMemo(() => new Set(STAGES.filter((stage) => count >= stage.at).map((stage) => stage.id)), [count]);
  const replay = useCallback(() => setRun((value) => value + 1), []);

  return (
    <div className="demo" ref={rootRef} id="example">
      <div className="demo-glow" aria-hidden="true" />
      <div className="demo-window" role="img" aria-label="Animated example of LaTeX source being typed on the left and the rendered paper appearing on the right">
        <div className="demo-bar">
          <span className="demo-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="demo-tab">
            <FileText size={14} aria-hidden /> main.tex
          </span>
          <span className="demo-status" aria-live="off">
            <AnimatePresence mode="wait" initial={false}>
              {finished ? (
                <motion.span key="done" className="demo-pill is-done" {...reveal}>
                  <Check size={13} aria-hidden /> Compiled in 1.4 s
                </motion.span>
              ) : (
                <motion.span key="typing" className="demo-pill" {...reveal}>
                  <span className="pulse-dot" aria-hidden="true" /> Writing
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <button type="button" className="demo-replay" onClick={replay} aria-label="Replay the example" tabIndex={-1}>
            {finished ? <RotateCw size={14} /> : <Play size={14} />}
          </button>
        </div>

        <div className="demo-body">
          <pre className="demo-code" aria-hidden="true">
            {lines.map((line, index) => (
              <div className="demo-line" key={index}>
                <span className="demo-ln">{index + 1}</span>
                <span className="demo-text">
                  {highlight(line)}
                  {index === lines.length - 1 && <span className={`demo-caret ${finished ? 'is-idle' : ''}`} />}
                </span>
              </div>
            ))}
          </pre>

          <div className="demo-preview" aria-hidden="true">
            <div className="demo-paper">
              <AnimatePresence>
                {visible.has('title') && (
                  <motion.header key="title" className="paper-title" {...reveal}>
                    <h3>Stability of Gradient Flows</h3>
                    <p>A. Researcher</p>
                  </motion.header>
                )}
                {visible.has('abstract') && (
                  <motion.div key="abstract" className="paper-abstract" {...reveal}>
                    <strong>Abstract</strong>
                    <p>We show that the energy decays exponentially along the flow.</p>
                  </motion.div>
                )}
                {visible.has('section') && (
                  <motion.div key="section" className="paper-section" {...reveal}>
                    <h4>1&ensp;Introduction</h4>
                    <p>Consider the Dirichlet energy</p>
                  </motion.div>
                )}
                {visible.has('equation') && (
                  <motion.div key="equation" className="paper-equation" {...reveal}>
                    <span className="eq">
                      <i>E</i>(<i>u</i>) = <span className="eq-int">∫<sub>Ω</sub></span> <span className="eq-frac">½</span>|∇<i>u</i>|<sup>2</sup> d<i>x</i>
                    </span>
                    <span className="eq-no">(1)</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {!visible.has('title') && (
                <div className="paper-idle">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

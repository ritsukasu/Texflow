import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const EASE = [0.2, 0.8, 0.2, 1];

const trigger = (onView) =>
  onView
    ? { initial: 'from', whileInView: 'to', viewport: { once: true, margin: '-70px' } }
    : { initial: 'from', animate: 'to' };

export const RevealWords = ({ text, as = 'span', className, delay = 0, stagger = 0.06, onView = false, decorative = false }) => {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  const a11y = decorative ? { 'aria-hidden': true } : { 'aria-label': text };

  if (reduced) {
    const Plain = as;
    return (
      <Plain className={className} {...(decorative ? { 'aria-hidden': true } : {})}>
        {text}
      </Plain>
    );
  }

  return (
    <Tag className={className} {...a11y} {...trigger(onView)} variants={{ to: { transition: { delayChildren: delay, staggerChildren: stagger } } }}>
      {text.split(' ').map((word, index) => (
        <span className="word-mask" key={`${word}-${index}`} aria-hidden="true">
          <motion.span
            className="word"
            variants={{ from: { y: '112%', rotate: 3 }, to: { y: 0, rotate: 0, transition: { duration: 0.8, ease: EASE } } }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
};

export const BlurText = ({ text, as = 'p', className, delay = 0, stagger = 0.022, onView = false }) => {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  if (reduced) {
    const Plain = as;
    return <Plain className={className}>{text}</Plain>;
  }

  return (
    <Tag className={className} aria-label={text} {...trigger(onView)} variants={{ to: { transition: { delayChildren: delay, staggerChildren: stagger } } }}>
      {text.split(' ').map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <motion.span
            className="blur-word"
            variants={{
              from: { opacity: 0, y: 8, filter: 'blur(8px)' },
              to: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
            }}
          >
            {word}
          </motion.span>{' '}
        </span>
      ))}
    </Tag>
  );
};

export const RotatingWord = ({ words, delay = 0, hold = 2600 }) => {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [cycled, setCycled] = useState(false);
  const [widths, setWidths] = useState(null);
  const probes = useRef([]);

  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (active && probes.current.length === words.length) setWidths(probes.current.map((node) => node.getBoundingClientRect().width));
    };
    document.fonts.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => {
      active = false;
      window.removeEventListener('resize', measure);
    };
  }, [words]);

  useEffect(() => {
    if (reduced) return undefined;
    let interval;
    const start = window.setTimeout(() => {
      setCycled(true);
      setIndex(1);
      interval = window.setInterval(() => setIndex((value) => (value + 1) % words.length), hold);
    }, (delay + 1.6) * 1000 + hold);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [reduced, words.length, hold, delay]);

  const word = `${words[index]}.`;

  return (
    <span className="rot" aria-hidden="true">
      <motion.span
        className="rot-mask"
        initial={false}
        animate={widths ? { width: widths[index] + 2 } : undefined}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      >
        <AnimatePresence mode="popLayout" initial>
          <motion.span
            key={word}
            className="word"
            initial={{ y: '112%', rotate: 3 }}
            animate={{ y: 0, rotate: 0, transition: { duration: 0.7, ease: EASE, delay: cycled ? 0.05 : delay } }}
            exit={{ y: '-112%', rotate: -3, transition: { duration: 0.45, ease: [0.6, 0, 0.8, 0.4] } }}
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      <span className="rot-probes">
        {words.map((item, position) => (
          <span key={item} ref={(node) => { if (node) probes.current[position] = node; }}>
            {item}.
          </span>
        ))}
      </span>
    </span>
  );
};

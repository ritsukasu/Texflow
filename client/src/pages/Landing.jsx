import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, CircleAlert, Cloud, Download, Pencil, Play, Quote, ShieldCheck, Sigma, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitHubIcon } from '../components/Icons.jsx';
import { Logo } from '../components/Logo.jsx';
import { BlurText, RevealWords, RotatingWord } from '../components/TextFx.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LandingDemo } from './LandingDemo.jsx';

const REPO_URL = 'https://github.com/ritsukasu/texflow';

const FEATURES = [
  { icon: Zap, title: 'Instant PDF preview', text: 'Compile in a few seconds and read the result next to your source, with zoom and page tracking.' },
  { icon: Sigma, title: 'A full TeX Live', text: 'pdfLaTeX and XeLaTeX with the packages researchers rely on, from amsmath and TikZ to natbib.' },
  { icon: Quote, title: 'Citations that just work', text: 'Keep a .bib file beside your paper. Autocomplete suggests keys as you type \\cite{ and labels as you type \\ref{.' },
  { icon: Cloud, title: 'Saved as you type', text: 'Every change is stored automatically. Close the tab and pick up exactly where you stopped.' },
  { icon: CircleAlert, title: 'Errors you can act on', text: 'Problems are listed with file and line number. Select one to jump straight to it.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Builds run with shell access switched off and files locked to your project. Your work stays yours.' },
];

const STEPS = [
  { icon: Pencil, title: 'Write', text: 'Start from a template or the built-in example. Autocomplete knows your citations and labels.' },
  { icon: Play, title: 'Compile', text: 'Press Ctrl and Enter. If something breaks, the error points at the exact line.' },
  { icon: Download, title: 'Share', text: 'Download the PDF or a zip of your source whenever you need to send it on.' },
];

const HEADLINE = 'A quiet place to write your';
const ROTATING = ['paper', 'thesis', 'proofs', 'notes'];

const Nav = () => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="nav-inner">
        <Logo />
        <nav className="nav-links" aria-label="Sections">
          <a href="#example">Example</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="nav-actions">
          <a className="icon-btn nav-github" href={REPO_URL} target="_blank" rel="noreferrer noopener" aria-label="Texflow on GitHub">
            <GitHubIcon />
          </a>
          <ThemeToggle />
          {user ? (
            <Link to="/app" className="btn btn-primary btn-sm">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm nav-signin">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Start writing
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const Hero = () => {
  const { user } = useAuth();
  const reduced = useReducedMotion();

  return (
    <section className="hero">
      <div className="hero-mesh" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
        <span className="hero-grid" />
      </div>

      <div className="hero-copy">
        <h1 className="hero-title serif" aria-label={`${HEADLINE} ${ROTATING[0]}.`}>
          <RevealWords text={HEADLINE} delay={0.15} stagger={0.07} decorative />
          <RotatingWord words={ROTATING} delay={0.15 + HEADLINE.split(' ').length * 0.07} />
        </h1>
        <BlurText
          className="hero-sub"
          text="Texflow is a LaTeX editor that runs in your browser. Compile in seconds, keep every draft saved, and spend your time on the work instead of the toolchain."
          delay={0.8}
        />
        <motion.div
          className="hero-cta"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Link to={user ? '/app' : '/register'} className="btn btn-primary btn-lg">
            {user ? 'Open dashboard' : 'Start writing'}
            <ArrowRight size={18} aria-hidden />
          </Link>
          {!user && (
            <Link to="/login" className="btn btn-secondary btn-lg">
              Sign in
            </Link>
          )}
        </motion.div>
        <motion.p
          className="hero-note"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.8 }}
        >
          No installation. Your projects stay private.
        </motion.p>
      </div>

      <motion.div
        className="hero-demo"
        style={{ transformPerspective: 1400, transformOrigin: '50% 0%' }}
        initial={reduced ? false : { opacity: 0, y: 60, rotateX: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ delay: 1.0, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <LandingDemo />
      </motion.div>
    </section>
  );
};

const FeatureCard = ({ icon: Icon, title, text, index }) => {
  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  return (
    <motion.li
      className="feature"
      onPointerMove={onMove}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: (index % 3) * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <span className="feature-icon">
        <Icon size={20} aria-hidden />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.li>
  );
};

const Steps = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  return (
    <ol className="steps" ref={ref}>
      <svg className="steps-line" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true">
        <motion.path
          d="M0 4 H1000"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="2 8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
      {STEPS.map(({ icon: Icon, title, text }, index) => (
        <motion.li
          key={title}
          className="step"
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.25 + index * 0.25, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="step-icon">
            <Icon size={22} aria-hidden />
            <span className="step-index">{index + 1}</span>
          </span>
          <h3>{title}</h3>
          <p>{text}</p>
        </motion.li>
      ))}
    </ol>
  );
};

export const Landing = () => {
  const { user } = useAuth();
  return (
    <div className="landing">
      <Nav />
      <main>
        <Hero />

        <section className="section" id="features">
          <div className="section-head">
            <RevealWords as="h2" className="serif" text="Everything a paper needs" onView />
            <BlurText text="Built around the way research is actually written: drafts, equations, references and revisions." delay={0.25} onView />
          </div>
          <ul className="features">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} index={index} {...feature} />
            ))}
          </ul>
        </section>

        <section className="section" id="how">
          <div className="section-head">
            <RevealWords as="h2" className="serif" text="From first draft to submission" onView />
            <BlurText text="Three steps, no setup in between." delay={0.25} onView />
          </div>
          <Steps />
        </section>

        <section className="section">
          <motion.div
            className="cta-band"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="cta-glow" aria-hidden="true" />
            <RevealWords as="h2" className="serif" text="Your next paper starts here." onView delay={0.1} />
            <BlurText text="Create an account and a ready-made example project is waiting for you." delay={0.35} onView />
            <Link to={user ? '/app' : '/register'} className="btn btn-primary btn-lg">
              {user ? 'Open dashboard' : 'Create your account'}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <Logo size={24} />
          <p>© {new Date().getFullYear()} Texflow. Released under the MIT License.</p>
          <a className="footer-link" href={REPO_URL} target="_blank" rel="noreferrer noopener">
            <GitHubIcon size={16} /> Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

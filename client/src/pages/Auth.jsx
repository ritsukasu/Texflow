import { motion } from 'framer-motion';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';
import { BlurText, RevealWords } from '../components/TextFx.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
    switchText: 'New to Texflow?',
    switchLink: 'Create an account',
    switchTo: '/register',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Start with a ready-made example project and make it yours.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLink: 'Sign in',
    switchTo: '/login',
  },
};

const strengthOf = (password) => {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return { score, label: ['Too short', 'Okay', 'Good', 'Strong', 'Excellent'][score] };
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

const Field = ({ label, error, hint, children, id }) => (
  <motion.div className="field" variants={item}>
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    {children}
    {error ? (
      <p className="field-error" id={`${id}-error`} role="alert">
        <CircleAlert size={13} aria-hidden /> {error}
      </p>
    ) : (
      hint && <p className="field-hint">{hint}</p>
    )}
  </motion.div>
);

export const Auth = ({ mode }) => {
  const copy = COPY[mode];
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ids = { name: useId(), email: useId(), password: useId() };

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  if (user) return <Navigate to={location.state?.from ?? '/app'} replace />;

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const next = {};
    if (mode === 'register' && !form.name.trim()) next.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Enter your password';
    else if (mode === 'register' && form.password.length < 10) next.password = 'Use at least 10 characters';
    return next;
  };

  const submit = async (event) => {
    event.preventDefault();
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    setFormError('');
    try {
      if (mode === 'login') await login({ email: form.email.trim(), password: form.password });
      else await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate(location.state?.from ?? '/app', { replace: true });
    } catch (failure) {
      if (failure.fields) setErrors(failure.fields);
      else setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-main">
        <div className="auth-top">
          <Logo />
          <ThemeToggle />
        </div>

        <motion.form
          className="auth-form"
          onSubmit={submit}
          noValidate
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
        >
          <motion.div variants={item} className="auth-heading">
            <RevealWords as="h1" className="serif" text={copy.title} delay={0.1} />
            <BlurText text={copy.subtitle} delay={0.3} />
          </motion.div>

          {formError && (
            <motion.div className="form-alert" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <CircleAlert size={16} aria-hidden /> {formError}
            </motion.div>
          )}

          {mode === 'register' && (
            <Field label="Name" error={errors.name} id={ids.name}>
              <input
                id={ids.name}
                className="input"
                value={form.name}
                onChange={update('name')}
                autoComplete="name"
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${ids.name}-error` : undefined}
                autoFocus
              />
            </Field>
          )}

          <Field label="Email" error={errors.email} id={ids.email}>
            <input
              id={ids.email}
              className="input"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${ids.email}-error` : undefined}
              autoFocus={mode === 'login'}
            />
          </Field>

          <Field
            label="Password"
            error={errors.password}
            id={ids.password}
            hint={mode === 'register' && !form.password ? 'At least 10 characters.' : undefined}
          >
            <div className="input-wrap">
              <input
                id={ids.password}
                className="input"
                type={reveal ? 'text' : 'password'}
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${ids.password}-error` : undefined}
              />
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal}>
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'register' && form.password && (
              <div className="strength" aria-live="polite">
                <div className="strength-bars" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <span key={step} className={strength.score >= step ? `on s${strength.score}` : ''} />
                  ))}
                </div>
                <span>{strength.label}</span>
              </div>
            )}
          </Field>

          <motion.button variants={item} type="submit" className="btn btn-primary btn-lg auth-submit" disabled={busy}>
            {busy && <Loader2 size={18} className="spin" aria-hidden />}
            {copy.submit}
          </motion.button>

          <motion.p variants={item} className="auth-switch">
            {copy.switchText} <Link to={copy.switchTo} state={location.state}>{copy.switchLink}</Link>
          </motion.p>
        </motion.form>
      </div>

      <aside className="auth-art" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <motion.div
          className="art-paper"
          initial={{ opacity: 0, y: 40, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="art-float">
            <h3>On Stable Flows</h3>
            <p className="art-author">A. Researcher</p>
            <div className="art-lines">
              <span />
              <span />
              <span style={{ width: '70%' }} />
            </div>
            <div className="art-eq">
              <i>e</i>
              <sup>
                <i>iπ</i>
              </sup>{' '}
              + 1 = 0<span>(1)</span>
            </div>
            <div className="art-lines">
              <span />
              <span style={{ width: '82%' }} />
            </div>
          </div>
        </motion.div>
        <p className="art-quote serif">Write the paper. Let the typesetting take care of itself.</p>
      </aside>
    </div>
  );
};

import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export const ThemeToggle = () => {
  const { resolved, toggle } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={resolved === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          className="icon-swap"
          initial={{ rotate: -80, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 80, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Icon size={18} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
};

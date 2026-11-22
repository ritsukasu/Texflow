import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export const Menu = ({ label, trigger, items, align = 'end', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  const actionable = items.filter((item) => !item.separator);

  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, close]);

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setActive(0);
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % actionable.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + actionable.length) % actionable.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = actionable[active];
      close();
      item?.onSelect();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  let actionableIndex = -1;

  return (
    <div className={`menu ${className}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => {
          setActive(0);
          setOpen((value) => !value);
        }}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={menuId}
            role="menu"
            className={`menu-list menu-${align}`}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {items.map((item, index) => {
              if (item.separator) return <li key={`sep-${index}`} role="separator" className="menu-separator" />;
              actionableIndex += 1;
              const position = actionableIndex;
              const Icon = item.icon;
              return (
                <li key={item.label} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`menu-item ${item.danger ? 'is-danger' : ''} ${position === active ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(position)}
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                  >
                    {Icon && <Icon size={16} aria-hidden />}
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

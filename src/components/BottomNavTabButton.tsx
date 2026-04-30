import React from 'react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BottomNavTabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  darkMode: boolean;
  /** Bolinha animada (ex.: destaque em Treinos). */
  pulseBadge?: boolean;
}

export function BottomNavTabButton({
  active,
  onClick,
  icon,
  label,
  darkMode,
  pulseBadge,
}: BottomNavTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 py-1 px-2 sm:px-3 rounded-xl transition-all duration-200 ease-out min-w-[52px]',
        pulseBadge && 'relative',
        active && '-translate-y-1.5 text-orange-500',
        !active && (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'),
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center [&_svg]:shrink-0 transition-all duration-200 ease-out',
          active ? '[&_svg]:w-8 [&_svg]:h-8' : '[&_svg]:w-5 [&_svg]:h-5',
        )}
      >
        {icon}
      </span>
      <span
        className={cn('text-[10px] font-medium transition-colors', active ? 'text-orange-500 font-semibold' : '')}
      >
        {label}
      </span>
      {pulseBadge && (
        <motion.span
          className="absolute -top-0.5 right-2 w-2 h-2 rounded-full bg-orange-500"
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      )}
    </button>
  );
}

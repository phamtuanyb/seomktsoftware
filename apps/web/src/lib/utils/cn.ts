import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Shadcn convention — merge Tailwind class strings safely. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

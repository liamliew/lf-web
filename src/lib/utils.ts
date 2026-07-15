import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(value: string | number | Date): string {
	return new Date(value).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatCurrency(value: number | null | undefined): string {
	if (value === null || value === undefined) return '—';
	return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delayMs = 300) {
	let timer: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delayMs);
	};
}

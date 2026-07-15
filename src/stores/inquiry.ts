import { writable } from 'svelte/store';

export const inquiry = writable({
	isExpanded: false,
	inputValue: ''
});

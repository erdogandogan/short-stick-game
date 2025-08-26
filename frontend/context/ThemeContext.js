import React, { createContext, useContext, useMemo } from 'react';

// Home screen inspired palette
const defaultTheme = {
	colors: {
		background: '#ecfdf5', // soft green background
		surface: '#ffffff',
		border: '#d1fae5',
		cardBorder: '#e5e7eb',

		textPrimary: '#111827',
		textMuted: '#6b7280',
		brandDeep: '#065f46', // deep green text used on Home
		brandSoft: '#047857', // greet green

		primary: '#8B5CF6',
		success: '#10b981',
		danger: '#ef4444',
		secondary: '#6b7280',

		info: '#1e3a8a', // blue-900
		warn: '#f59e0b',
		neutral: '#9ca3af',
    	
        dateText: '#6b7280', // matches textMuted for subtle date labels
	    participantsText: '#065f46', // matches brandDeep to highlight participants
	},
};

const ThemeContext = createContext({ theme: defaultTheme });

export function ThemeProvider({ children, value }) {
	const theme = useMemo(() => value?.theme || defaultTheme, [value]);
	return (
		<ThemeContext.Provider value={{ theme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	return ctx.theme;
}

export default ThemeContext;

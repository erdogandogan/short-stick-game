import React, { createContext, useContext, useMemo } from 'react';

// Ana sayfadan ilham alınan palet
const defaultTheme = {
	colors: {
		background: '#ecfdf5', // yumuşak yeşil arka plan
		surface: '#ffffff',
		border: '#d1fae5',
		cardBorder: '#e5e7eb',

		textPrimary: '#111827',
		textMuted: '#6b7280',
		brandDeep: '#065f46', // Ana sayfada kullanılan koyu yeşil yazı rengi
		brandSoft: '#047857', // selamlama yeşili

		primary: '#8B5CF6',
		success: '#10b981',
		danger: '#ef4444',
		secondary: '#6b7280',

		info: '#1e3a8a', // mavi-900
		warn: '#f59e0b',
		neutral: '#9ca3af',
    	
        dateText: '#6b7280', // ince tarih etiketleri için textMuted ile uyumlu
	    participantsText: '#065f46', // katılımcıları vurgulamak için brandDeep ile uyumlu
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

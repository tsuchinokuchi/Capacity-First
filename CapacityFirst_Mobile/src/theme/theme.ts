import { MD3LightTheme, MD3Theme } from 'react-native-paper';

// Extend the theme type if we want valid typescript for custom properties (optional but good practice)
// For now we will export a typed object

export const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6200ee',       // Main purple
        secondary: '#03dac6',     // Teal
        tertiary: '#018786',      // Darker Teal (used in Pool FAB)
        error: '#B00020',
        background: '#f6f6f6',    // App background
        surface: '#ffffff',       // Card background
        surfaceVariant: '#eeeeee',

        // Custom mappings using standard keys where possible, or just custom values
        // We will use these directly or via custom hook wrapper if needed
        // For simplicity in this task, we treat this as the source of truth

        // Specific application colors preserved from original design
        poolBackground: '#F0F8FF', // AliceBlue (Pool Screen)
        timeBadge: '#e0e0e0',      // Time badge background
    },
};

// Start Type Helper for Custom Colors
export type AppTheme = typeof theme;

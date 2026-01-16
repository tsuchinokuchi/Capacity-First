/**
 * DateUtils.ts
 * Utility functions for date manipulation in the Weekly Screen.
 */

// Returns an array of 7 dates representing the week containing the baseDate.
// Week starts on Monday by default.
export const getWeekDates = (baseDate: Date): Date[] => {
    const dates: Date[] = [];
    const startOfWeek = new Date(baseDate);

    // Adjust to Monday of the current week
    // getDay(): 0 = Sunday, 1 = Monday, ...
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        dates.push(d);
    }
    return dates;
};

// Formats a date to "Month/Day (DayOfWeek)" e.g. "1/16 (Fri)"
export const formatDate = (date: Date): string => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekDay = weekDays[date.getDay()];
    return `${month}/${day} (${weekDay})`;
};

// Checks if two dates represent the same calendar day
export const isSameDay = (d1: Date, d2: Date): boolean => {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
};

// Formats a date to ISO string (YYYY-MM-DD) for storage
export const toISODateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

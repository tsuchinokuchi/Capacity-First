import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    dailyCapacityMinutes: number;
    setDailyCapacity: (minutes: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            dailyCapacityMinutes: 480, // Default 8 hours (480 mins)
            setDailyCapacity: (minutes) => set({ dailyCapacityMinutes: minutes }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

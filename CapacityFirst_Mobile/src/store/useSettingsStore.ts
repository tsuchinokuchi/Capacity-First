import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tag } from '../types/Task';

interface SettingsState {
    dailyCapacityMinutes: number;
    tags: Tag[];
    setDailyCapacity: (minutes: number) => void;
    addTag: (name: string, color: string) => void;
    updateTag: (id: string, name: string, color: string) => void;
    deleteTag: (id: string) => void;
    // Sorting
    sortConfigs: SortConfig[];
    updateSortConfig: (configs: SortConfig[]) => void;
    moveTagPriority: (tagId: string, direction: 'up' | 'down') => void;
}

export type SortField = 'createdAt' | 'estimatedTime' | 'tagPriority';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
    field: SortField;
    order: SortOrder;
    enabled: boolean;
}

const DEFAULT_SORT_CONFIGS: SortConfig[] = [
    { field: 'tagPriority', order: 'asc', enabled: true },
    { field: 'estimatedTime', order: 'desc', enabled: true },
    { field: 'createdAt', order: 'asc', enabled: true },
];

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            dailyCapacityMinutes: 480, // Default 8 hours (480 mins)
            tags: [],
            setDailyCapacity: (minutes) => set({ dailyCapacityMinutes: minutes }),
            addTag: (name, color) => set((state) => ({
                tags: [...state.tags, { id: Date.now().toString(), name, color }]
            })),
            updateTag: (id, name, color) => set((state) => ({
                tags: state.tags.map(t => t.id === id ? { ...t, name, color } : t)
            })),
            deleteTag: (id) => set((state) => ({
                tags: state.tags.filter(t => t.id !== id)
            })),
            sortConfigs: DEFAULT_SORT_CONFIGS,
            updateSortConfig: (configs) => set({ sortConfigs: configs }),
            moveTagPriority: (tagId, direction) => set((state) => {
                const index = state.tags.findIndex(t => t.id === tagId);
                if (index === -1) return state;

                const newTags = [...state.tags];
                if (direction === 'up' && index > 0) {
                    [newTags[index - 1], newTags[index]] = [newTags[index], newTags[index - 1]];
                } else if (direction === 'down' && index < newTags.length - 1) {
                    [newTags[index + 1], newTags[index]] = [newTags[index], newTags[index + 1]];
                }
                return { tags: newTags };
            }),
        }),
        {
            name: 'settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

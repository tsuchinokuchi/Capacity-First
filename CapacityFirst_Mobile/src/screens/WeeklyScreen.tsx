import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Checkbox, Card, IconButton, useTheme, SegmentedButtons, Chip, Button, Portal, Dialog, FAB } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Task, Subtask } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import TaskItem from '../components/TaskItem';
import SettingsDialog from '../components/SettingsDialog';
import { getWeekDates, toISODateString, formatDate, isSameDay } from '../utils/DateUtils';
import { AppTheme } from '../theme/theme';

export default function WeeklyScreen() {
    const theme = useTheme<AppTheme>();
    const { tasks, addTask, updateTask, updateTasks, toggleTask, toggleSubtask, deleteTask } = useTaskStore();
    const { dailyCapacityMinutes, tags } = useSettingsStore();

    // Ensure safe default
    const safeTags = tags || [];

    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
    const [bulkDate, setBulkDate] = useState<Date>(new Date());

    // Navigation State
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

    // Filter State
    const [showOneOff, setShowOneOff] = useState(true);
    const [showRecurring, setShowRecurring] = useState(true);
    const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const weekDates = getWeekDates(currentWeekStart);

    const handlePrevWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentWeekStart(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentWeekStart(newDate);
    };

    const toggleFilterTag = (tagId: string) => {
        if (selectedFilterTags.includes(tagId)) {
            setSelectedFilterTags(selectedFilterTags.filter(id => id !== tagId));
        } else {
            setSelectedFilterTags([...selectedFilterTags, tagId]);
        }
    };

    const toggleSelection = (taskId: string) => {
        if (selectedTaskIds.includes(taskId)) {
            const newIds = selectedTaskIds.filter(id => id !== taskId);
            setSelectedTaskIds(newIds);
            if (newIds.length === 0) setIsSelectionMode(false);
        } else {
            setSelectedTaskIds([...selectedTaskIds, taskId]);
        }
    };

    const handleLongPress = (taskId: string) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedTaskIds([taskId]);
        }
    };

    const handleBulkReschedule = () => {
        const dateStr = toISODateString(bulkDate);
        updateTasks(selectedTaskIds, { scheduledDate: dateStr });
        setIsSelectionMode(false);
        setSelectedTaskIds([]);
        setShowBulkDatePicker(false);
        Alert.alert("Success", `Moved ${selectedTaskIds.length} tasks to ${toISODateString(bulkDate)}`);
    };

    const openAddDialog = (date: Date) => {
        setSelectedDate(date);
        setEditingTask(null);
        setDialogVisible(true);
    };

    const openEditDialog = (task: Task) => {
        setEditingTask(task);
        setDialogVisible(true);
    };

    const handleSubmit = (title: string, date?: Date, estimatedTime?: number, repeatRule?: 'daily' | 'weekly', repeatConfig?: any, notes?: string, tags?: string[], subtasks?: Subtask[]) => {
        if (editingTask) {
            updateTask(editingTask.id, {
                title,
                scheduledDate: date ? toISODateString(date) : undefined,
                estimatedTime,
                notes,
                tags,
                subtasks
            });
        } else {
            addTask(title, date ? toISODateString(date) : undefined, estimatedTime, repeatRule, repeatConfig, notes, tags, subtasks);
        }
    };

    const renderTask = (task: Task) => {
        const isSelected = selectedTaskIds.includes(task.id);

        return (
            <TaskItem
                key={task.id}
                task={task}
                tags={safeTags}
                isSelectionMode={isSelectionMode}
                isSelected={isSelected}
                onToggle={toggleTask}
                onSubtaskToggle={toggleSubtask}
                onSelect={toggleSelection}
                onLongPress={handleLongPress}
                onPress={() => {
                    if (isSelectionMode) {
                        toggleSelection(task.id);
                    } else {
                        openEditDialog(task);
                    }
                }}
            />
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.headerContainer}>
                <Text variant="headlineSmall" style={styles.header}>Weekly Overview</Text>
                <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
            </View>

            {/* Navigation & Filters Header */}
            <View style={styles.controlsContainer}>
                <View style={styles.navRow}>
                    <IconButton icon="chevron-left" onPress={handlePrevWeek} />
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                        {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                    </Text>
                    <IconButton icon="chevron-right" onPress={handleNextWeek} />
                    <Button
                        mode={showFilters ? "contained-tonal" : "text"}
                        onPress={() => setShowFilters(!showFilters)}
                        compact
                    >
                        Filters
                    </Button>
                </View>

                {showFilters && (
                    <View style={styles.filterSection}>
                        <View style={styles.filterRow}>
                            <Chip
                                selected={showOneOff}
                                onPress={() => setShowOneOff(!showOneOff)}
                                style={[styles.filterChip, showOneOff && { backgroundColor: theme.colors.secondaryContainer }]}
                                showSelectedOverlay
                                mode="outlined"
                                compact
                            >
                                One-off
                            </Chip>
                            <Chip
                                selected={showRecurring}
                                onPress={() => setShowRecurring(!showRecurring)}
                                style={[styles.filterChip, showRecurring && { backgroundColor: theme.colors.secondaryContainer }]}
                                showSelectedOverlay
                                mode="outlined"
                                compact
                            >
                                Recurring
                            </Chip>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterScroll}>
                            {safeTags.map(tag => {
                                const isSelected = selectedFilterTags.includes(tag.id);
                                return (
                                    <Chip
                                        key={tag.id}
                                        selected={isSelected}
                                        onPress={() => toggleFilterTag(tag.id)}
                                        style={[styles.filterChip, isSelected && { backgroundColor: tag.color + '40' }]}
                                        textStyle={{ color: isSelected ? 'black' : tag.color }}
                                        showSelectedOverlay
                                        mode="outlined"
                                        compact
                                    >
                                        {tag.name}
                                    </Chip>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {weekDates.map((date, index) => {
                    // Filter tasks for this specific date
                    const dateStr = toISODateString(date);
                    let dayTasks = tasks.filter(t => t.scheduledDate === dateStr);

                    // Apply Filters
                    // Type Filter
                    dayTasks = dayTasks.filter(t => {
                        const isRecurring = t.repeatRule !== undefined;
                        if (isRecurring && !showRecurring) return false;
                        if (!isRecurring && !showOneOff) return false;
                        return true;
                    });

                    // Tag Filter
                    if (selectedFilterTags.length > 0) {
                        dayTasks = dayTasks.filter(t => t.tags && t.tags.some(tagId => selectedFilterTags.includes(tagId)));
                    }

                    const isToday = isSameDay(date, new Date());

                    // Capacity Calculation
                    const totalEstimated = dayTasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
                    const capacityHours = Math.floor(dailyCapacityMinutes / 60);
                    const totalHours = Math.floor(totalEstimated / 60);
                    const totalMins = totalEstimated % 60;
                    const capacityStr = `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''} / ${capacityHours}h`;
                    const isOverCapacity = totalEstimated > dailyCapacityMinutes;

                    return (
                        <Card key={index} style={[
                            styles.dayCard,
                            isToday && { borderColor: theme.colors.primary, borderWidth: 1 }
                        ]}>
                            <Card.Content>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text variant="titleMedium" style={isToday ? { color: theme.colors.primary, fontWeight: 'bold' } : undefined}>
                                            {formatDate(date)}
                                        </Text>
                                        <Text variant="labelSmall" style={{ color: isOverCapacity ? theme.colors.error : theme.colors.secondary }}>
                                            {capacityStr}
                                        </Text>
                                    </View>
                                    {!isSelectionMode && (
                                        <IconButton
                                            icon="plus"
                                            size={20}
                                            onPress={() => openAddDialog(date)}
                                        />
                                    )}
                                </View>

                                {dayTasks.length > 0 ? (
                                    dayTasks.map(renderTask)
                                ) : (
                                    <Text style={styles.noTasksText}>No tasks</Text>
                                )}
                            </Card.Content>
                        </Card>
                    );
                })}
            </ScrollView>

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                // Use selectedDate for adding, or task date for editing
                initialDate={editingTask ? (editingTask.scheduledDate ? new Date(editingTask.scheduledDate) : undefined) : selectedDate}
                initialEstimatedTime={editingTask?.estimatedTime}
                initialNotes={editingTask?.notes}
                initialTags={editingTask?.tags}
                initialSubtasks={editingTask?.subtasks}
                title={editingTask ? "Edit Task" : "Add Task"}
                submitLabel={editingTask ? "Update" : "Add"}
                taskId={editingTask?.id}
            />
            <SettingsDialog
                visible={settingsVisible}
                onDismiss={() => setSettingsVisible(false)}
            />

            {/* Bulk Selection Bar */}
            {isSelectionMode && (
                <View style={styles.bulkActionBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconButton icon="close" onPress={() => setIsSelectionMode(false)} />
                        <Text variant="titleMedium">{selectedTaskIds.length} selected</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        <Button mode="contained" onPress={() => setShowBulkDatePicker(true)} icon="calendar">
                            Schedule
                        </Button>
                    </View>
                </View>
            )}

            {/* Bulk Date Picker Modal */}
            {showBulkDatePicker && (
                <Portal>
                    <Dialog visible={showBulkDatePicker} onDismiss={() => setShowBulkDatePicker(false)}>
                        <Dialog.Title>Batch Schedule</Dialog.Title>
                        <Dialog.Content>
                            <Text style={{ marginBottom: 16 }}>Select date for {selectedTaskIds.length} tasks:</Text>
                            <DateTimePicker
                                value={bulkDate}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    if (d) setBulkDate(d);
                                }}
                                style={{ alignSelf: 'center' }}
                            />
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={() => setShowBulkDatePicker(false)}>Cancel</Button>
                            <Button onPress={handleBulkReschedule}>Apply</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor handled by theme
        paddingTop: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 16,
    },
    header: {
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    dayCard: {
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    // todayCard removed, handled inline
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 4,
    },
    // todayText removed, handled inline
    taskCard: {
        marginBottom: 4,
        elevation: 1, // Slight shadow
    },
    taskCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    cardTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 2,
    },
    miniTag: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        marginRight: 4,
        marginTop: 1,
    },
    miniTagText: {
        fontSize: 9,
        color: 'white',
        fontWeight: 'bold',
    },
    taskTitle: {
        flex: 1,
        fontSize: 14,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    noTasksText: {
        color: '#ccc',
        fontStyle: 'italic',
        fontSize: 12,
    },
    taskTextContainer: {
        flex: 1,
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    timeBadgeSmall: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        fontSize: 10,
        color: '#333',
        marginLeft: 4,
    },
    controlsContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 8,
        marginBottom: 8,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    filterSection: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    tagFilterScroll: {
        flexDirection: 'row',
    },
    filterChip: {
        marginRight: 8,
    },
    bulkActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
        elevation: 4
    }
});

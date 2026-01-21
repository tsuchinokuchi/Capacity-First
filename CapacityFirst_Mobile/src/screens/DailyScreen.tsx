import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Text, Checkbox, Card, IconButton, FAB, useTheme, List, Button, Portal, Dialog } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Task } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import SettingsDialog from '../components/SettingsDialog';
import { toISODateString } from '../utils/DateUtils';
import { AppTheme } from '../theme/theme';

export default function DailyScreen() {
    const theme = useTheme<AppTheme>();
    const { tasks, addTask, updateTask, updateTasks, toggleTask, deleteTask, replenishTasks } = useTaskStore();
    const { dailyCapacityMinutes, tags, sortConfigs } = useSettingsStore();

    useEffect(() => {
        replenishTasks();
    }, []);

    // Ensure safe default
    const safeTags = tags || [];
    const safeSortConfigs = sortConfigs || [];

    // Dialog State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
    const [bulkDate, setBulkDate] = useState<Date>(new Date());

    // Filter for Today
    const todayStr = toISODateString(new Date());
    const todayTasks = tasks.filter(t => t.scheduledDate === todayStr);

    // Filter for Overdue (Incomplete, Scheduled Date < Today)
    // Simple string comparison works for ISO dates (YYYY-MM-DD)
    const overdueTasks = tasks.filter(t =>
        !t.isCompleted &&
        t.scheduledDate &&
        t.scheduledDate < todayStr
    );

    // Calculate Total Estimated Time
    // Calculate Total Estimated Time
    const totalMinutes = todayTasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);

    // Sort Tasks Logic
    const getHighestTagPriority = (taskTags?: string[]): number => {
        if (!taskTags || taskTags.length === 0) return 999;
        let minIndex = 999;
        taskTags.forEach(tagId => {
            const index = safeTags.findIndex(t => t.id === tagId);
            if (index !== -1 && index < minIndex) {
                minIndex = index;
            }
        });
        return minIndex;
    };

    const sortedTasks = [...todayTasks].sort((a, b) => {
        if (!safeSortConfigs || safeSortConfigs.length === 0) return 0;

        for (const config of safeSortConfigs) {
            if (!config.enabled) continue;

            let diff = 0;
            switch (config.field) {
                case 'tagPriority':
                    const pA = getHighestTagPriority(a.tags);
                    const pB = getHighestTagPriority(b.tags);
                    diff = pA - pB;
                    break;
                case 'estimatedTime':
                    diff = (a.estimatedTime || 0) - (b.estimatedTime || 0);
                    break;
                case 'createdAt':
                    diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }

            if (diff !== 0) {
                return config.order === 'asc' ? diff : -diff;
            }
        }
        return 0; // fallback
    });

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    };

    const capacityHours = Math.floor(dailyCapacityMinutes / 60);
    // Display string: e.g. "Total: 4h 30m / 8h"
    const totalTimeStr = `${formatTime(totalMinutes)} / ${capacityHours}h`;
    const isOverCapacity = totalMinutes > dailyCapacityMinutes;

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
        // Handle rescheduling
        // If moving to "Date", use dateStr. If moving to Pool (how?), maybe clear date?
        // Current UI only shows DatePicker, so assumes moving to a Date.
        const dateStr = toISODateString(bulkDate);
        updateTasks(selectedTaskIds, { scheduledDate: dateStr });
        setIsSelectionMode(false);
        setSelectedTaskIds([]);
        setShowBulkDatePicker(false);
        Alert.alert("Success", `Moved ${selectedTaskIds.length} tasks to ${toISODateString(bulkDate)}`);
    };

    const openAddDialog = () => {
        setEditingTask(null);
        setDialogVisible(true);
    };

    const openEditDialog = (task: Task) => {
        setEditingTask(task);
        setDialogVisible(true);
    };

    const handleSubmit = (title: string, date?: Date, estimatedTime?: number, repeatRule?: 'daily' | 'weekly', repeatConfig?: any, notes?: string, tags?: string[]) => {
        if (editingTask) {
            updateTask(editingTask.id, {
                title,
                scheduledDate: date ? toISODateString(date) : undefined,
                estimatedTime,
                notes,
                tags
            });
        } else {
            addTask(title, date ? toISODateString(date) : undefined, estimatedTime, repeatRule, repeatConfig, notes, tags);
        }
    };

    const renderItem = ({ item }: { item: Task }) => {
        const isSelected = selectedTaskIds.includes(item.id);

        return (
            <Card style={[
                styles.card,
                item.isCompleted && { opacity: 0.6, backgroundColor: '#f0f0f0' },
                isSelected && { backgroundColor: theme.colors.primaryContainer + '40', borderColor: theme.colors.primary, borderWidth: 1 }
            ]}
                onLongPress={() => handleLongPress(item.id)}
                onPress={() => {
                    if (isSelectionMode) {
                        toggleSelection(item.id);
                    } else {
                        openEditDialog(item);
                    }
                }}
            >
                <Card.Content style={styles.cardContent}>
                    {isSelectionMode ? (
                        <Checkbox
                            status={isSelected ? 'checked' : 'unchecked'}
                            onPress={() => toggleSelection(item.id)}
                            color={theme.colors.primary}
                        />
                    ) : (
                        <Checkbox
                            status={item.isCompleted ? 'checked' : 'unchecked'}
                            onPress={() => toggleTask(item.id)}
                        />
                    )}
                    <View style={styles.taskTextContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Text
                                variant="bodyLarge"
                                style={[
                                    styles.taskTitle,
                                    item.isCompleted && styles.completedTask,
                                ]}
                            >
                                {item.title}
                            </Text>
                            {item.estimatedTime && (
                                <Text variant="bodySmall" style={styles.timeBadge}>
                                    {item.estimatedTime >= 60 ? `${Math.floor(item.estimatedTime / 60)}h ${item.estimatedTime % 60}m` : `${item.estimatedTime}m`}
                                </Text>
                            )}
                            {item.notes && <IconButton icon="note-text-outline" size={16} style={{ margin: 0 }} />}
                        </View>

                        {/* Tags Display */}
                        {item.tags && item.tags.length > 0 && (
                            <View style={styles.cardTagsRow}>
                                {item.tags.map(tagId => {
                                    const tagDef = safeTags.find(t => t.id === tagId);
                                    if (!tagDef) return null;
                                    return (
                                        <View key={tagId} style={[styles.miniTag, { backgroundColor: tagDef.color }]}>
                                            <Text style={styles.miniTagText}>{tagDef.name}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                    {!isSelectionMode && (
                        <IconButton
                            icon="trash-can-outline"
                            size={20}
                            onPress={() => {
                                Alert.alert(
                                    "Delete Task",
                                    "Are you sure you want to delete this task?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Delete", style: "destructive", onPress: () => deleteTask(item.id) }
                                    ]
                                );
                            }}
                        />
                    )}
                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text variant="headlineMedium" style={styles.header}>Daily Tasks</Text>
                <View style={styles.headerRight}>
                    <Text variant="titleMedium" style={[
                        styles.totalTime,
                        { color: theme.colors.primary },
                        isOverCapacity && { color: theme.colors.error }
                    ]}>
                        {totalTimeStr}
                    </Text>
                    <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
                </View>
            </View>

            <FlatList
                data={sortedTasks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    overdueTasks.length > 0 ? (
                        <View style={{ marginBottom: 16 }}>
                            <List.Accordion
                                title={`Overdue Tasks (${overdueTasks.length})`}
                                titleStyle={{ color: theme.colors.error, fontWeight: 'bold' }}
                                left={props => <List.Icon {...props} icon="alert-circle-outline" color={theme.colors.error} />}
                                style={{ backgroundColor: theme.colors.errorContainer + '20', borderRadius: 8 }}
                            >
                                {overdueTasks.map(task => (
                                    <View key={task.id} style={{ paddingLeft: 16 }}>
                                        {/* Reuse renderItem logic lightly or just render Component directly? 
                                            FlatList renderItem expects {item}, so we can reuse renderItem({item: task}) 
                                            BUT renderItem returns a Component, we can call it as function if we are careful.
                                            Better to just inline render a simpler version or call renderItem.
                                        */}
                                        {renderItem({ item: task })}
                                    </View>
                                ))}
                            </List.Accordion>
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No tasks for today. {'\n'}Relax or add a new one!</Text>
                }
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary, opacity: isSelectionMode ? 0 : 1 }]}
                onPress={openAddDialog}
                color="white"
                visible={!isSelectionMode}
            />

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                initialDate={editingTask ? (editingTask.scheduledDate ? new Date(editingTask.scheduledDate) : undefined) : undefined}
                initialEstimatedTime={editingTask?.estimatedTime}
                initialNotes={editingTask?.notes}
                initialTags={editingTask?.tags}
                title={editingTask ? "Edit Task" : "Add Task"}
                submitLabel={editingTask ? "Update" : "Add"}
                taskId={editingTask?.id}
                validateCapacity={(date, newEstimatedTime) => {
                    // Check logic
                    const dateStr = toISODateString(date);
                    const tasksForDate = tasks.filter(t => t.scheduledDate === dateStr && t.id !== editingTask?.id);
                    const currentTotal = tasksForDate.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
                    return (currentTotal + newEstimatedTime) <= dailyCapacityMinutes;
                }}
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
        // backgroundColor: '#fff', // Default paper background is white-ish, or use theme.colors.background
        padding: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    header: {
        fontWeight: 'bold',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalTime: {
        // color: '#6200ee', // handled by theme in render
        fontWeight: 'bold',
        marginRight: 8,
    },
    // overCapacity removed, handled inline
    listContent: {
        paddingBottom: 80,
    },
    card: {
        marginBottom: 8,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskTextContainer: {
        flex: 1,
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    taskTitle: {
        marginRight: 8,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    timeBadge: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        color: '#333',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 32,
        color: '#888',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        // backgroundColor: '#6200ee', // handled by theme
    },
    cardTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
    },
    miniTag: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        marginRight: 4,
        marginTop: 2,
    },
    miniTagText: {
        fontSize: 10,
        color: 'white',
        fontWeight: 'bold',
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

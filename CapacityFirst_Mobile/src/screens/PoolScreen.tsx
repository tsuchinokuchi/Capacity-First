import React, { useState } from 'react';
import { StyleSheet, View, FlatList, Alert, ScrollView } from 'react-native';
import { Text, Checkbox, Card, IconButton, FAB, useTheme, Chip, Button, Portal, Dialog } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Task } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import SettingsDialog from '../components/SettingsDialog';
import { toISODateString } from '../utils/DateUtils';
import { AppTheme } from '../theme/theme';

export default function PoolScreen() {
    const theme = useTheme<AppTheme>();
    const { tasks, addTask, updateTask, updateTasks, toggleTask, deleteTask } = useTaskStore();
    const { dailyCapacityMinutes, tags, sortConfigs } = useSettingsStore();

    // Ensure safe default
    const safeTags = tags || [];
    const safeSortConfigs = sortConfigs || [];

    // Dialog State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
    const [bulkDate, setBulkDate] = useState<Date>(new Date());

    // Filter for Pool (no scheduledDate)
    // Filter for Pool (no scheduledDate)
    let poolTasks = tasks.filter(t => !t.scheduledDate);

    // Apply Tag Filters
    if (selectedFilterTags.length > 0) {
        poolTasks = poolTasks.filter(t => t.tags && t.tags.some(tagId => selectedFilterTags.includes(tagId)));
    }

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

    const sortedTasks = [...poolTasks].sort((a, b) => {
        if (!sortConfigs) return 0;

        for (const config of sortConfigs) {
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
                        // Standard tap - maybe open preview? User requested "Tap to Edit" logic to be replaced?
                        // "タスク編集を長押しじゃないようにして（タップにして）" -> User wants Tap to Edit.
                        // Existing WAS Tap to Edit (on Title) but now we make whole card tap to edit?
                        // Yes, except in Selection Mode.
                        openEditDialog(item);
                    }
                }}
            >
                <Card.Content style={styles.cardContent}>
                    {/* Checkbox Behavior Change */}
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

                    <View style={styles.taskTextWrapper}>
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
                                <Text style={styles.timeBadge}>
                                    {item.estimatedTime}m
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
        <View style={[styles.container, { backgroundColor: theme.colors.poolBackground }]}>
            <View style={styles.headerContainer}>
                <View>
                    <Text variant="headlineMedium" style={styles.header}>Pool (Someday)</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{poolTasks.length} tasks</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!isSelectionMode && (
                        <Button
                            mode={showFilters ? "contained-tonal" : "text"}
                            onPress={() => setShowFilters(!showFilters)}
                            compact
                            style={{ marginRight: 8 }}
                        >
                            Filters
                        </Button>
                    )}
                    <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
                </View>
            </View>

            {showFilters && (
                <View style={styles.filterSection}>
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
                        {safeTags.length === 0 && <Text style={{ fontStyle: 'italic', color: '#999', padding: 8 }}>No tags defined in Settings.</Text>}
                    </ScrollView>
                </View>
            )}

            <FlatList
                data={sortedTasks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No tasks in the pool. {'\n'}Everything is scheduled!</Text>
                }
            />

            {!isSelectionMode && (
                <FAB
                    icon="plus"
                    style={[styles.fab, { backgroundColor: theme.colors.tertiary }]}
                    onPress={openAddDialog}
                    color="white"
                />
            )}

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                initialDate={editingTask ? undefined : undefined}
                initialEstimatedTime={editingTask?.estimatedTime}
                initialNotes={editingTask?.notes}
                initialTags={editingTask?.tags}
                title={editingTask ? "Edit Task" : "Add to Pool"}
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

            {/* Bulk Date Picker Modal - simplified */}
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
        padding: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filterSection: {
        marginBottom: 12,
    },
    tagFilterScroll: {
        flexDirection: 'row',
    },
    filterChip: {
        marginRight: 8,
    },
    header: {
        fontWeight: 'bold',
    },
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
    taskTitle: {
        flex: 1,
        marginLeft: 8,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
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
        // backgroundColor handled by theme
    },
    taskTextWrapper: {
        flex: 1,
        marginLeft: 8,
        // flexDirection: 'column' default
    },
    timeBadge: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        color: '#333',
        marginLeft: 8,
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

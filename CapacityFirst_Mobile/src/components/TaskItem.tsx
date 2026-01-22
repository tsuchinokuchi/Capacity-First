import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, IconButton, Checkbox, useTheme } from 'react-native-paper';
import { Task, Tag } from '../types/Task';
import { AppTheme } from '../theme/theme';

interface TaskItemProps {
    task: Task;
    tags: Tag[];
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onSubtaskToggle: (taskId: string, subtaskId: string) => void;
    onSelect: (id: string) => void;
    onLongPress: (id: string) => void;
    onPress: (task: Task) => void;
}

export default function TaskItem({
    task,
    tags,
    isSelectionMode,
    isSelected,
    onToggle,
    onSubtaskToggle,
    onSelect,
    onLongPress,
    onPress
}: TaskItemProps) {
    const theme = useTheme<AppTheme>();
    const [expanded, setExpanded] = useState(false);

    return (
        <Card
            style={[
                styles.card,
                task.isCompleted && { opacity: 0.6, backgroundColor: '#f0f0f0' },
                isSelected && { backgroundColor: theme.colors.primaryContainer + '40', borderColor: theme.colors.primary, borderWidth: 1 }
            ]}
            onLongPress={() => onLongPress(task.id)}
            onPress={() => onPress(task)}
        >
            <Card.Content>
                <View style={styles.cardHeader}>
                    {/* Checkbox */}
                    {isSelectionMode ? (
                        <Checkbox
                            status={isSelected ? 'checked' : 'unchecked'}
                            onPress={() => onSelect(task.id)}
                            color={theme.colors.primary}
                        />
                    ) : (
                        <Checkbox
                            status={task.isCompleted ? 'checked' : 'unchecked'}
                            onPress={() => onToggle(task.id)}
                        />
                    )}

                    {/* Task Title & Details */}
                    <View style={styles.taskTextContainer}>
                        <View style={styles.titleRow}>
                            <Text
                                variant="bodyLarge"
                                style={[
                                    styles.taskTitle,
                                    task.isCompleted && styles.completedTask,
                                ]}
                            >
                                {task.title}
                            </Text>

                            {/* Estimated Time Badge */}
                            {task.estimatedTime && (
                                <Text variant="bodySmall" style={styles.timeBadge}>
                                    {task.estimatedTime >= 60
                                        ? `${Math.floor(task.estimatedTime / 60)}h ${task.estimatedTime % 60}m`
                                        : `${task.estimatedTime}m`}
                                </Text>
                            )}

                            {/* Note Icon */}
                            {task.notes && <IconButton icon="note-text-outline" size={16} style={{ margin: 0 }} />}
                        </View>

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <View style={styles.cardTagsRow}>
                                {task.tags.map(tagId => {
                                    const tagDef = tags.find(t => t.id === tagId);
                                    if (!tagDef) return null;
                                    return (
                                        <View key={tagId} style={[styles.miniTag, { backgroundColor: tagDef.color }]}>
                                            <Text style={styles.miniTagText}>{tagDef.name}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Subtask Progress (Collapsed View) - OPTIONAL if we want to show it when collapsed too */}
                        {!expanded && task.subtasks && task.subtasks.length > 0 && (
                            <Text variant="bodySmall" style={{ marginTop: 2, color: theme.colors.outline }}>
                                {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} Subtasks
                            </Text>
                        )}
                    </View>

                    {/* Expand/Collapse Button (Only if subtasks exist) */}
                    {task.subtasks && task.subtasks.length > 0 && !isSelectionMode && (
                        <IconButton
                            icon={expanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            onPress={() => setExpanded(!expanded)}
                            style={{ margin: 0 }}
                        />
                    )}
                </View>

                {/* Expanded Subtasks List */}
                {expanded && task.subtasks && task.subtasks.length > 0 && (
                    <View style={styles.subtaskList}>
                        {task.subtasks.map((st, index) => (
                            <View key={st.id || index} style={styles.subtaskRow}>
                                <Checkbox
                                    status={st.isCompleted ? 'checked' : 'unchecked'}
                                    onPress={() => onSubtaskToggle(task.id, st.id)}
                                    disabled={isSelectionMode}
                                />
                                <Text variant="bodyMedium" style={[
                                    styles.subtaskTitle,
                                    st.isCompleted && styles.completedTask,
                                    { flex: 1 }
                                ]}
                                    onPress={() => !isSelectionMode && onSubtaskToggle(task.id, st.id)}
                                >
                                    {st.title}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    titleRow: {
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
        marginRight: 4,
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
    subtaskList: {
        marginTop: 8,
        marginLeft: 40, // Indent
        borderLeftWidth: 2,
        borderLeftColor: '#eee',
        paddingLeft: 8,
    },
    subtaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    subtaskTitle: {
        color: '#555',
    }
});

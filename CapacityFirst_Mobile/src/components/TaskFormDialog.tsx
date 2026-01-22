import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Dialog, Portal, TextInput, Button, Text, SegmentedButtons, IconButton, useTheme } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils/DateUtils';
import { AppTheme } from '../theme/theme';
import { useSettingsStore } from '../store/useSettingsStore';
import { Chip, Checkbox } from 'react-native-paper'; // Import Chip here too
import { Subtask, Task } from '../types/Task';

interface TaskFormDialogProps {
    visible: boolean;
    onDismiss: () => void;
    onSubmit: (title: string, date?: Date, estimatedTime?: number, repeatRule?: 'daily' | 'weekly', repeatConfig?: any, notes?: string, tags?: string[], subtasks?: Subtask[]) => void;
    initialTitle?: string;
    initialDate?: Date;
    initialEstimatedTime?: number;
    initialNotes?: string;
    initialTags?: string[];
    initialSubtasks?: Subtask[];
    submitLabel?: string;
    title?: string;
    validateCapacity?: (date: Date, minutes: number) => boolean;
    taskId?: string;
}

export default function TaskFormDialog({
    visible,
    onDismiss,
    onSubmit,
    initialTitle = '',
    initialDate,
    initialEstimatedTime,
    initialNotes = '',
    initialTags = [],
    initialSubtasks = [],
    submitLabel = 'Add',
    title = 'Add Task',
    validateCapacity,
    taskId
}: TaskFormDialogProps) {
    const theme = useTheme<AppTheme>();
    const { tags } = useSettingsStore();

    const [taskTitle, setTaskTitle] = useState(initialTitle);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
    const [estimatedTime, setEstimatedTime] = useState<number | undefined>(initialEstimatedTime);
    const [notes, setNotes] = useState(initialNotes);
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
    const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    const [subtaskInputKey, setSubtaskInputKey] = useState(0);

    const titleRef = useRef<any>(null);
    const notesRef = useRef<any>(null);

    // Repeat State
    const [repeatValue, setRepeatValue] = useState<string>('none'); // none, daily, weekly, custom
    // Custom Config State
    const [customFreq, setCustomFreq] = useState<'daily' | 'weekly'>('weekly');
    const [customInterval, setCustomInterval] = useState<string>('1');
    const [customDays, setCustomDays] = useState<number[]>([]); // 0-6

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setTaskTitle(initialTitle);
            const dateToUse = initialDate || new Date();
            setSelectedDate(dateToUse);
            setEstimatedTime(initialEstimatedTime);
            setNotes(initialNotes);
            setSelectedTags(initialTags || []);
            setSubtasks(initialSubtasks || []);
            setNewSubtaskTitle('');
            setRepeatValue('none');
            // Reset custom state
            setCustomFreq('weekly');
            setCustomInterval('1');
            setCustomDays(dateToUse ? [dateToUse.getDay()] : []);
        }
    }, [visible, taskId]);

    // Update default custom days when date changes if not manually set? 
    // For simplicity, let's just ensure if we switch to weekly, it defaults to the selected date's day.
    useEffect(() => {
        if (selectedDate && repeatValue === 'none') {
            setCustomDays([selectedDate.getDay()]);
        }
    }, [selectedDate, repeatValue]);

    const handleSubmit = () => {
        if (taskTitle.trim().length === 0) return;

        // Capacity Check Logic (Keep existing...)
        if (validateCapacity && selectedDate && estimatedTime) {
            const isSafe = validateCapacity(selectedDate, estimatedTime);
            if (!isSafe) {
                if (Platform.OS === 'web') {
                    const confirm = window.confirm("Capacity exceeded! Do you want to add this task anyway?");
                    if (confirm) {
                        confirmSubmit();
                    }
                } else {
                    const { Alert } = require('react-native');
                    Alert.alert(
                        "Capacity Exceeded",
                        "This task will exceed your daily capacity. Add anyway?",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Add", onPress: confirmSubmit }
                        ]
                    );
                }
                return;
            }
        }

        confirmSubmit();
    };

    const confirmSubmit = () => {
        let rule: 'daily' | 'weekly' | undefined = undefined;
        let config: any = undefined;

        if (repeatValue === 'daily') {
            rule = 'daily';
            config = { frequency: 'daily', interval: 1 };
        } else if (repeatValue === 'weekly') {
            rule = 'weekly';
            config = { frequency: 'weekly', interval: 1, daysOfWeek: customDays.length > 0 ? customDays : [selectedDate!.getDay()] };
        } else if (repeatValue === 'custom') {
            const interval = parseInt(customInterval) || 1;
            config = {
                frequency: customFreq,
                interval: interval,
                daysOfWeek: customFreq === 'weekly' ? customDays : undefined
            };
            // Map custom freq to rule for backward compat if needed, or just leave rule undefined
            rule = customFreq;
        }

        onSubmit(taskTitle, selectedDate, estimatedTime, rule, config, notes, selectedTags, subtasks);
        onDismiss();
    };

    const onDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setSelectedDate(date);
        }
    };

    const onCustomTimeChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        if (date) {
            // Convert hours/minutes to total minutes
            const hours = date.getHours();
            const minutes = date.getMinutes();
            setEstimatedTime(hours * 60 + minutes);
        }
    };

    const PRESET_TIMES = [5, 15, 30, 45, 60];

    const formatEstimatedTime = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
    };

    // Helper date for TimePicker initialization (default 00:00)
    const timePickerDate = new Date();
    timePickerDate.setHours(0, 0, 0, 0);
    if (estimatedTime) {
        timePickerDate.setHours(Math.floor(estimatedTime / 60), estimatedTime % 60);
    }

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Content>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                            <TextInput
                                ref={titleRef}
                                key={visible ? `title-${taskId || 'new'}` : 'title-hidden'} // Force re-render on task switch
                                label="Task Title"
                                defaultValue={taskTitle}
                                onChangeText={setTaskTitle}
                                style={styles.input}
                                autoFocus
                                autoComplete="off"
                                autoCorrect={false}
                                spellCheck={false}
                            />

                            <View style={styles.dateRow}>
                                <Text variant="bodyLarge">
                                    Date: {selectedDate ? formatDate(selectedDate) : 'Undecided'}
                                </Text>
                                <View style={styles.dateActions}>
                                    {selectedDate && (
                                        <Button mode="text" textColor={theme.colors.error} onPress={() => setSelectedDate(undefined)}>
                                            Clear
                                        </Button>
                                    )}
                                    <Button mode="text" onPress={() => setShowDatePicker(true)}>
                                        Change
                                    </Button>
                                </View>
                            </View>

                            <Text variant="bodyMedium" style={styles.sectionLabel}>Estimated Time</Text>
                            <View style={styles.presetRow}>
                                {PRESET_TIMES.map((min) => (
                                    <Button
                                        key={min}
                                        mode={estimatedTime === min ? 'contained' : 'outlined'}
                                        onPress={() => setEstimatedTime(min)}
                                        style={styles.presetButton}
                                        compact
                                    >
                                        {min}m
                                    </Button>
                                ))}
                            </View>
                            <View style={styles.customTimeRow}>
                                <Text variant="bodyMedium">
                                    {estimatedTime ? `Selected: ${formatEstimatedTime(estimatedTime)}` : 'No estimate'}
                                </Text>
                                <Button mode="text" onPress={() => setShowTimePicker(true)}>Custom</Button>
                            </View>

                            {/* Repeat Options */}
                            {selectedDate && (
                                <>
                                    <Text variant="bodyMedium" style={styles.sectionLabel}>Repeat</Text>
                                    <SegmentedButtons
                                        value={repeatValue}
                                        onValueChange={setRepeatValue}
                                        density="medium"
                                        buttons={[
                                            { value: 'none', label: 'None' },
                                            { value: 'daily', label: 'Daily' },
                                            { value: 'weekly', label: 'Weekly' },
                                            { value: 'custom', label: 'Custom' },
                                        ]}
                                        style={styles.segment}
                                    />

                                    {/* Weekly Days Selector */}
                                    {(repeatValue === 'weekly' || (repeatValue === 'custom' && customFreq === 'weekly')) && (
                                        <View style={styles.daysRow}>
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                                                const isSelected = customDays.includes(index);
                                                return (
                                                    <Button
                                                        key={index}
                                                        mode={isSelected ? 'contained' : 'outlined'}
                                                        onPress={() => {
                                                            if (isSelected) {
                                                                setCustomDays(customDays.filter(d => d !== index));
                                                            } else {
                                                                setCustomDays([...customDays, index]);
                                                            }
                                                        }}
                                                        style={[styles.dayButton, { minWidth: 30, paddingHorizontal: 0 }]}
                                                        labelStyle={{ fontSize: 10, marginHorizontal: 0 }}
                                                        compact
                                                    >
                                                        {day}
                                                    </Button>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {/* Custom Interval UI */}
                                    {repeatValue === 'custom' && (
                                        <View style={styles.customConfigRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodySmall">Frequency</Text>
                                                <SegmentedButtons
                                                    value={customFreq}
                                                    onValueChange={(v) => setCustomFreq(v as 'daily' | 'weekly')}
                                                    density="small"
                                                    buttons={[
                                                        { value: 'daily', label: 'Daily' },
                                                        { value: 'weekly', label: 'Weekly' },
                                                    ]}
                                                />
                                            </View>
                                            <View style={{ width: 16 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodySmall">Interval (Every N)</Text>
                                                <View style={styles.stepperContainer}>
                                                    <IconButton
                                                        icon="minus"
                                                        size={20}
                                                        onPress={() => {
                                                            const current = parseInt(customInterval) || 1;
                                                            if (current > 1) setCustomInterval((current - 1).toString());
                                                        }}
                                                        disabled={parseInt(customInterval) <= 1}
                                                        style={styles.stepperButton}
                                                    />
                                                    <Text variant="bodyLarge" style={styles.stepperValue}>
                                                        {customInterval}
                                                    </Text>
                                                    <IconButton
                                                        icon="plus"
                                                        size={20}
                                                        onPress={() => {
                                                            const current = parseInt(customInterval) || 1;
                                                            setCustomInterval((current + 1).toString());
                                                        }}
                                                        style={styles.stepperButton}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </>
                            )}

                            {showDatePicker && (
                                <DateTimePicker
                                    value={selectedDate || new Date()}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}

                            {showTimePicker && (
                                <DateTimePicker
                                    value={timePickerDate}
                                    mode="time"
                                    is24Hour={true}
                                    display="clock"
                                    onChange={onCustomTimeChange}
                                />
                            )}

                            {/* Tags Selection */}
                            {tags.length > 0 && (
                                <>
                                    <Text variant="bodyMedium" style={styles.sectionLabel}>Tags</Text>
                                    <View style={styles.tagsContainer}>
                                        {tags.map(tag => {
                                            const isSelected = selectedTags.includes(tag.id);
                                            return (
                                                <Chip
                                                    key={tag.id}
                                                    selected={isSelected}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                                        } else {
                                                            setSelectedTags([...selectedTags, tag.id]);
                                                        }
                                                    }}
                                                    style={[styles.tagChip, isSelected && { backgroundColor: tag.color + '40' }]}
                                                    textStyle={{ color: isSelected ? 'black' : tag.color }}
                                                    mode="outlined"
                                                >
                                                    {tag.name}
                                                </Chip>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            {/* Subtasks Section */}
                            <Text variant="bodyMedium" style={styles.sectionLabel}>Subtasks</Text>
                            <View style={styles.subtaskInputRow}>
                                <TextInput
                                    key={`subtask-input-${subtaskInputKey}`}
                                    mode="outlined"
                                    placeholder="Add subtask..."
                                    defaultValue={newSubtaskTitle}
                                    onChangeText={setNewSubtaskTitle}
                                    style={{ flex: 1, backgroundColor: 'transparent' }}
                                    dense
                                    autoComplete="off"
                                    autoCorrect={false}
                                    spellCheck={false}
                                    onSubmitEditing={() => {
                                        if (newSubtaskTitle.trim()) {
                                            const newSubtask: Subtask = {
                                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                                title: newSubtaskTitle.trim(),
                                                isCompleted: false
                                            };
                                            setSubtasks([...subtasks, newSubtask]);
                                            setNewSubtaskTitle('');
                                            setSubtaskInputKey(prev => prev + 1);
                                        }
                                    }}
                                />
                                <IconButton
                                    icon="plus"
                                    onPress={() => {
                                        if (newSubtaskTitle.trim()) {
                                            const newSubtask: Subtask = {
                                                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                                                title: newSubtaskTitle.trim(),
                                                isCompleted: false
                                            };
                                            setSubtasks([...subtasks, newSubtask]);
                                            setNewSubtaskTitle('');
                                            setSubtaskInputKey(prev => prev + 1);
                                        }
                                    }}
                                />
                            </View>
                            <View style={styles.subtasksList}>
                                {subtasks.map((st, index) => (
                                    <View key={st.id || index} style={styles.subtaskItem}>
                                        <Checkbox
                                            status={st.isCompleted ? 'checked' : 'unchecked'}
                                            onPress={() => {
                                                const updated = subtasks.map(s => s.id === st.id ? { ...s, isCompleted: !s.isCompleted } : s);
                                                setSubtasks(updated);
                                            }}
                                        />
                                        <Text style={[styles.subtaskText, st.isCompleted && styles.completedTask]}>
                                            {st.title}
                                        </Text>
                                        <IconButton
                                            icon="close"
                                            size={16}
                                            onPress={() => {
                                                setSubtasks(subtasks.filter(s => s.id !== st.id));
                                            }}
                                        />
                                    </View>
                                ))}
                            </View>

                            {/* Notes Input */}
                            <Text variant="bodyMedium" style={styles.sectionLabel}>Notes</Text>
                            <TextInput
                                ref={notesRef}
                                key={visible ? `notes-${taskId || 'new'}` : 'notes-hidden'}
                                mode="outlined"
                                placeholder="Add notes..."
                                defaultValue={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                style={[styles.input, { height: 80 }]}
                                autoComplete="off"
                                autoCorrect={false}
                                spellCheck={false}
                            />
                        </ScrollView>
                    </KeyboardAvoidingView>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cancel</Button>
                    <Button onPress={handleSubmit}>{submitLabel}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal >
    );
}

const styles = StyleSheet.create({
    input: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    dateActions: {
        flexDirection: 'row',
    },
    sectionLabel: {
        marginBottom: 8,
        fontWeight: 'bold',
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    presetButton: {
        minWidth: 0,
    },
    customTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    segment: {
        marginBottom: 8,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    dayButton: {
        flex: 1,
        marginHorizontal: 2,
    },
    customConfigRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center content in the flex space
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        marginTop: 4,
        height: 40,
    },
    stepperButton: {
        margin: 0,
    },
    stepperValue: {
        minWidth: 20,
        textAlign: 'center',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    tagChip: {
        marginRight: 8,
        marginBottom: 8,
    },
    subtaskInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    subtasksList: {
        marginBottom: 16,
    },
    subtaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    subtaskText: {
        flex: 1,
        marginLeft: 8,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
});

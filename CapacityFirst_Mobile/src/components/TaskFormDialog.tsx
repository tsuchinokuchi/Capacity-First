import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Dialog, Portal, TextInput, Button, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils/DateUtils';

interface TaskFormDialogProps {
    visible: boolean;
    onDismiss: () => void;
    onSubmit: (title: string, date?: Date, estimatedTime?: number) => void;
    initialTitle?: string;
    initialDate?: Date; // undefined means "Undecided"
    initialEstimatedTime?: number;
    submitLabel?: string;
    title?: string;
}

export default function TaskFormDialog({
    visible,
    onDismiss,
    onSubmit,
    initialTitle = '',
    initialDate,
    initialEstimatedTime,
    submitLabel = 'Add',
    title = 'Add Task',
    validateCapacity
}: TaskFormDialogProps & { validateCapacity?: (date: Date, minutes: number) => boolean }) {
    const [taskTitle, setTaskTitle] = useState(initialTitle);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
    const [estimatedTime, setEstimatedTime] = useState<number | undefined>(initialEstimatedTime);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setTaskTitle(initialTitle);
            setSelectedDate(initialDate);
            setEstimatedTime(initialEstimatedTime);
        }
    }, [visible, initialTitle, initialDate, initialEstimatedTime]);

    const handleConfirmSubmit = () => {
        onSubmit(taskTitle, selectedDate, estimatedTime);
        onDismiss();
    };

    const handleSubmit = () => {
        if (taskTitle.trim().length === 0) return;

        // Capacity Check Logic
        if (validateCapacity && selectedDate && estimatedTime) {
            const isSafe = validateCapacity(selectedDate, estimatedTime);
            if (!isSafe) {
                // Determine if we are on web or native for Alert
                if (Platform.OS === 'web') {
                    const confirm = window.confirm("Capacity exceeded! Do you want to add this task anyway?");
                    if (confirm) {
                        handleConfirmSubmit();
                    }
                } else {
                    const { Alert } = require('react-native');
                    Alert.alert(
                        "Capacity Exceeded",
                        "This task will exceed your daily capacity. Add anyway?",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Add", onPress: handleConfirmSubmit }
                        ]
                    );
                }
                return;
            }
        }

        handleConfirmSubmit();
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
                    <TextInput
                        label="Task Title"
                        value={taskTitle}
                        onChangeText={setTaskTitle}
                        style={styles.input}
                        autoFocus
                    />

                    <View style={styles.dateRow}>
                        <Text variant="bodyLarge">
                            Date: {selectedDate ? formatDate(selectedDate) : 'Undecided'}
                        </Text>
                        <View style={styles.dateActions}>
                            {selectedDate && (
                                <Button mode="text" textColor="red" onPress={() => setSelectedDate(undefined)}>
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
                            display="clock" // Ring style on Android
                            onChange={onCustomTimeChange}
                        />
                    )}

                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cancel</Button>
                    <Button onPress={handleSubmit}>{submitLabel}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
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
    }
});

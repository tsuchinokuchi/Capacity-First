import React, { useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Text, Card, IconButton, FAB, useTheme, Button, Portal, Dialog, TextInput, Menu, Divider } from 'react-native-paper';
import { useTaskStore } from '../store/useTaskStore';
import { AppTheme } from '../theme/theme';
import { Project } from '../types/Task';
import ProjectDetailsDialog from '../components/ProjectDetailsDialog';

export default function ProjectScreen() {
    const theme = useTheme<AppTheme>();
    const { projects, addProject, updateProject, deleteProject } = useTaskStore();

    // Dialog State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    // Template Selection State
    const [templateDialogVisible, setTemplateDialogVisible] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);

    // Project Details State
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // Menu State
    const [menuVisible, setMenuVisible] = useState<string | null>(null);

    // Filter active projects only (templates handled in settings)
    const activeProjects = projects.filter(p => p.status === 'active');
    const templates = projects.filter(p => p.status === 'template');

    const openAddDialog = () => {
        setEditingProject(null);
        setTitle('');
        setDescription('');
        setSelectedTemplateId(undefined);
        setDialogVisible(true);
    };

    const openEditDialog = (project: Project) => {
        setEditingProject(project);
        setTitle(project.title);
        setDescription(project.description || '');
        setDialogVisible(true);
    };

    const handleSubmit = () => {
        if (!title.trim()) return;

        if (editingProject) {
            updateProject(editingProject.id, {
                title,
                description
            });
        } else {
            addProject({
                title,
                description,
                color: theme.colors.primary, // Default color for now
                status: 'active'
            }, selectedTemplateId);
        }
        setDialogVisible(false);
        setTemplateDialogVisible(false); // Close template dialog if open
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Project",
            "Are you sure? Tasks will be unlinked (moved to Someday).",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteProject(id) }
            ]
        );
    };

    const openTemplateSelection = () => {
        if (templates.length === 0) {
            // No templates, just open normal add dialog
            openAddDialog();
        } else {
            setTemplateDialogVisible(true);
        }
    };

    const renderItem = ({ item }: { item: Project }) => (
        <Card style={styles.card} onPress={() => {
            setSelectedProject(item);
            setDetailsVisible(true);
        }}>
            <Card.Content style={styles.cardContent}>
                <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{item.title}</Text>
                    {item.description ? <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{item.description}</Text> : null}
                </View>
                <Menu
                    visible={menuVisible === item.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={<IconButton icon="dots-vertical" onPress={() => setMenuVisible(item.id)} />}
                >
                    <Menu.Item onPress={() => { setMenuVisible(null); openEditDialog(item); }} title="Edit" />
                    <Menu.Item onPress={() => { setMenuVisible(null); handleDelete(item.id); }} title="Delete" />
                </Menu>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.headerContainer}>
                <Text variant="headlineMedium" style={styles.header}>Projects</Text>
            </View>

            <FlatList
                data={activeProjects}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No active projects.</Text>
                }
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                onPress={openTemplateSelection}
                color="white"
                label="New Project"
            />

            {/* Add/Edit Dialog */}
            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>{editingProject ? "Edit Project" : "New Project"}</Dialog.Title>
                    <Dialog.Content>
                        {selectedTemplateId && (
                            <Text style={{ marginBottom: 8, color: theme.colors.primary }}>
                                Creating from template...
                            </Text>
                        )}
                        <TextInput
                            label="Project Title"
                            value={title}
                            onChangeText={setTitle}
                            style={styles.input}
                            autoFocus
                        />
                        <TextInput
                            label="Description"
                            value={description}
                            onChangeText={setDescription}
                            style={styles.input}
                            multiline
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleSubmit}>{editingProject ? "Update" : "Create"}</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Template Selection Dialog */}
            <Portal>
                <Dialog visible={templateDialogVisible} onDismiss={() => setTemplateDialogVisible(false)}>
                    <Dialog.Title>Create Project</Dialog.Title>
                    <Dialog.Content>
                        <Button mode="outlined" style={styles.templateButton} onPress={() => {
                            setTemplateDialogVisible(false);
                            openAddDialog();
                        }}>
                            Empty Project
                        </Button>
                        <Divider style={{ marginVertical: 16 }} />
                        <Text variant="bodyMedium" style={{ marginBottom: 8 }}>From Template:</Text>
                        {templates.map(t => (
                            <Button
                                key={t.id}
                                mode="contained-tonal"
                                style={styles.templateButton}
                                onPress={() => {
                                    setTemplateDialogVisible(false);
                                    setSelectedTemplateId(t.id);
                                    // Pre-fil title?
                                    setTitle(t.title); // Pre-fill with template name?
                                    setDialogVisible(true);
                                }}
                            >
                                {t.title}
                            </Button>
                        ))}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setTemplateDialogVisible(false)}>Cancel</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>


            {/* Project Details Dialog */}
            {
                selectedProject && (
                    <ProjectDetailsDialog
                        visible={detailsVisible}
                        onDismiss={() => setDetailsVisible(false)}
                        project={selectedProject}
                    />
                )
            }
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    headerContainer: {
        marginBottom: 16,
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
        justifyContent: 'space-between',
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
    },
    input: {
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    templateButton: {
        marginBottom: 8,
        justifyContent: 'flex-start',
    }
});

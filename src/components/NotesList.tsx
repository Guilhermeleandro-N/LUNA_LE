import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { ReadingNote } from '../services/notesStorage';

interface NotesListProps {
  notes: ReadingNote[];
  showDocumentName?: boolean;
  onEdit: (note: ReadingNote) => void;
  onDelete: (note: ReadingNote) => void;
  emptyMessage?: string;
}

export default function NotesList({
  notes,
  showDocumentName = false,
  onEdit,
  onDelete,
  emptyMessage = 'Nenhuma nota encontrada.',
}: NotesListProps) {
  if (notes.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {notes.map((note) => (
        <View key={note.id} style={styles.noteCard}>
          <View style={styles.topRow}>
            <Text style={styles.pageTag}>
              Pág. {note.page}
              {showDocumentName && note.documentName
                ? ` • ${note.documentName}`
                : ''}
            </Text>
            <Text style={styles.dateTag}>
              {new Date(note.updatedAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>

          {!!note.selectedText && (
            <View style={styles.quoteBox}>
              <Text style={styles.quoteText} numberOfLines={3}>
                “{note.selectedText}”
              </Text>
            </View>
          )}

          <Text style={styles.content}>{note.content}</Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onEdit(note)} style={styles.actionBtn}>
              <Text style={styles.editText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDelete(note)}
              style={styles.actionBtn}
            >
              <Text style={styles.deleteText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    marginBottom: 16,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  noteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  pageTag: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  dateTag: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  quoteBox: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textPrimary,
  },
  content: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: 10,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  editText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
});
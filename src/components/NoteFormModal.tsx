import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../styles/theme';
import { ReadingNote } from '../services/notesStorage';

interface NoteFormModalProps {
  visible: boolean;
  initialSelectedText?: string;
  editingNote?: ReadingNote | null;
  onClose: () => void;
  onSave: (payload: {
    content: string;
    selectedText?: string;
  }) => Promise<void> | void;
}

export default function NoteFormModal({
  visible,
  initialSelectedText,
  editingNote,
  onClose,
  onSave,
}: NoteFormModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {visible && (
        <NoteForm
          key={editingNote?.id ?? `new:${initialSelectedText ?? ''}`}
          initialSelectedText={initialSelectedText}
          editingNote={editingNote}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

function NoteForm({
  initialSelectedText,
  editingNote,
  onClose,
  onSave,
}: Omit<NoteFormModalProps, 'visible'>) {
  const [content, setContent] = useState(editingNote?.content ?? '');
  const selectedText = editingNote
    ? editingNote.selectedText
    : initialSelectedText;
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave() {
    if (!content.trim()) {
      setErrorMsg('Digite o texto da nota antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      await onSave({
        content: content.trim(),
        selectedText,
      });
      onClose();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : 'Falha ao salvar nota.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {editingNote ? 'Editar nota' : 'Adicionar nota'}
        </Text>

        {!!selectedText && (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteLabel}>Trecho marcado</Text>
            <Text style={styles.quoteText} numberOfLines={4}>
              “{selectedText}”
            </Text>
          </View>
        )}

        <TextInput
          value={content}
          onChangeText={(text) => {
            setContent(text);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="Escreva sua anotação..."
          placeholderTextColor="#9CA3AF"
          multiline
          autoFocus
          style={styles.input}
        />

        {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onClose}
            disabled={saving}
            style={styles.btn}
          >
            <Text style={styles.cancelText}>CANCELAR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.btn, styles.saveBtn]}
          >
            <Text style={styles.saveText}>
              {saving ? 'SALVANDO...' : 'SALVAR'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  quoteBox: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
  },
  input: {
    minHeight: 96,
    maxHeight: 190,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
  },
  saveText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
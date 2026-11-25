import React, { useCallback, useState } from 'react';

import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

import ContinueReadingCard from '../components/ContinueReadingCard';
import BookListItem from '../components/BookListItem';
import UploadCard from '../components/UploadCard';
import NotesList from '../components/NotesList';
import NoteFormModal from '../components/NoteFormModal';
import styles from '../styles/index';

import {
  getSavedReadings,
  saveReadingProgress,
  type SavedReading,
} from '../services/readingProgress';
import {
  deleteNote,
  getNotes,
  updateNote,
  type ReadingNote,
} from '../services/notesStorage';
import { resolveDocumentName } from '../utils/documentName';
import {
  getPickedAsset,
  isPdfTooLarge,
  shouldCopyPickerFileToCache,
} from '../utils/pdfImport';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Guarda os documentos que já foram abertos
  const [readings, setReadings] = useState<SavedReading[]>([]);

  // Guarda as notas salvas nos documentos
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  // Controla a exibição da lista de documentos
  const [showAll, setShowAll] = useState(false);

  const refreshNotes = useCallback(async () => {
    const savedNotes = await getNotes();
    setNotes(savedNotes);
  }, []);

  // B - Recupera as leituras e notas salvas ao abrir a tela inicial
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadLibraryData() {
        try {
          const [savedReadings, savedNotes] = await Promise.all([
            getSavedReadings(),
            getNotes(),
          ]);

          if (active) {
            setReadings(savedReadings);
            setNotes(savedNotes);
          }
        } catch (error) {
          console.error(
            'Erro ao carregar biblioteca:',
            error
          );

          if (active) {
            Alert.alert(
              'Erro',
              'Não foi possível carregar os documentos salvos.'
            );
          }
        }
      }

      void loadLibraryData();

      return () => {
        active = false;
      };
    }, [])
  );

  async function handleSaveEditedNote(payload: {
    content: string;
    selectedText?: string;
  }) {
    if (!editingNote) return;
    await updateNote(editingNote.id, payload);
    setEditingNote(null);
    await refreshNotes();
  }

  function handleRequestDeleteNote(note: ReadingNote) {
    Alert.alert(
      'Excluir nota',
      'Deseja realmente remover esta nota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteNote(note.id).then(refreshNotes);
          },
        },
      ]
    );
  }

  // B - Abre um PDF que já foi lido anteriormente
  function handleContinueReading(reading: SavedReading) {
    try {
      const savedFile = new File(reading.uri);

      if (!savedFile.exists) {
        Alert.alert(
          'Arquivo não encontrado',
          'O documento não está mais disponível. Importe o PDF novamente.'
        );
        return;
      }

      router.push({
        pathname: './reader',
        params: {
          uri: encodeURIComponent(reading.uri),
          name: reading.name,
        },
      });
    } catch (error) {
      console.error(
        'Erro ao retomar leitura:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível abrir o documento.'
      );
    }
  }

  // A - Seleciona e salva um novo PDF
  async function handleOpenPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory:
          shouldCopyPickerFileToCache(Platform.OS),
      });

      const asset = getPickedAsset(result);

      if (!asset) {
        return;
      }

      if (isPdfTooLarge(asset.size)) {
        Alert.alert(
          'Arquivo muito grande',
          'Selecione um PDF de até 100 MB.'
        );
        return;
      }

      const { name: documentName, usedFallback } =
        resolveDocumentName(asset.name);

      const uniqueName = `pdf-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.pdf`;

      const copiedFile = new File(
        Paths.document,
        uniqueName
      );

      const sourceFile = new File(asset.uri);

      await sourceFile.copy(copiedFile);

      if (!copiedFile.exists) {
        throw new Error(
          'Não foi possível salvar a cópia do PDF.'
        );
      }

      if (isPdfTooLarge(copiedFile.size)) {
        try {
          copiedFile.delete();
        } catch (cleanupError) {
          console.warn(
            'Não foi possível remover a cópia grande:',
            cleanupError
          );
        }

        Alert.alert(
          'Arquivo muito grande',
          'Selecione um PDF de até 100 MB.'
        );
        return;
      }

      await saveReadingProgress({
        uri: copiedFile.uri,
        name: documentName,
        currentPage: 1,
        totalPages: 0,
      });

      if (usedFallback) {
        Alert.alert(
          'Nome do documento',
          'Não foi possível identificar o nome original do PDF. ' +
            'Ele será exibido como "Documento PDF.pdf".'
        );
      }

      router.push({
        pathname: './reader',
        params: {
          uri: encodeURIComponent(copiedFile.uri),
          name: documentName,
        },
      });
    } catch (error) {
      console.error(
        'Erro ao selecionar ou copiar PDF:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível acessar ou salvar o PDF selecionado.'
      );
    }
  }

  const latestReading = readings[0];

  function calculateProgress(reading: SavedReading) {
    if (reading.totalPages <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (reading.currentPage / reading.totalPages) * 100
      )
    );
  }

  const visibleReadings = showAll
    ? readings
    : readings.slice(0, 3);

  return (
    <View
      style={[
        styles.safeArea,
        { paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho original */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>
                🌙
              </Text>
            </View>

            <Text style={styles.logoText}>
              LunaLê
            </Text>
          </View>

          <Text style={styles.librarySubtitle}>
            Sua Biblioteca
          </Text>

          <Text style={styles.greeting}>
            Como vai, Clara?
          </Text>
        </View>

        {/* B - Continuar a leitura do último PDF */}
        {latestReading ? (
          <ContinueReadingCard
            bookTitle={latestReading.name}
            currentChapter={
              `página ${latestReading.currentPage}${
                latestReading.totalPages > 0
                  ? ` de ${latestReading.totalPages}`
                  : ''
              }`
            }
            progress={calculateProgress(latestReading)}
            onContinue={() =>
              handleContinueReading(latestReading)
            }
          />
        ) : (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 14,
                color: '#777777',
              }}
            >
              Nenhuma leitura iniciada ainda.
              Abra um PDF para começar!
            </Text>
          </View>
        )}

        {/* Seção de documentos recentes */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionCategory}>
              Últimos Acessos
            </Text>

            <Text style={styles.sectionTitle}>
              Recentes
            </Text>
          </View>

          {readings.length > 3 && (
            <TouchableOpacity
              onPress={() => setShowAll(!showAll)}
            >
              <Text style={styles.verTodosText}>
                {showAll ? 'Ver Menos' : 'Ver Todos'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* B - Lista dos PDFs realmente salvos */}
        {visibleReadings.length > 0 ? (
          visibleReadings.map((reading) => (
            <BookListItem
              key={reading.uri}
              title={reading.name}
              author="Documento PDF"
              currentPage={reading.currentPage}
              totalPages={reading.totalPages}
              onPress={() =>
                handleContinueReading(reading)
              }
            />
          ))
        ) : (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 14,
                color: '#777777',
              }}
            >
              Você ainda não possui PDFs recentes.
            </Text>
          </View>
        )}

        {/* Seção de notas salvas */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionCategory}>
              Anotações e Citações
            </Text>

            <Text style={styles.sectionTitle}>
              Minhas Notas ({notes.length})
            </Text>
          </View>
        </View>

        <NotesList
          notes={notes}
          showDocumentName
          emptyMessage="Nenhuma nota salva ainda. Abra um PDF para marcar trechos e adicionar notas."
          onEdit={(note) => {
            setEditingNote(note);
            setNoteModalVisible(true);
          }}
          onDelete={handleRequestDeleteNote}
        />

        <UploadCard onPress={handleOpenPdf} />
      </ScrollView>

      <NoteFormModal
        visible={noteModalVisible}
        editingNote={editingNote}
        onClose={() => {
          setNoteModalVisible(false);
          setEditingNote(null);
        }}
        onSave={handleSaveEditedNote}
      />
    </View>
  );
}
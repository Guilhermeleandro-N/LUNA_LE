
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
import styles from '../styles/index';

import {
  getSavedReadings,
  saveReadingProgress,
  type SavedReading,
} from '../services/readingProgress';
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

  // Controla a exibição da lista de documentos
  const [showAll, setShowAll] = useState(false);

  // B - Recupera as leituras salvas ao abrir a tela inicial
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadReadings() {
        try {
          const saved = await getSavedReadings();

          if (active) {
            setReadings(saved);
          }
        } catch (error) {
          console.error(
            'Erro ao carregar leituras:',
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

      void loadReadings();

      return () => {
        active = false;
      };
    }, [])
  );

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

      // Abre o leitor usando o caminho do PDF salvo
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
      // O seletor de documentos devolve o nome original do arquivo.
      // File.pickFileAsync() usa o último segmento da URI, que no Android
      // pode ser um identificador interno (msf:123456).
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory:
          shouldCopyPickerFileToCache(Platform.OS),
      });

      const asset = getPickedAsset(result);

      if (!asset) {
        return;
      }

      // Verifica o tamanho informado pelo sistema, quando disponível.
      if (isPdfTooLarge(asset.size)) {
        Alert.alert(
          'Arquivo muito grande',
          'Selecione um PDF de até 100 MB.'
        );
        return;
      }

      const { name: documentName, usedFallback } =
        resolveDocumentName(asset.name);

      console.log('PDF ORIGINAL:', {
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        documentName,
      });

      // Cria um nome único para o documento
      const uniqueName = `pdf-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.pdf`;

      // Salva o documento em armazenamento persistente
      const copiedFile = new File(
        Paths.document,
        uniqueName
      );

      const sourceFile = new File(asset.uri);

      // No Android, sourceFile aponta para o content:// original; nunca
      // devemos apagá-lo, pois ele pertence ao usuário.
      await sourceFile.copy(copiedFile);

      console.log('PDF COPIADO:', {
        uri: copiedFile.uri,
        exists: copiedFile.exists,
        size: copiedFile.size,
      });

      if (!copiedFile.exists) {
        throw new Error(
          'Não foi possível salvar a cópia do PDF.'
        );
      }

      // Validação definitiva com o tamanho da cópia persistida.
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

      // A - Registra o novo PDF na página 1
      await saveReadingProgress({
        uri: copiedFile.uri,
        name: documentName,
        currentPage: 1,
        totalPages: 0,
      });

      console.log(
        'Documento registrado no histórico:',
        documentName
      );

      if (usedFallback) {
        Alert.alert(
          'Nome do documento',
          'Não foi possível identificar o nome original do PDF. ' +
            'Ele será exibido como "Documento PDF.pdf".'
        );
      }

      // Abre o leitor
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

  // B - Documento aberto mais recentemente
  const latestReading = readings[0];

  // Calcula o percentual de leitura
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

  // Mostra inicialmente apenas os 3 documentos recentes
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

        {}
        <UploadCard onPress={handleOpenPdf} />

      </ScrollView>
    </View>
  );
}

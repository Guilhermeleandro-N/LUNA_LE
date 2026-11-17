
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSavedReading,
  saveReadingProgress,
} from '../services/readingProgress';

type PdfMessage = {
  tipo: 'PDF_INFO' | 'PAGE_CHANGED' | 'ERRO_PDF';
  page?: number;
  totalPages?: number;
  mensagem?: string;
};

export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    name: string;
  }>();

  const rawUri = Array.isArray(params.uri)
    ? params.uri[0]
    : params.uri;

  const uri = rawUri?.startsWith('file://')
    ? rawUri
    : rawUri
      ? decodeURIComponent(rawUri)
      : '';

  const name = (Array.isArray(params.name)
    ? params.name[0]
    : params.name) || 'Documento PDF';

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Controle das páginas do documento
  const [initialPage, setInitialPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(0);

  // A - Recupera o progresso salvo e carrega o PDF
  useEffect(() => {
    let active = true;

    async function loadPdf() {
      try {
        setLoading(true);
        setErrorMessage(null);
        setPdfBase64(null);
        setTotalPages(0);

        if (!uri) {
          throw new Error(
            'O endereço do arquivo não foi recebido.'
          );
        }

        // Recupera a última página salva
        const saved = await getSavedReading(uri);

        const savedPage = Math.max(
          1,
          saved?.currentPage || 1
        );

        const pdfFile = new File(uri);

        if (!pdfFile.exists) {
          throw new Error(
            'O arquivo PDF não foi encontrado no armazenamento do aplicativo.'
          );
        }

        // Lê o arquivo como Base64
        const base64 = await pdfFile.base64();

        if (!base64) {
          throw new Error(
            'O arquivo PDF está vazio ou não pôde ser lido.'
          );
        }

        if (active) {
          currentPageRef.current = savedPage;
          totalPagesRef.current = 0;

          setInitialPage(savedPage);
          setCurrentPage(savedPage);
          setPdfBase64(base64);

          console.log(
            'Última página salva:',
            savedPage
          );
        }
      } catch (error) {
        console.error('Erro ao carregar PDF:', error);

        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o PDF.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      active = false;
    };
  }, [uri]);

  // A - Salva uma página no AsyncStorage
  function savePage(page: number, count: number) {
    if (!uri) return;

    void saveReadingProgress({
      uri,
      name,
      currentPage: page,
      totalPages: count,
    })
      .then(() => {
        console.log('Página salva:', page);
      })
      .catch((error) => {
        console.error(
          'Erro ao salvar página:',
          error
        );
      });
  }

  // A - Recebe as mensagens enviadas pelo PDF.js
  function handlePdfMessage(data: string) {
    let message: PdfMessage;

    try {
      message = JSON.parse(data) as PdfMessage;
    } catch {
      return;
    }

    if (message.tipo === 'ERRO_PDF') {
      setErrorMessage(
        message.mensagem ||
        'Ocorreu um erro ao exibir o PDF.'
      );
      return;
    }

    // Recebe o total de páginas do PDF
    if (message.tipo === 'PDF_INFO') {
      const count = Number(message.totalPages);

      if (!Number.isInteger(count) || count < 1) {
        return;
      }

      totalPagesRef.current = count;
      setTotalPages(count);

      const page = Math.min(
        currentPageRef.current,
        count
      );

      currentPageRef.current = page;
      setCurrentPage(page);

      savePage(page, count);
    }

    // Detecta quando o usuário muda de página
    if (message.tipo === 'PAGE_CHANGED') {
      const newPage = Number(message.page);

      if (!Number.isInteger(newPage) || newPage < 1) {
        return;
      }

      const page = totalPagesRef.current > 0
        ? Math.min(newPage, totalPagesRef.current)
        : newPage;

      if (page === currentPageRef.current) {
        return;
      }

      currentPageRef.current = page;
      setCurrentPage(page);

      // Salva automaticamente a nova página
      savePage(page, totalPagesRef.current);
    }
  }

  // B - PDF.js recupera a página e acompanha a rolagem
  const html = useMemo(() => {
    if (!pdfBase64) return '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 12px;
            background: #e8e8e8;
          }

          .page {
            display: block;
            width: 100%;
            height: auto;
            margin: 0 auto 15px;
            background: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
          }

          #loading {
            text-align: center;
            padding: 30px;
            font-family: Arial, sans-serif;
            color: #555;
            font-size: 14px;
          }
        </style>
      </head>

      <body>
        <div id="loading">Carregando páginas...</div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

        <script>
          const initialPage = ${JSON.stringify(initialPage)};
          const base64 = ${JSON.stringify(pdfBase64)};

          let pageCount = 0;
          let lastReportedPage = initialPage;
          let readerReady = false;
          let framePending = false;

          function sendMessage(tipo, data) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  tipo: tipo,
                  ...data
                })
              );
            }
          }

          // Descobre qual página está visível
          function getVisiblePage() {
            const pages = document.querySelectorAll('.page');

            let visiblePage = 1;
            const position = window.scrollY + 100;

            for (let i = 0; i < pages.length; i++) {
              if (pages[i].offsetTop <= position) {
                visiblePage = i + 1;
              } else {
                break;
              }
            }

            return Math.max(
              1,
              Math.min(pageCount, visiblePage)
            );
          }

          // Comunica a mudança de página
          function reportCurrentPage() {
            if (!readerReady) return;

            const page = getVisiblePage();

            if (page !== lastReportedPage) {
              lastReportedPage = page;

              sendMessage('PAGE_CHANGED', {
                page: page
              });
            }
          }

          // Detecta a rolagem do documento
          function handleScroll() {
            if (!readerReady || framePending) {
              return;
            }

            framePending = true;

            requestAnimationFrame(function () {
              framePending = false;
              reportCurrentPage();
            });
          }

          // Carrega o PDF e renderiza as páginas
          async function renderPdf() {
            const loadingElement =
              document.getElementById('loading');

            try {
              if (typeof pdfjsLib === 'undefined') {
                throw new Error(
                  'Não foi possível carregar o PDF.js. Verifique sua conexão com a internet.'
                );
              }

              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);

              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }

              const pdf = await pdfjsLib.getDocument({
                data: bytes
              }).promise;

              pageCount = pdf.numPages;

              // Informa o total de páginas ao aplicativo
              sendMessage('PDF_INFO', {
                totalPages: pageCount
              });

              loadingElement.remove();

              // Renderiza cada página
              for (
                let pageNumber = 1;
                pageNumber <= pageCount;
                pageNumber++
              ) {
                const page = await pdf.getPage(pageNumber);

                const containerWidth =
                  document.documentElement.clientWidth - 24;

                const originalViewport = page.getViewport({
                  scale: 1
                });

                const scale =
                  containerWidth / originalViewport.width;

                const viewport = page.getViewport({
                  scale: scale
                });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                if (!context) {
                  throw new Error(
                    'Não foi possível criar o canvas.'
                  );
                }

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.className = 'page';

                document.body.appendChild(canvas);

                await page.render({
                  canvasContext: context,
                  viewport: viewport
                }).promise;
              }

              // B - Retoma a leitura na última página salva
              const targetPage = Math.min(
                pageCount,
                Math.max(1, initialPage)
              );

              const pages = document.querySelectorAll('.page');
              const targetCanvas = pages[targetPage - 1];

              if (targetCanvas) {
                targetCanvas.scrollIntoView({
                  block: 'start',
                  behavior: 'instant'
                });
              }

              // Começa a observar a rolagem
              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  lastReportedPage = targetPage;
                  readerReady = true;

                  sendMessage('PAGE_CHANGED', {
                    page: targetPage
                  });

                  window.addEventListener(
                    'scroll',
                    handleScroll,
                    { passive: true }
                  );
                });
              });

              // Registra a página ao sair da WebView
              window.addEventListener(
                'pagehide',
                reportCurrentPage
              );

              document.addEventListener(
                'visibilitychange',
                function () {
                  if (document.hidden) {
                    reportCurrentPage();
                  }
                }
              );

            } catch (error) {
              console.error('Erro no PDF.js:', error);

              const mensagem =
                error && error.message
                  ? error.message
                  : String(error);

              if (
                loadingElement &&
                loadingElement.isConnected
              ) {
                loadingElement.textContent =
                  'Erro ao exibir PDF: ' + mensagem;
              }

              sendMessage('ERRO_PDF', {
                mensagem: mensagem
              });
            }
          }

          renderPdf();
        </script>
      </body>
      </html>
    `;
  }, [pdfBase64, initialPage]);

  const webSource = useMemo(() => ({ html }), [html]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>
            ‹ Voltar
          </Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>

          {totalPages > 0 && (
            <Text style={styles.pageLabel}>
              Página {currentPage} de {totalPages}
            </Text>
          )}
        </View>
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#6C63FF"
          />

          <Text style={styles.message}>
            Carregando PDF...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            Não foi possível abrir o documento.
          </Text>

          <Text style={styles.message}>
            {errorMessage}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>
              Voltar e selecionar novamente
            </Text>
          </TouchableOpacity>
        </View>
      ) : pdfBase64 ? (
        <WebView
          key={uri}
          originWhitelist={['*']}
          source={webSource}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event) => {
            handlePdfMessage(event.nativeEvent.data);
          }}
          onError={(event) => {
            console.error(
              'Erro na WebView:',
              event.nativeEvent
            );

            setErrorMessage(
              'Ocorreu um erro ao carregar a tela de leitura.'
            );
          }}
          onHttpError={(event) => {
            console.error(
              'Erro HTTP na WebView:',
              event.nativeEvent
            );
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    gap: 16,
  },

  headerInfo: {
    flex: 1,
  },

  backButton: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '600',
  },

  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
  },

  pageLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#777777',
  },

  webview: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },

  message: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

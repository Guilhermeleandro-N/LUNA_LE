
import React, { useEffect, useState } from 'react';

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

export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    uri: string;
    name: string;
  }>();

  const uri = Array.isArray(params.uri)
    ? params.uri[0]
    : params.uri;

  const name = Array.isArray(params.name)
    ? params.name[0]
    : params.name;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPdf() {
      try {
        setLoading(true);
        setErrorMessage(null);
        setPdfBase64(null);

        if (!uri) {
          throw new Error('O endereço do arquivo não foi recebido.');
        }

        console.log('URI RECEBIDA PELO LEITOR:', uri);

        // Cria uma referência ao arquivo
        const pdfFile = new File(uri);

        // Verifica os dados do arquivo
        console.log('ARQUIVO NO LEITOR:', {
          uri: pdfFile.uri,
          existe: pdfFile.exists,
          tamanho: pdfFile.size,
          tipo: pdfFile.type,
        });

        if (!pdfFile.exists) {
          throw new Error(
            'O arquivo PDF não foi encontrado no armazenamento do aplicativo.'
          );
        }

        // Lê o conteúdo do PDF em Base64
        console.log('INICIANDO LEITURA DO PDF...');

        const base64 = await pdfFile.base64();

        console.log('PDF LIDO COM SUCESSO:', {
          tamanhoBase64: base64.length,
        });

        if (!base64 || base64.length === 0) {
          throw new Error(
            'O arquivo PDF está vazio ou não pôde ser lido.'
          );
        }

        if (active) {
          setPdfBase64(base64);
        }

      } catch (error) {
        console.error('ERRO AO CARREGAR PDF:', error);

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

    loadPdf();

    return () => {
      active = false;
    };
  }, [uri]);

  const html = pdfBase64
    ? `
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
          async function renderPdf() {
            const loadingElement = document.getElementById('loading');

            try {
              console.log('INICIANDO PDF.JS...');

              if (typeof pdfjsLib === 'undefined') {
                throw new Error(
                  'Não foi possível carregar a biblioteca PDF.js. Verifique sua conexão com a internet.'
                );
              }

              console.log('PDF.JS CARREGADO COM SUCESSO.');

              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

              const base64 = ${JSON.stringify(pdfBase64)};

              console.log('CONVERTENDO BASE64...');

              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);

              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }

              console.log('TAMANHO DOS DADOS:', bytes.length);

              console.log('INICIANDO INTERPRETAÇÃO DO PDF...');

              const pdf = await pdfjsLib.getDocument({
                data: bytes
              }).promise;

              console.log('PDF INTERPRETADO:', pdf.numPages, 'páginas');

              loadingElement.remove();

              // Renderiza as páginas uma por vez
              for (
                let pageNumber = 1;
                pageNumber <= pdf.numPages;
                pageNumber++
              ) {
                console.log('RENDERIZANDO PÁGINA:', pageNumber);

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

                console.log('PÁGINA RENDERIZADA:', pageNumber);
              }

              console.log('TODAS AS PÁGINAS FORAM RENDERIZADAS.');

            } catch (error) {
              console.error('ERRO NO PDF.JS:', error);

              const mensagem = error && error.message
                ? error.message
                : String(error);

              loadingElement.textContent =
                'Erro ao exibir PDF: ' + mensagem;

              // Envia o erro para o React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    tipo: 'ERRO_PDF',
                    mensagem: mensagem
                  })
                );
              }
            }
          }

          renderPdf();
        </script>
      </body>
      </html>
    `
    : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>‹ Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {name || 'Leitor de PDF'}
        </Text>
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />

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
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled

          onMessage={(event) => {
            console.log(
              'MENSAGEM DO WEBVIEW:',
              event.nativeEvent.data
            );
          }}

          onError={(event) => {
            console.error(
              'ERRO NO WEBVIEW:',
              event.nativeEvent
            );

            setErrorMessage(
              'Ocorreu um erro ao carregar a tela de leitura.'
            );
          }}

          onHttpError={(event) => {
            console.error(
              'ERRO HTTP NO WEBVIEW:',
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

  backButton: {
    fontSize: 16,
    color: '#6C63FF',
    fontWeight: '600',
  },

  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
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

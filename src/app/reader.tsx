import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView, type WebViewProps } from 'react-native-webview';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getSavedReading,
  saveReadingProgress,
} from '../services/readingProgress';
import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  type ReadingNote,
} from '../services/notesStorage';
import NoteFormModal from '../components/NoteFormModal';
import NotesList from '../components/NotesList';
import { COLORS } from '../styles/theme';
import { resolveDocumentName } from '../utils/documentName';

type PdfMessage = {
  tipo: 'PDF_INFO' | 'PAGE_CHANGED' | 'ERRO_PDF' | 'TEXT_SELECTED';
  page?: number;
  totalPages?: number;
  mensagem?: string;
  selectedText?: string;
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

  const rawName = Array.isArray(params.name)
    ? params.name[0]
    : params.name;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebView<WebViewProps> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState(
    () => resolveDocumentName(rawName).name
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Controle das páginas do documento
  const [initialPage, setInitialPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Estado das notas e seleção de texto
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<ReadingNote | null>(null);
  const [notesDrawerVisible, setNotesDrawerVisible] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(0);

  const triggerSavedToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setShowSavedToast(true);
    toastTimeoutRef.current = setTimeout(() => {
      setShowSavedToast(false);
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const refreshNotes = useCallback(async () => {
    if (!uri) return;
    const list = await getNotes(uri);
    setNotes(list);
  }, [uri]);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

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

        const saved = await getSavedReading(uri);

        const resolvedName = saved
          ? resolveDocumentName(saved.name).name
          : null;

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

        const base64 = await pdfFile.base64();

        if (!base64) {
          throw new Error(
            'O arquivo PDF está vazio ou não pôde ser lido.'
          );
        }

        if (active) {
          if (resolvedName) {
            setDocumentName(resolvedName);
          }

          currentPageRef.current = savedPage;
          totalPagesRef.current = 0;

          setInitialPage(savedPage);
          setCurrentPage(savedPage);
          setPdfBase64(base64);
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
      name: documentName,
      currentPage: page,
      totalPages: count,
    }).catch((error) => {
      console.error('Erro ao salvar página:', error);
    });
  }

  // B - Solicita um novo nível de zoom ao renderizador do PDF.
  function zoomBy(factor: number) {
    const script =
      '(function(){ if (window.lunaZoomBy) { window.lunaZoomBy(' +
      factor +
      '); } return true; })();';

    webViewRef.current?.injectJavaScript(script);
  }

  function openNewNoteModal() {
    setEditingNote(null);
    setNoteModalVisible(true);
  }

  async function handleSaveNote(payload: {
    content: string;
    selectedText?: string;
  }) {
    if (!uri) return;

    if (editingNote) {
      await updateNote(editingNote.id, payload);
    } else {
      await createNote({
        documentUri: uri,
        documentName,
        page: currentPageRef.current,
        selectedText: payload.selectedText,
        content: payload.content,
      });
      setSelectedText('');
      triggerSavedToast();
    }

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

    if (message.tipo === 'TEXT_SELECTED') {
      setSelectedText((message.selectedText || '').trim());
      return;
    }

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

      savePage(page, totalPagesRef.current);
    }
  }

  // B - PDF.js com renderização em alta resolução, camada de texto selecionável e zoom sob demanda
  const html = useMemo(() => {
    if (!pdfBase64) return '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        >

        <style>
          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #e8e8e8;
          }

          body {
            padding: 12px;
            touch-action: pan-x pan-y;
            -webkit-text-size-adjust: 100%;
          }

          #pages {
            width: 100%;
          }

          .page {
            display: block;
            position: relative;
            margin: 0 auto 15px;
            background: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            overflow: hidden;
          }

          .page canvas {
            display: block;
            width: 100%;
            height: 100%;
          }

          .textLayer {
            position: absolute;
            left: 0;
            top: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
            line-height: 1;
            color: transparent;
            user-select: text;
            -webkit-user-select: text;
          }

          .textLayer > span {
            color: transparent;
            position: absolute;
            white-space: pre;
            cursor: text;
            transform-origin: 0% 0%;
          }

          .textLayer ::selection {
            background: rgba(92, 116, 224, 0.35);
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
        <div id="pages"></div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

        <script>
          const initialPage = ${JSON.stringify(initialPage)};
          let base64 = ${JSON.stringify(pdfBase64)};

          let pdf = null;
          let pageCount = 0;
          let baseWidth = 1;
          let baseHeight = 1;

          let zoom = 1;

          const MIN_ZOOM = 0.6;
          const MAX_ZOOM = 4;

          const MAX_DPR = 2;
          const MAX_CANVAS_WIDTH = 2560;
          const MAX_CANVAS_PIXELS = 12000000;

          const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
          const BUFFER = Math.max(
            600,
            Math.round((window.innerHeight || 800) * 0.8)
          );

          const wrappers = [];
          const textLayers = [];
          const metrics = {};
          const renderInfo = {};
          const jobs = {};

          let generation = 0;
          let destroyed = false;
          let readerReady = false;
          let framePending = false;
          let lastReportedPage = initialPage;
          let suppressReportUntil = 0;
          let zoomTimer = null;
          let pinching = false;
          let pinch = null;
          let lastEvict = 0;
          let lastSelectedText = '';

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

          function notifySelection() {
            const sel = window.getSelection ? window.getSelection() : null;
            const txt = sel ? sel.toString().replace(/\\s+/g, ' ').trim() : '';
            if (txt !== lastSelectedText) {
              lastSelectedText = txt;
              sendMessage('TEXT_SELECTED', { selectedText: txt });
            }
          }

          document.addEventListener('selectionchange', function () {
            setTimeout(notifySelection, 60);
          });

          document.addEventListener('touchend', function () {
            setTimeout(notifySelection, 120);
          });

          function clampZoom(value) {
            return Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, value)
            );
          }

          function availableWidth() {
            return Math.max(
              160,
              document.documentElement.clientWidth - 24
            );
          }

          function fitScale() {
            return availableWidth() / baseWidth;
          }

          function currentKey() {
            const s = fitScale() * zoom;
            return generation + '|' +
              zoom.toFixed(3) + '|' +
              dpr.toFixed(2) + '|' + s.toFixed(4);
          }

          function outputScale(metric) {
            const size = metric || {
              width: baseWidth,
              height: baseHeight
            };
            const s = fitScale() * zoom;
            const w = Math.max(1, size.width * s);
            const h = Math.max(1, size.height * s);

            let output = dpr;
            output = Math.min(output, MAX_CANVAS_WIDTH / w);
            output = Math.min(
              output,
              Math.sqrt(MAX_CANVAS_PIXELS / (w * h))
            );

            return Math.max(1, Math.min(dpr, output));
          }

          function applySize(n) {
            const element = wrappers[n - 1];

            if (!element) return;

            const metric = metrics[n] || {
              width: baseWidth,
              height: baseHeight
            };

            const scale = fitScale() * zoom;

            element.style.width =
              Math.round(metric.width * scale) + 'px';
            element.style.height =
              Math.round(metric.height * scale) + 'px';
          }

          function applyLayout() {
            for (let n = 1; n <= pageCount; n++) {
              applySize(n);
            }
          }

          function pageTop(n) {
            const element = wrappers[n - 1];
            return element ? element.offsetTop : 0;
          }

          function pageAtY(y) {
            let low = 1;
            let high = pageCount;
            let answer = 1;

            while (low <= high) {
              const middle = (low + high) >> 1;

              if (pageTop(middle) <= y) {
                answer = middle;
                low = middle + 1;
              } else {
                high = middle - 1;
              }
            }

            return answer;
          }

          function captureAnchor(clientY, clientX) {
            const offsetY = typeof clientY === 'number'
              ? clientY
              : 100;

            const documentY = window.scrollY + offsetY;
            const page = pageAtY(documentY);
            const element = wrappers[page - 1];
            const height = Math.max(
              1,
              element ? element.offsetHeight : 1
            );

            const anchor = {
              page: page,
              fraction: Math.max(
                0,
                Math.min(
                  1,
                  (documentY - pageTop(page)) / height
                )
              ),
              offsetY: offsetY
            };

            if (typeof clientX === 'number') {
              anchor.documentX = window.scrollX + clientX;
              anchor.clientX = clientX;
            }

            return anchor;
          }

          function restoreAnchor(anchor) {
            if (!anchor || !wrappers[anchor.page - 1]) {
              return;
            }

            const height = Math.max(
              1,
              wrappers[anchor.page - 1].offsetHeight
            );

            const y =
              pageTop(anchor.page) +
              anchor.fraction * height -
              anchor.offsetY;

            const x = typeof anchor.documentX === 'number'
              ? Math.max(0, anchor.documentX - anchor.clientX)
              : window.scrollX;

            window.scrollTo(
              Math.max(0, Math.round(x)),
              Math.max(0, Math.round(y))
            );
          }

          function getVisiblePage() {
            if (pageCount < 1) return 1;

            return pageAtY(window.scrollY + 100);
          }

          function reportCurrentPage() {
            if (!readerReady) return;
            if (performance.now() < suppressReportUntil) return;

            const page = getVisiblePage();

            if (page !== lastReportedPage) {
              lastReportedPage = page;

              sendMessage('PAGE_CHANGED', {
                page: page
              });
            }
          }

          function isCancelled(error) {
            return !!error && (
              error.name === 'RenderingCancelledException' ||
              (!!error.message &&
                error.message.indexOf(
                  'RenderingCancelled'
                ) >= 0)
            );
          }

          function cancelAllTasks() {
            Object.keys(renderInfo).forEach(function (key) {
              const info = renderInfo[key];

              if (info && info.task) {
                try {
                  info.task.cancel();
                } catch (error) {}

                info.task = null;
              }
            });
          }

          async function getMetrics(n) {
            if (metrics[n]) return metrics[n];

            const page = await pdf.getPage(n);
            const viewport = page.getViewport({ scale: 1 });

            metrics[n] = {
              width: viewport.width || 1,
              height: viewport.height || 1
            };

            return metrics[n];
          }

          async function renderTextOverlay(page, viewport, n) {
            const textLayer = textLayers[n - 1];
            if (!textLayer || typeof pdfjsLib.renderTextLayer !== 'function') {
              return;
            }

            textLayer.innerHTML = '';
            textLayer.style.width = Math.round(viewport.width) + 'px';
            textLayer.style.height = Math.round(viewport.height) + 'px';
            textLayer.style.setProperty('--scale-factor', String(viewport.scale));

            try {
              const textContent = await page.getTextContent();
              const renderTask = pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: []
              });
              if (renderTask && renderTask.promise) {
                await renderTask.promise;
              }
            } catch (err) {
              if (!isCancelled(err)) {
                console.warn('TextLayer pág ' + n + ':', err);
              }
            }
          }

          async function renderOne(n, renderGeneration, key) {
            if (destroyed || renderGeneration !== generation) {
              return;
            }

            const metric = await getMetrics(n);

            if (destroyed || renderGeneration !== generation) {
              return;
            }

            const info = renderInfo[n];

            if (!info || info.key !== key) {
              return;
            }

            const page = await pdf.getPage(n);

            if (
              destroyed ||
              renderGeneration !== generation ||
              renderInfo[n] !== info
            ) {
              return;
            }

            const scale = fitScale() * zoom;
            const viewport = page.getViewport({ scale: scale });
            const pixelRatio = outputScale(metric);
            const canvas = info.canvas;
            const context = canvas.getContext('2d');

            if (!context) return;

            canvas.style.width =
              Math.round(viewport.width) + 'px';
            canvas.style.height =
              Math.round(viewport.height) + 'px';

            canvas.width = Math.max(
              1,
              Math.floor(viewport.width * pixelRatio)
            );
            canvas.height = Math.max(
              1,
              Math.floor(viewport.height * pixelRatio)
            );

            applySize(n);

            const task = page.render({
              canvasContext: context,
              viewport: viewport,
              transform: pixelRatio !== 1
                ? [pixelRatio, 0, 0, pixelRatio, 0, 0]
                : null
            });

            info.task = task;

            try {
              await task.promise;

              if (
                renderGeneration === generation &&
                renderInfo[n] === info
              ) {
                info.done = true;
                await renderTextOverlay(page, viewport, n);
              }
            } catch (error) {
              if (!isCancelled(error)) {
                console.warn(
                  'Erro ao renderizar página ' + n,
                  error
                );
              }
            } finally {
              if (info.task === task) {
                info.task = null;
              }
            }
          }

          function requestRender(n) {
            if (destroyed || pinching || pinch) return;
            if (n < 1 || n > pageCount) return;

            const key = currentKey();
            const existing = jobs[n];

            if (existing && existing.key === key) {
              return;
            }

            const renderGeneration = generation;
            const previous = renderInfo[n];

            if (previous && previous.task) {
              try {
                previous.task.cancel();
              } catch (error) {}

              previous.task = null;
            }

            let canvas = previous ? previous.canvas : null;

            if (!canvas) {
              canvas = document.createElement('canvas');
              wrappers[n - 1].insertBefore(canvas, textLayers[n - 1] || null);
            }

            const info = {
              key: key,
              task: null,
              canvas: canvas,
              done: false
            };

            renderInfo[n] = info;

            const waitForPrevious = existing
              ? existing.promise.catch(function () {})
              : Promise.resolve();

            const promise = waitForPrevious.then(function () {
              return renderOne(n, renderGeneration, key);
            });

            jobs[n] = {
              key: key,
              promise: promise,
              generation: renderGeneration
            };

            promise.catch(function (error) {
              console.warn('Fila de renderização:', error);
            });
          }

          function firstPageFrom(documentY) {
            let low = 1;
            let high = pageCount;
            let answer = pageCount;

            while (low <= high) {
              const middle = (low + high) >> 1;
              const bottom =
                pageTop(middle) +
                wrappers[middle - 1].offsetHeight;

              if (bottom >= documentY) {
                answer = middle;
                high = middle - 1;
              } else {
                low = middle + 1;
              }
            }

            return answer;
          }

          function evictFarPages() {
            const top = window.scrollY - BUFFER * 3;
            const bottom =
              window.scrollY +
              window.innerHeight +
              BUFFER * 3;

            Object.keys(renderInfo).forEach(function (key) {
              const n = Number(key);
              const element = wrappers[n - 1];
              const info = renderInfo[n];

              if (!element || !info) return;

              const pageBeginning = pageTop(n);
              const pageEnd =
                pageBeginning + element.offsetHeight;

              if (pageEnd < top || pageBeginning > bottom) {
                if (info.task) {
                  try {
                    info.task.cancel();
                  } catch (error) {}
                }

                if (
                  info.canvas &&
                  info.canvas.parentNode
                ) {
                  info.canvas.parentNode.removeChild(
                    info.canvas
                  );
                }

                if (textLayers[n - 1]) {
                  textLayers[n - 1].innerHTML = '';
                }

                delete renderInfo[n];
                delete jobs[n];
              }
            });
          }

          function scheduleVisible() {
            if (destroyed || pinching || !readerReady) {
              return;
            }

            const top = window.scrollY - BUFFER;
            const bottom =
              window.scrollY +
              window.innerHeight +
              BUFFER;

            for (
              let n = firstPageFrom(top);
              n <= pageCount;
              n++
            ) {
              if (pageTop(n) > bottom) break;

              requestRender(n);
            }

            const now = performance.now();

            if (now - lastEvict > 600) {
              lastEvict = now;
              evictFarPages();
            }
          }

          function handleScroll() {
            if (!readerReady || framePending || pinching) {
              return;
            }

            framePending = true;

            requestAnimationFrame(function () {
              framePending = false;
              reportCurrentPage();
              scheduleVisible();
            });
          }

          function commitZoom() {
            generation++;
            cancelAllTasks();

            if (zoomTimer) {
              clearTimeout(zoomTimer);
              zoomTimer = null;
            }

            zoomTimer = setTimeout(function () {
              zoomTimer = null;
              scheduleVisible();
            }, 120);
          }

          function applyZoom(nextZoom, anchor, deferred) {
            const next = clampZoom(nextZoom);

            if (Math.abs(next - zoom) < 0.004) {
              return;
            }

            const targetAnchor = anchor || captureAnchor();

            lastReportedPage = targetAnchor.page;
            suppressReportUntil =
              performance.now() + 600;

            zoom = next;
            applyLayout();
            restoreAnchor(targetAnchor);

            if (deferred) {
              if (zoomTimer) clearTimeout(zoomTimer);

              zoomTimer = setTimeout(function () {
                zoomTimer = null;
                commitZoom();
              }, 140);
            } else {
              commitZoom();
            }
          }

          window.lunaZoomBy = function (factor) {
            if (!readerReady) return;

            applyZoom(
              zoom * factor,
              captureAnchor(),
              false
            );
          };

          function distanceBetween(touchA, touchB) {
            const dx = touchA.clientX - touchB.clientX;
            const dy = touchA.clientY - touchB.clientY;

            return Math.sqrt(dx * dx + dy * dy) || 1;
          }

          function beginPinch() {
            pinching = true;
            generation++;
            cancelAllTasks();

            if (zoomTimer) {
              clearTimeout(zoomTimer);
              zoomTimer = null;
            }
          }

          function endPinch(event) {
            if (!pinching) return;
            if (event.touches && event.touches.length >= 2) {
              return;
            }

            pinching = false;
            pinch = null;
            commitZoom();
          }

          document.addEventListener(
            'touchstart',
            function (event) {
              if (
                !readerReady ||
                pinching ||
                event.touches.length < 2
              ) {
                return;
              }

              event.preventDefault();

              const touchA = event.touches[0];
              const touchB = event.touches[1];

              const middleX =
                (touchA.clientX + touchB.clientX) / 2;
              const middleY =
                (touchA.clientY + touchB.clientY) / 2;

              beginPinch();

              pinch = {
                startDistance: distanceBetween(
                  touchA,
                  touchB
                ),
                startZoom: zoom,
                anchor: captureAnchor(middleY, middleX)
              };
            },
            { passive: false }
          );

          document.addEventListener(
            'touchmove',
            function (event) {
              if (
                !pinching ||
                !pinch ||
                event.touches.length < 2
              ) {
                return;
              }

              event.preventDefault();

              const distance = distanceBetween(
                event.touches[0],
                event.touches[1]
              );

              const next = clampZoom(
                pinch.startZoom *
                distance /
                pinch.startDistance
              );

              if (Math.abs(next - zoom) < 0.004) {
                return;
              }

              zoom = next;
              applyLayout();
              restoreAnchor(pinch.anchor);

              lastReportedPage = pinch.anchor.page;
              suppressReportUntil =
                performance.now() + 600;

              if (zoomTimer) clearTimeout(zoomTimer);

              zoomTimer = setTimeout(function () {
                zoomTimer = null;
                commitZoom();
              }, 140);
            },
            { passive: false }
          );

          document.addEventListener(
            'touchend',
            endPinch,
            { passive: false }
          );

          document.addEventListener(
            'touchcancel',
            endPinch,
            { passive: false }
          );

          document.addEventListener(
            'gesturestart',
            function (event) {
              event.preventDefault();
            },
            { passive: false }
          );

          document.addEventListener(
            'gesturechange',
            function (event) {
              event.preventDefault();
            },
            { passive: false }
          );

          window.addEventListener('resize', function () {
            if (destroyed || !readerReady) return;

            const anchor = captureAnchor();

            generation++;
            cancelAllTasks();
            applyLayout();
            restoreAnchor(anchor);
            scheduleVisible();
          });

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
              base64 = '';

              const bytes = new Uint8Array(binary.length);

              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }

              pdf = await pdfjsLib.getDocument({
                data: bytes
              }).promise;

              pageCount = pdf.numPages;

              const firstPage = await pdf.getPage(1);
              const firstViewport =
                firstPage.getViewport({ scale: 1 });

              baseWidth = firstViewport.width || 1;
              baseHeight = firstViewport.height || 1;

              metrics[1] = {
                width: baseWidth,
                height: baseHeight
              };

              sendMessage('PDF_INFO', {
                totalPages: pageCount
              });

              loadingElement.remove();

              const fragment =
                document.createDocumentFragment();

              for (let n = 1; n <= pageCount; n++) {
                const wrapper =
                  document.createElement('div');

                wrapper.className = 'page';
                wrapper.setAttribute(
                  'data-page',
                  String(n)
                );

                const textLayer = document.createElement('div');
                textLayer.className = 'textLayer';
                wrapper.appendChild(textLayer);

                wrappers.push(wrapper);
                textLayers.push(textLayer);
                fragment.appendChild(wrapper);
              }

              document
                .getElementById('pages')
                .appendChild(fragment);

              applyLayout();

              const targetPage = Math.min(
                pageCount,
                Math.max(1, initialPage)
              );

              requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                  window.scrollTo(
                    0,
                    Math.max(0, pageTop(targetPage))
                  );

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

                  scheduleVisible();
                });
              });

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
            {documentName}
          </Text>

          {totalPages > 0 && (
            <Text style={styles.pageLabel}>
              Página {currentPage} de {totalPages}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.noteButton}
          onPress={openNewNoteModal}
        >
          <Text style={styles.noteButtonText}>
            {selectedText ? '+ Nota (trecho)' : '+ Nota'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.listButton}
          onPress={() => setNotesDrawerVisible(true)}
        >
          <Text style={styles.listButtonText}>
            Notas ({notes.length})
          </Text>
        </TouchableOpacity>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            accessibilityLabel="Diminuir zoom"
            style={styles.zoomButton}
            onPress={() => zoomBy(1 / 1.25)}
          >
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Aumentar zoom"
            style={styles.zoomButton}
            onPress={() => zoomBy(1.25)}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
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
          ref={webViewRef}
          originWhitelist={['*']}
          source={webSource}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          textZoom={100}
          scalesPageToFit={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
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

      {/* Aviso inferior semelhante ao "Citação salva" do vídeo */}
      {showSavedToast && (
        <View
          style={[
            styles.toastContainer,
            { bottom: Math.max(20, insets.bottom + 12) },
          ]}
        >
          <Text style={styles.toastText}>Citação salva</Text>
        </View>
      )}

      {/* Modal de criação e edição de nota */}
      <NoteFormModal
        visible={noteModalVisible}
        initialSelectedText={selectedText || undefined}
        editingNote={editingNote}
        onClose={() => {
          setNoteModalVisible(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
      />

      {/* Modal de lista de notas do documento */}
      <Modal
        visible={notesDrawerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotesDrawerVisible(false)}
      >
        <View style={styles.drawerBackdrop}>
          <View
            style={[
              styles.drawerCard,
              { paddingBottom: Math.max(20, insets.bottom + 12) },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>
                Notas do documento ({notes.length})
              </Text>
              <TouchableOpacity
                onPress={() => setNotesDrawerVisible(false)}
              >
                <Text style={styles.drawerClose}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <NotesList
                notes={notes}
                emptyMessage="Nenhuma nota adicionada neste PDF ainda. Selecione um trecho e toque em '+ Nota'."
                onEdit={(note) => {
                  setNotesDrawerVisible(false);
                  setEditingNote(note);
                  setNoteModalVisible(true);
                }}
                onDelete={handleRequestDeleteNote}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },

  headerInfo: {
    flex: 1,
  },

  backButton: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },

  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  pageLabel: {
    fontSize: 11,
    marginTop: 2,
    color: COLORS.textSecondary,
  },

  noteButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },

  noteButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },

  listButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },

  listButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  zoomControls: {
    flexDirection: 'row',
    gap: 4,
  },

  zoomButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  zoomButtonText: {
    fontSize: 18,
    lineHeight: 20,
    color: COLORS.primary,
    fontWeight: '600',
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
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },

  retryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },

  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
  },

  toastText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  drawerCard: {
    maxHeight: '78%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },

  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  drawerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  drawerClose: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
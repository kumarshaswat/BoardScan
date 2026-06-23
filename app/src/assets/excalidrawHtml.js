/**
 * Self-contained HTML page that loads the Excalidraw editor via CDN.
 * Loaded in a React Native WebView using `source={{ html: EXCALIDRAW_HTML }}`.
 *
 * Communication protocol (React Native ↔ WebView):
 *
 *   RN → WebView  (via injectJavaScript):
 *     window.loadScene(sceneObject)   — load elements + appState
 *     window.getScene()               — triggers SCENE_DATA message back to RN
 *
 *   WebView → RN  (via window.ReactNativeWebView.postMessage):
 *     { type: 'READY' }               — Excalidraw API is initialized
 *     { type: 'SCENE_DATA', elements, appState, files }
 *     { type: 'ERROR', message }
 */

export const EXCALIDRAW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: https: http:;"
  />
  <title>Whiteboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { background: #ffffff; }
    #loading {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #ffffff;
      font-family: -apple-system, sans-serif;
      color: #666; gap: 12px; z-index: 9999;
    }
    #loading-spinner {
      width: 40px; height: 40px;
      border: 3px solid #eee;
      border-top-color: #7C6FF7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading p { font-size: 14px; margin: 0; }
    #loading small { font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div id="loading">
    <div id="loading-spinner"></div>
    <p>Loading editor…</p>
    <small>Fetching Excalidraw from CDN</small>
  </div>
  <div id="root"></div>

  <!-- React + Excalidraw from CDN -->
  <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@excalidraw/excalidraw@0.17.3/dist/excalidraw.production.min.js" crossorigin="anonymous"></script>

  <script>
    // ── RN bridge helpers ───────────────────────────────────────────────────
    function postToRN(data) {
      console.log('[WebView] postToRN:', JSON.stringify(data).slice(0, 100));
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      } else {
        console.log('[WebView] ReactNativeWebView not available yet');
      }
    }

    // Check if scripts loaded
    window.addEventListener('load', function() {
      console.log('[WebView] page loaded');
      console.log('[WebView] React available:', typeof React !== 'undefined');
      console.log('[WebView] ReactDOM available:', typeof ReactDOM !== 'undefined');
      console.log('[WebView] ExcalidrawLib available:', typeof ExcalidrawLib !== 'undefined');
    });

    // ── Excalidraw API ref ──────────────────────────────────────────────────
    var excalidrawAPI = null;

    // ── RN-callable globals ─────────────────────────────────────────────────

    /**
     * Called from RN: window.loadScene(sceneJSON)
     * Replaces the canvas content with the provided scene.
     */
    window.loadScene = function (scene) {
      if (!excalidrawAPI) {
        postToRN({ type: 'ERROR', message: 'Excalidraw API not ready yet.' });
        return;
      }
      try {
        excalidrawAPI.updateScene({
          elements: scene.elements || [],
          appState: Object.assign(
            { viewBackgroundColor: '#ffffff' },
            scene.appState || {},
            { collaborators: [] }
          ),
        });

        // Load any embedded image files
        if (scene.files) {
          var fileValues = Object.values(scene.files);
          if (fileValues.length > 0) {
            try { excalidrawAPI.addFiles(fileValues); } catch (_) {}
          }
        }

        // Fit the scene to the viewport after a short render delay
        setTimeout(function () {
          try {
            excalidrawAPI.scrollToContent(
              excalidrawAPI.getSceneElements(),
              { fitToViewport: true, viewportZoomFactor: 0.9 }
            );
          } catch (_) {}
        }, 250);

      } catch (e) {
        postToRN({ type: 'ERROR', message: e.message });
      }
    };

    /**
     * Called from RN: window.getScene()
     * Posts SCENE_DATA back to RN with current canvas state.
     */
    window.getScene = function () {
      if (!excalidrawAPI) {
        postToRN({ type: 'ERROR', message: 'Excalidraw API not ready.' });
        return;
      }
      try {
        var elements = excalidrawAPI.getSceneElements();
        var state    = excalidrawAPI.getAppState();
        var files    = excalidrawAPI.getFiles();
        postToRN({
          type: 'SCENE_DATA',
          elements: elements,
          appState: {
            viewBackgroundColor: state.viewBackgroundColor || '#ffffff',
            gridSize: state.gridSize || null,
          },
          files: files || {},
        });
      } catch (e) {
        postToRN({ type: 'ERROR', message: e.message });
      }
    };

    // ── App component ───────────────────────────────────────────────────────
    function App() {
      var apiCallback = React.useCallback(function (api) {
        excalidrawAPI = api;
        document.getElementById('loading').style.display = 'none';
        postToRN({ type: 'READY' });
      }, []);

      return React.createElement(ExcalidrawLib.Excalidraw, {
        excalidrawAPI: apiCallback,
        initialData: {
          appState: { viewBackgroundColor: '#ffffff' },
          scrollToContent: true,
        },
        UIOptions: {
          canvasActions: {
            export: false,
            loadScene: false,
            saveAsImage: true,
          },
        },
      });
    }

    // ── Mount ───────────────────────────────────────────────────────────────
    ReactDOM.render(React.createElement(App), document.getElementById('root'));
  </script>
</body>
</html>`;

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";

import { EXCALIDRAW_HTML } from "../assets/excalidrawHtml";
import { saveExcalidrawScene } from "../utils/storage";

const C = {
  bg: "#080810",
  header: "#0C0C18",
  accent: "#5BC8F5",
  text: "#FFFFFF",
  textSec: "#7A8AA8",
  border: "#1A1A30",
};

export default function ViewerScreen({ route, navigation }) {
  const { whiteboard } = route.params; // { id, name, scene }
  const webViewRef = useRef(null);
  const sceneInjected = useRef(false);

  const [editorReady, setEditorReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // webview -> rn messages
  const onMessage = useCallback(
    (event) => {
      let data;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      switch (data.type) {
        case "READY": {
          setEditorReady(true);
          // Inject the scene exactly once
          if (!sceneInjected.current) {
            sceneInjected.current = true;
            const sceneJson = JSON.stringify(whiteboard.scene)
              .replace(/\\/g, "\\\\")
              .replace(/`/g, "\\`");
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(
                `window.loadScene(JSON.parse(\`${sceneJson}\`)); true;`,
              );
            }, 80);
          }
          break;
        }

        case "SCENE_DATA": {
          saveExcalidrawScene(whiteboard.id, {
            elements: data.elements,
            appState: data.appState,
            files: data.files,
          })
            .then(() => {
              setIsSaving(false);
              Alert.alert("Saved", "Your whiteboard has been updated.");
            })
            .catch(() => {
              setIsSaving(false);
              Alert.alert("Error", "Could not save the whiteboard.");
            });
          break;
        }

        case "ERROR": {
          console.warn("[Excalidraw]", data.message);
          break;
        }
      }
    },
    [whiteboard],
  );

  // save current scene
  const handleSave = useCallback(() => {
    if (!editorReady || isSaving) return;
    setIsSaving(true);
    webViewRef.current?.injectJavaScript(`window.getScene(); true;`);
  }, [editorReady, isSaving]);

  // back
  const handleBack = () => navigation.goBack();

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={s.headerSide}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.headerTitle} numberOfLines={1}>
          {whiteboard.name}
        </Text>

        <View style={s.headerSide}>
          <TouchableOpacity
            onPress={handleSave}
            style={[s.saveBtn, (!editorReady || isSaving) && s.saveBtnOff]}
            disabled={!editorReady || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* editor */}
      <View style={s.editorWrap}>
        <WebView
          ref={webViewRef}
          source={{ html: EXCALIDRAW_HTML, baseUrl: "https://unpkg.com" }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          originWhitelist={["*"]}
          style={s.webview}
          onError={(e) => console.warn("WebView error:", e.nativeEvent)}
          renderError={() => (
            <View style={s.errorView}>
              <Text style={s.errorText}>
                Failed to load the editor.{"\n"}
                Make sure you have an internet connection (needed to load
                Excalidraw from CDN).
              </Text>
            </View>
          )}
        />

        {/* loading overlay until ready */}
        {!editorReady && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={s.loadingTitle}>Loading Editor</Text>
            <Text style={s.loadingBody}>
              Fetching Excalidraw from CDN…{"\n"}this only takes a moment.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.header,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerSide: { minWidth: 80, alignItems: "flex-start" },
  backText: { color: C.accent, fontSize: 15, fontWeight: "500" },
  headerTitle: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 6,
  },
  saveBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 72,
    alignItems: "center",
    alignSelf: "flex-end",
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Editor
  editorWrap: { flex: 1, position: "relative" },
  webview: { flex: 1 },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#080810",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 12,
  },
  loadingBody: {
    color: "#7A8AA8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  // Error fallback
  errorView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#080810",
  },
  errorText: {
    color: "#7A8AA8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
});

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";

import {
  loadWhiteboards,
  saveWhiteboard,
  deleteWhiteboard,
  loadScene,
  renameWhiteboard,
} from "../utils/storage";
import { processImage } from "../utils/api";

// constants

const { width } = Dimensions.get("window");
const CARD_W = (width - 52) / 2;
const CARD_H = CARD_W * 0.72;

const C = {
  bg: "#080810",
  card: "#0F0F1C",
  accent: "#5BC8F5",
  accentDim: "rgba(91,200,245,0.13)",
  text: "#FFFFFF",
  textSec: "#7A8AA8",
  border: "#1A1A30",
  error: "#FF6B6B",
  errorDim: "rgba(255,107,107,0.15)",
};

// blob background

const blobSvg = `<svg viewBox="0 0 390 844" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blur1" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
    <filter id="blur2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <filter id="blur3" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="blur4" x="-80%" y="-80%" width="360%" height="360%">
      <feGaussianBlur stdDeviation="55"/>
    </filter>
    <radialGradient id="g1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0D3A4A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#080810" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0A2E3D" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#080810" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#071E2A" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#080810" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="390" height="844" fill="#080810"/>
  <ellipse cx="15%" cy="8%" rx="260" ry="220" fill="url(#g1)" filter="url(#blur1)"/>
  <ellipse cx="85%" cy="12%" rx="240" ry="200" fill="url(#g2)" filter="url(#blur2)"/>
  <ellipse cx="50%" cy="5%" rx="200" ry="180" fill="url(#g3)" filter="url(#blur3)"/>
  <ellipse cx="-5%" cy="105%" rx="280" ry="380" fill="#0D3A4A" fill-opacity="0.35" filter="url(#blur4)"/>
</svg>`;

function BlobBackground() {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <SvgXml
        xml={blobSvg}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      />
    </View>
  );
}

function generateId() {
  return `wb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// processing modal

function ProcessingModal({ visible, status, error, onCancel, onRetry }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const anim = useRef(null);

  useEffect(() => {
    if (visible && !error) {
      anim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.25,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 850,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      pulse.setValue(1);
    }
    return () => anim.current?.stop();
  }, [visible, error]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={pm.overlay}>
        <View style={pm.card}>
          {error ? (
            <>
              <Text style={pm.errorEmoji}>⚠️</Text>
              <Text style={pm.errorTitle}>Processing Failed</Text>
              <Text style={pm.errorMsg}>{error}</Text>
              <TouchableOpacity style={pm.primaryBtn} onPress={onRetry}>
                <Text style={pm.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={pm.ghostBtn} onPress={onCancel}>
                <Text style={pm.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Animated.View
                style={[pm.ring, { transform: [{ scale: pulse }] }]}
              >
                <View style={pm.innerRing}>
                  <ActivityIndicator size="large" color={C.accent} />
                </View>
              </Animated.View>
              <Text style={pm.processingTitle}>Processing Whiteboard</Text>
              <Text style={pm.statusText}>{status}</Text>
              <TouchableOpacity style={pm.ghostBtn} onPress={onCancel}>
                <Text style={pm.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 32,
    width: "82%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  ring: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  innerRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(124,111,247,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  processingTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  statusText: {
    color: C.textSec,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    minHeight: 40,
  },
  errorEmoji: { fontSize: 48, marginBottom: 16 },
  errorTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorMsg: {
    color: C.textSec,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  ghostBtnText: { color: C.textSec, fontSize: 14 },
});

// rename modal

function RenameModal({ visible, currentName, onSave, onCancel }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (visible) setName(currentName ?? "");
  }, [visible, currentName]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={rm.overlay}
          activeOpacity={1}
          onPress={onCancel}
        >
          {/* stop press propagation */}
          <TouchableOpacity activeOpacity={1} style={rm.dialog}>
            <Text style={rm.title}>Rename Whiteboard</Text>
            <TextInput
              style={rm.input}
              value={name}
              onChangeText={setName}
              placeholder="Whiteboard name"
              placeholderTextColor={C.textSec}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={handleSave}
              returnKeyType="done"
            />
            <View style={rm.row}>
              <TouchableOpacity style={rm.cancelBtn} onPress={onCancel}>
                <Text style={rm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rm.saveBtn} onPress={handleSave}>
                <Text style={rm.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 24,
    width: "85%",
    borderWidth: 1,
    borderColor: C.border,
  },
  title: { color: C.text, fontSize: 17, fontWeight: "700", marginBottom: 16 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelText: { color: C.textSec, fontWeight: "600", fontSize: 14 },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.accent,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

// whiteboard card

function WhiteboardCard({ board, onPress, onLongPress }) {
  return (
    <TouchableOpacity
      style={wc.container}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.8}
    >
      {board.thumbPath ? (
        <Image
          source={{ uri: board.thumbPath }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={wc.placeholder}>
          <Text style={wc.placeholderIcon}>🗒️</Text>
        </View>
      )}
      {/* gradient overlay */}
      <View style={wc.dimOverlay} />
      <View style={wc.infoRow}>
        <Text style={wc.name} numberOfLines={1}>
          {board.name}
        </Text>
        <Text style={wc.date}>{formatDate(board.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const wc = StyleSheet.create({
  container: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: C.card,
    margin: 6,
    borderWidth: 1,
    borderColor: "rgba(91,200,245,0.1)",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
  },
  placeholderIcon: { fontSize: 36 },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  infoRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  name: { color: "#fff", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  date: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
});

// empty state

function EmptyState() {
  return (
    <View style={es.container}>
      <Text style={es.icon}>🖊️</Text>
      <Text style={es.title}>No Whiteboards Yet</Text>
      <Text style={es.subtitle}>
        Tap the <Text style={{ color: C.accent, fontWeight: "700" }}>+</Text>{" "}
        button to photograph or import a whiteboard — it'll be converted into a
        fully editable vector file.
      </Text>
    </View>
  );
}

const es = StyleSheet.create({
  container: { alignItems: "center", paddingTop: 72, paddingHorizontal: 44 },
  icon: { fontSize: 72, marginBottom: 24 },
  title: { color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  subtitle: {
    color: C.textSec,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
});

// home screen

export default function HomeScreen({ navigation }) {
  const [boards, setBoards] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [procStatus, setProcStatus] = useState("");
  const [procError, setProcError] = useState(null);
  const [pendingUri, setPendingUri] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null); // { id, name }
  const aborted = useRef(false);
  const fabScale = useRef(new Animated.Value(1)).current;

  // reload on screen focus
  useEffect(() => {
    const unsub = navigation.addListener("focus", fetchBoards);
    fetchBoards();
    return unsub;
  }, [navigation]);

  const fetchBoards = async () => {
    const data = await loadWhiteboards();
    setBoards(data);
  };

  // fab animation
  const onFabPressIn = () =>
    Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true }).start();
  const onFabPressOut = () =>
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }).start();

  // image picker
  const showAddOptions = () => {
    Alert.alert("Add Whiteboard", "How would you like to add a whiteboard?", [
      { text: "📷  Take Photo", onPress: openCamera },
      { text: "🖼️  Choose from Library", onPress: openLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openCamera = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Permission Needed",
        "Camera access is required to photograph whiteboards.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.92,
    });
    if (!result.canceled) startProcessing(result.assets[0].uri);
  };

  const openLibrary = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Permission Needed",
        "Photo library access is required to import images.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.92,
    });
    if (!result.canceled) startProcessing(result.assets[0].uri);
  };

  // processing pipeline
  const startProcessing = async (imageUri) => {
    aborted.current = false;
    setPendingUri(imageUri);
    setProcError(null);
    setProcStatus("Starting...");
    setProcessing(true);

    try {
      const scene = await processImage(imageUri, (msg) => {
        if (!aborted.current) setProcStatus(msg);
      });

      if (aborted.current) return;

      setProcStatus("Saving to your library...");

      const id = generateId();
      const date = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const name = `Whiteboard ${date}`;

      await saveWhiteboard({ id, name, imagePath: imageUri, scene });

      setProcessing(false);
      await fetchBoards();

      // auto-open new whiteboard
      navigation.navigate("Viewer", {
        whiteboard: { id, name, scene },
      });
    } catch (err) {
      if (!aborted.current) {
        setProcError(err.message ?? "Something went wrong.");
      }
    }
  };

  const cancelProcessing = () => {
    aborted.current = true;
    setProcessing(false);
    setProcError(null);
  };

  const retryProcessing = () => {
    if (pendingUri) {
      setProcError(null);
      startProcessing(pendingUri);
    }
  };

  // card interactions
  const openBoard = async (board) => {
    const scene = await loadScene(board.scenePath);
    navigation.navigate("Viewer", {
      whiteboard: { id: board.id, name: board.name, scene },
    });
  };

  const longPressBoard = (board) => {
    Alert.alert(board.name, undefined, [
      {
        text: "✏️  Rename",
        onPress: () => setRenameTarget({ id: board.id, name: board.name }),
      },
      {
        text: "🗑️  Delete",
        style: "destructive",
        onPress: () => confirmDelete(board),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmDelete = (board) => {
    Alert.alert(
      "Delete Whiteboard",
      `Delete "${board.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteWhiteboard(board.id);
            fetchBoards();
          },
        },
      ],
    );
  };

  const handleRename = async (newName) => {
    if (renameTarget) {
      await renameWhiteboard(renameTarget.id, newName);
      setRenameTarget(null);
      fetchBoards();
    }
  };

  // render
  return (
    <SafeAreaView style={hs.container}>
      <BlobBackground />
      {/* header */}
      <View style={hs.header}>
        <View>
          <Text style={hs.appName}>
            Board<Text style={{ color: C.accent }}>Scan</Text>
          </Text>
          <Text style={hs.meta}>
            {boards.length === 0
              ? "No whiteboards"
              : `${boards.length} whiteboard${boards.length !== 1 ? "s" : ""}`}
          </Text>
        </View>
        <TouchableOpacity
          style={hs.settingsBtn}
          onPress={() => navigation.navigate("Settings")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={hs.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* board grid */}
      <FlatList
        data={boards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={hs.grid}
        ListEmptyComponent={EmptyState}
        columnWrapperStyle={hs.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <WhiteboardCard
            board={item}
            onPress={() => openBoard(item)}
            onLongPress={() => longPressBoard(item)}
          />
        )}
      />

      {/* fab */}
      <Animated.View
        style={[hs.fabWrapper, { transform: [{ scale: fabScale }] }]}
      >
        <TouchableOpacity
          style={hs.fab}
          onPress={showAddOptions}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          activeOpacity={1}
        >
          <Text style={hs.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* modals */}
      <ProcessingModal
        visible={processing}
        status={procStatus}
        error={procError}
        onCancel={cancelProcessing}
        onRetry={retryProcessing}
      />
      <RenameModal
        visible={!!renameTarget}
        currentName={renameTarget?.name}
        onSave={handleRename}
        onCancel={() => setRenameTarget(null)}
      />
    </SafeAreaView>
  );
}

const hs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  appName: {
    color: C.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  meta: { color: C.textSec, fontSize: 13, marginTop: 3 },
  settingsBtn: { padding: 6 },
  settingsIcon: { fontSize: 24 },
  grid: { paddingHorizontal: 10, paddingBottom: 110 },
  row: { justifyContent: "flex-start" },
  fabWrapper: {
    position: "absolute",
    bottom: 34,
    right: 22,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  fabIcon: { color: "#fff", fontSize: 34, fontWeight: "200", marginTop: -2 },
});

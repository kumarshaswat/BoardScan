import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getServerConfig, setServerConfig, testConnection } from "../utils/api";
import { SvgXml } from "react-native-svg";

const blobSvg = `<svg viewBox="0 0 390 844" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blur1" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
    <filter id="blur2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
    <radialGradient id="g1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0D3A4A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#080810" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0A2E3D" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#080810" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="390" height="844" fill="#080810"/>
  <ellipse cx="15%" cy="18%" rx="260" ry="300" fill="url(#g1)" filter="url(#blur1)"/>
  <ellipse cx="85%" cy="80%" rx="240" ry="280" fill="url(#g2)" filter="url(#blur2)"/>
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

const C = {
  bg: "#080810",
  card: "#0F0F1C",
  accent: "#5BC8F5",
  text: "#FFFFFF",
  textSec: "#7A8AA8",
  border: "#1A1A30",
  success: "#4CAF50",
  error: "#FF6B6B",
};

// Status badge shown after connection test
function ConnectionStatus({ result }) {
  if (!result) return null;
  const ok = result === "success";
  return (
    <View style={[cs.badge, ok ? cs.badgeGood : cs.badgeBad]}>
      <Text style={cs.badgeText}>
        {ok
          ? "✅  Connected successfully!"
          : "❌  Could not connect. Check your IP, port, and that your server is running."}
      </Text>
    </View>
  );
}

const cs = StyleSheet.create({
  badge: { borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1 },
  badgeGood: {
    backgroundColor: "rgba(76,175,80,0.12)",
    borderColor: C.success,
  },
  badgeBad: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: C.error,
  },
  badgeText: { color: C.text, fontSize: 13, lineHeight: 18 },
});

export default function SettingsScreen({ navigation }) {
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("5000");
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getServerConfig().then(({ ip, port }) => {
      setIp(ip);
      setPort(port);
    });
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestRes(null);
    // Temporarily apply the entered values so testConnection() sees them
    await setServerConfig(ip.trim(), port.trim() || "5000");
    try {
      const ok = await testConnection();
      setTestRes(ok ? "success" : "error");
    } catch {
      setTestRes("error");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!ip.trim()) {
      Alert.alert(
        "Missing IP",
        "Please enter your computer's local IP address.",
      );
      return;
    }
    setSaving(true);
    await setServerConfig(ip.trim(), port.trim() || "5000");
    setSaving(false);
    Alert.alert("Saved", "Server settings have been updated.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <BlobBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Settings</Text>
            <View style={{ width: 56 }} />
          </View>

          {/* Server Config */}
          <Text style={s.sectionLabel}>PIPELINE SERVER</Text>
          <Text style={s.sectionDesc}>
            Enter your computer's local IP address and the port your
            Flask/FastAPI server is listening on. Both devices must be on the
            same Wi-Fi network.
          </Text>

          <View style={s.card}>
            <Text style={s.fieldLabel}>Server IP Address</Text>
            <TextInput
              style={s.input}
              value={ip}
              onChangeText={(v) => {
                setIp(v);
                setTestRes(null);
              }}
              placeholder="e.g. 192.168.1.42"
              placeholderTextColor={C.textSec}
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Port</Text>
            <TextInput
              style={s.input}
              value={port}
              onChangeText={(v) => {
                setPort(v);
                setTestRes(null);
              }}
              placeholder="5000"
              placeholderTextColor={C.textSec}
              keyboardType="number-pad"
            />

            <ConnectionStatus result={testRes} />

            <TouchableOpacity
              style={[s.testBtn, testing && { opacity: 0.6 }]}
              onPress={handleTest}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color={C.accent} />
              ) : (
                <Text style={s.testBtnText}>Test Connection</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Tip: How to find IP */}
          <View style={[s.card, { marginTop: 12 }]}>
            <Text style={s.tipTitle}>💡 How to find your IP</Text>
            <Text style={s.tipBody}>
              <Text style={s.tipOS}>Mac: </Text>System Settings → Wi-Fi →
              Details{"\n"}
              <Text style={s.tipOS}>Windows: </Text>Run{" "}
              <Text style={s.mono}>ipconfig</Text> → IPv4 Address{"\n"}
              <Text style={s.tipOS}>Linux: </Text>Run{" "}
              <Text style={s.mono}>hostname -I</Text>
            </Text>
          </View>

          {/* Expected API Endpoints */}
          <Text style={[s.sectionLabel, { marginTop: 28 }]}>
            EXPECTED API ENDPOINTS
          </Text>
          <View style={s.card}>
            <View style={s.codeBlock}>
              <Text style={s.code}>GET /health → 200 OK</Text>
              <Text style={s.code}>POST /process → excalidraw JSON</Text>
            </View>
            <Text style={s.fieldLabel}>POST /process request:</Text>
            <View style={s.codeBlock}>
              <Text style={s.code}>Content-Type: multipart/form-data</Text>
              <Text style={s.code}>field "image": JPEG or PNG file</Text>
            </View>
            <Text style={s.fieldLabel}>Expected response shape:</Text>
            <View style={s.codeBlock}>
              <Text style={s.code}>{"{"}</Text>
              <Text style={s.code}>{'  "type": "excalidraw",'}</Text>
              <Text style={s.code}>{'  "version": 2,'}</Text>
              <Text style={s.code}>{'  "elements": [...],'}</Text>
              <Text style={s.code}>{'  "appState": { ... },'}</Text>
              <Text style={s.code}>{'  "files": {}'}</Text>
              <Text style={s.code}>{"}"}</Text>
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>Save Settings</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  back: { color: C.accent, fontSize: 16, fontWeight: "500" },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },

  // Sections
  sectionLabel: {
    color: C.textSec,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  sectionDesc: {
    color: C.textSec,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Fields
  fieldLabel: {
    color: C.textSec,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.bg,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Test button
  testBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  testBtnText: { color: C.accent, fontWeight: "700", fontSize: 14 },

  // Tip box
  tipTitle: { color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  tipBody: { color: C.textSec, fontSize: 13, lineHeight: 22 },
  tipOS: { color: C.text, fontWeight: "600" },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#A8E6CF",
    fontSize: 12,
  },

  // Code blocks
  codeBlock: {
    backgroundColor: C.bg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#A8E6CF",
    fontSize: 12,
    lineHeight: 20,
  },

  // Save button
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

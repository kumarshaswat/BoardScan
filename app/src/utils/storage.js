import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const WHITEBOARDS_KEY = "@boardscan_whiteboards";
const BOARDS_DIR = `${FileSystem.documentDirectory}whiteboards/`;

// Directory setup

export async function ensureBoardsDir() {
  const info = await FileSystem.getInfoAsync(BOARDS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BOARDS_DIR, { intermediates: true });
  }
}

// Metadata list

export async function loadWhiteboards() {
  try {
    const raw = await AsyncStorage.getItem(WHITEBOARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function persistWhiteboardsList(boards) {
  await AsyncStorage.setItem(WHITEBOARDS_KEY, JSON.stringify(boards));
}

// Save new whiteboard

/**
 * Saves a new whiteboard to disk and registers it in the metadata list.
 * @param {object} params
 * @param {string} params.id        - Unique whiteboard ID
 * @param {string} params.name      - Display name
 * @param {string} params.imagePath - URI of original photo
 * @param {object} params.scene     - Excalidraw scene JSON
 * @returns {object} metadata record
 */
export async function saveWhiteboard({ id, name, imagePath, scene }) {
  await ensureBoardsDir();

  const boardDir = `${BOARDS_DIR}${id}/`;
  await FileSystem.makeDirectoryAsync(boardDir, { intermediates: true });

  // Write scene JSON to disk
  const scenePath = `${boardDir}scene.json`;
  await FileSystem.writeAsStringAsync(scenePath, JSON.stringify(scene), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // Copy original image as thumbnail
  let thumbPath = null;
  if (imagePath) {
    thumbPath = `${boardDir}thumb.jpg`;
    try {
      await FileSystem.copyAsync({ from: imagePath, to: thumbPath });
    } catch {
      thumbPath = null;
    }
  }

  const metadata = {
    id,
    name,
    createdAt: Date.now(),
    thumbPath,
    scenePath,
  };

  // Prepend to list so newest appears first
  const boards = await loadWhiteboards();
  const existingIdx = boards.findIndex((b) => b.id === id);
  if (existingIdx >= 0) {
    boards[existingIdx] = metadata;
  } else {
    boards.unshift(metadata);
  }

  await persistWhiteboardsList(boards);
  return metadata;
}

// Load scene

export async function loadScene(scenePath) {
  try {
    const raw = await FileSystem.readAsStringAsync(scenePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(raw);
  } catch {
    return {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    };
  }
}

// Save edited scene

export async function saveExcalidrawScene(id, sceneData) {
  const scenePath = `${BOARDS_DIR}${id}/scene.json`;
  await FileSystem.writeAsStringAsync(scenePath, JSON.stringify(sceneData), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

// Rename

export async function renameWhiteboard(id, newName) {
  const boards = await loadWhiteboards();
  const idx = boards.findIndex((b) => b.id === id);
  if (idx >= 0) {
    boards[idx].name = newName;
    await persistWhiteboardsList(boards);
  }
}

// Delete

export async function deleteWhiteboard(id) {
  const boardDir = `${BOARDS_DIR}${id}/`;
  try {
    await FileSystem.deleteAsync(boardDir, { idempotent: true });
  } catch {}

  const boards = await loadWhiteboards();
  await persistWhiteboardsList(boards.filter((b) => b.id !== id));
}

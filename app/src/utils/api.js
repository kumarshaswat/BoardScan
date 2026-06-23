import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_IP_KEY = '@boardscan_server_ip';
const SERVER_PORT_KEY = '@boardscan_server_port';

// Config

export async function getServerConfig() {
  const ip = (await AsyncStorage.getItem(SERVER_IP_KEY)) ?? '';
  const port = (await AsyncStorage.getItem(SERVER_PORT_KEY)) ?? '5000';
  return { ip, port };
}

export async function setServerConfig(ip, port) {
  await AsyncStorage.multiSet([
    [SERVER_IP_KEY, ip],
    [SERVER_PORT_KEY, port],
  ]);
}

function getBaseUrl(ip, port) {
  return `http://${ip}:${port}`;
}

// ─── Health Check ────────────────────────────────────────────────────────────

export async function testConnection() {
  const { ip, port } = await getServerConfig();
  if (!ip) throw new Error('No server IP configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${getBaseUrl(ip, port)}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timeout);
  }
}

// Process Image

/**
 * Uploads an image to the pipeline server and returns the Excalidraw scene JSON.
 *
 * Expected server contract:
 *   POST /process
 *   Content-Type: multipart/form-data
 *   Field: "image" (JPEG or PNG file)
 *
 *   Response JSON:
 *   {
 *     "type": "excalidraw",
 *     "version": 2,
 *     "elements": [...],
 *     "appState": { "viewBackgroundColor": "#ffffff", ... },
 *     "files": {}
 *   }
 *
 * @param {string} imageUri - Local URI of the image to process
 * @param {function} onStatus - Callback for status string updates
 * @returns {object} Excalidraw scene JSON
 */
export async function processImage(imageUri, onStatus) {
  const { ip, port } = await getServerConfig();
  if (!ip) {
    throw new Error('Server IP not configured. Go to Settings and enter your computer\'s local IP address.');
  }

  onStatus?.('Connecting to pipeline...');

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'whiteboard.jpg',
  });

  onStatus?.('Uploading image to server...');

  let response;
  try {
    response = await fetch(`${getBaseUrl(ip, port)}/process`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (err) {
    throw new Error(
      `Could not reach the server at ${ip}:${port}. ` +
      'Make sure your computer is on the same Wi-Fi network and the server is running.'
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body.error || body.message || '';
    } catch {}
    throw new Error(`Server returned ${response.status}${detail ? ': ' + detail : ''}`);
  }

  onStatus?.('Running YOLO detection...');

  // Give the status a moment to render before the heavy JSON parse
  await new Promise((r) => setTimeout(r, 50));

  onStatus?.('Vectorizing with vtracer...');

  const scene = await response.json();

  onStatus?.('Finalizing your whiteboard...');

  return scene;
}

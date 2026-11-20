import { defineConfig } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

process.env.ELITE_BROWSER_TEST_PASSWORD ||= randomBytes(24).toString('hex')
const localPython = path.resolve(
  '../backend/venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)
const python =
  process.env.ELITE_TEST_PYTHON ||
  (existsSync(localPython) ? localPython : 'python')
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4187',
    channel: process.env.ELITE_BROWSER_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 960 },
  },
  webServer: [
    {
      command: '"' + python + '" browser_test_server.py',
      cwd: '../backend',
      url: 'http://127.0.0.1:8037/api/session/',
      timeout: 60000,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4187 --strictPort',
      url: 'http://127.0.0.1:4187',
      env: { DJANGO_PROXY_TARGET: 'http://127.0.0.1:8037' },
    },
  ],
})

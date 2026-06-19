import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright配置文件
 * 用于E2E测试
 */
export default defineConfig({
  testDir: './e2e',

  // 测试超时时间
  timeout: 30 * 1000,

  // 每个测试的重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行执行的worker数量
  workers: process.env.CI ? 1 : undefined,

  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础URL
    baseURL: 'http://localhost:3000',

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频配置
    video: 'retain-on-failure',

    // 追踪配置
    trace: 'on-first-retry',
  },

  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // 使用系统安装的Chrome
      },
    },

    // 可选: 添加更多浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 开发服务器配置
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

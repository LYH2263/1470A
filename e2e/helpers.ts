import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E测试辅助工具
 */

// 扩展基础test对象,添加自定义fixtures
export const test = base.extend({
  // 可以在这里添加自定义fixtures
});

export { expect } from '@playwright/test';

/**
 * 测试数据工厂
 */
export const testData = {
  article: {
    title: 'E2E测试文章',
    author: 'E2E测试作者',
    importance: 'high' as const,
    content: '<p>这是E2E测试的文章内容</p>',
  },

  createRandomArticle: () => ({
    title: `测试文章-${Date.now()}`,
    author: `测试作者-${Math.random().toString(36).substring(7)}`,
    importance: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
    content: `<p>测试内容-${Date.now()}</p>`,
  }),
};

/**
 * 页面对象模型 (Page Object Model)
 */
export class ArticleListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async clickNewArticle() {
    await this.page.click('text=新建文章');
  }

  async searchArticle(keyword: string) {
    await this.page.fill('input[placeholder*="搜索"]', keyword);
    await this.page.press('input[placeholder*="搜索"]', 'Enter');
  }

  async getArticleCount() {
    return await this.page.locator('.ant-table-tbody tr').count();
  }

  async clickFirstArticleView() {
    await this.page.click('.ant-table-tbody tr:first-child button:has-text("查看")');
  }

  async clickFirstArticleEdit() {
    await this.page.click('.ant-table-tbody tr:first-child button:has-text("编辑")');
  }

  async selectFirstArticle() {
    await this.page.click('.ant-table-tbody tr:first-child .ant-checkbox-input');
  }

  async clickDelete() {
    await this.page.click('button:has-text("删除")');
  }

  async confirmDelete() {
    await this.page.click('.ant-modal button:has-text("确定")');
  }
}

export class ArticleFormPage {
  constructor(private page: Page) {}

  async fillTitle(title: string) {
    await this.page.fill('input[id*="title"]', title);
  }

  async fillAuthor(author: string) {
    await this.page.fill('input[id*="author"]', author);
  }

  async selectImportance(importance: 'low' | 'medium' | 'high') {
    await this.page.click('.ant-select-selector');
    const importanceMap = {
      low: '低',
      medium: '中',
      high: '高',
    };
    await this.page.click(`text=${importanceMap[importance]}`);
  }

  async fillContent(content: string) {
    const editor = this.page.locator('.ql-editor, [contenteditable="true"]').first();
    await editor.click();
    await editor.fill(content);
  }

  async submit() {
    await this.page.click('button:has-text("保存")');
  }

  async cancel() {
    await this.page.click('button:has-text("返回")');
  }

  async fillForm(data: {
    title: string;
    author: string;
    importance: 'low' | 'medium' | 'high';
    content: string;
  }) {
    await this.fillTitle(data.title);
    await this.fillAuthor(data.author);
    await this.selectImportance(data.importance);
    await this.fillContent(data.content);
  }
}

export class ArticleDetailPage {
  constructor(private page: Page) {}

  async getTitle() {
    return await this.page.locator('h1, .article-title').textContent();
  }

  async getAuthor() {
    return await this.page.locator('.article-author').textContent();
  }

  async getContent() {
    return await this.page.locator('.article-content, .ql-editor').textContent();
  }

  async clickEdit() {
    await this.page.click('button:has-text("编辑")');
  }

  async clickBack() {
    await this.page.click('button:has-text("返回")');
  }
}

/**
 * 等待工具
 */
export const waitFor = {
  navigation: async (page: Page) => {
    await page.waitForLoadState('networkidle');
  },

  message: async (page: Page, type: 'success' | 'error' | 'warning' | 'info') => {
    await page.waitForSelector(`.ant-message-${type}`);
  },

  table: async (page: Page) => {
    await page.waitForSelector('.ant-table-tbody tr');
  },
};

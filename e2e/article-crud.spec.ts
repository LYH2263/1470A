import { test, expect } from '@playwright/test';
import { ArticleListPage, ArticleFormPage, testData } from './helpers';

/**
 * E2E测试: 使用Page Object Model
 *
 * 这个测试文件使用了Page Object Model模式,
 * 使测试更易读、更易维护
 */

test.describe('文章管理 - 核心流程 (POM)', () => {
  let listPage: ArticleListPage;
  let formPage: ArticleFormPage;

  test.beforeEach(async ({ page }) => {
    listPage = new ArticleListPage(page);
    formPage = new ArticleFormPage(page);
    await listPage.goto();
  });

  test('完整的CRUD流程', async ({ page }) => {
    // 1. 创建文章
    await listPage.clickNewArticle();
    await expect(page).toHaveURL(/\/articles\/create/);

    const articleData = testData.createRandomArticle();
    await formPage.fillForm(articleData);
    await formPage.submit();

    // 验证返回首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('.ant-message-success')).toBeVisible();

    // 2. 搜索文章
    await listPage.searchArticle(articleData.title);
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${articleData.title}`)).toBeVisible();

    // 3. 编辑文章
    await listPage.clickFirstArticleEdit();
    await expect(page.url()).toMatch(/\/articles\/[a-f0-9-]+\/edit/);

    await formPage.fillTitle(articleData.title + ' (已编辑)');
    await formPage.submit();

    await expect(page).toHaveURL('/');
    await expect(page.locator('.ant-message-success')).toBeVisible();

    // 4. 删除文章
    await listPage.selectFirstArticle();
    await listPage.clickDelete();
    await listPage.confirmDelete();

    await expect(page.locator('.ant-message-success')).toBeVisible();
  });

  test('创建多篇文章', async ({ page }) => {
    const articlesToCreate = 3;

    for (let i = 0; i < articlesToCreate; i++) {
      await listPage.clickNewArticle();

      const articleData = testData.createRandomArticle();
      await formPage.fillForm(articleData);
      await formPage.submit();

      await expect(page).toHaveURL('/');
      await page.waitForTimeout(500);
    }

    // 验证文章数量增加
    const count = await listPage.getArticleCount();
    expect(count).toBeGreaterThanOrEqual(articlesToCreate);
  });

  test('表单取消操作', async ({ page }) => {
    await listPage.clickNewArticle();
    await expect(page).toHaveURL(/\/articles\/create/);

    // 填写部分表单
    await formPage.fillTitle('测试取消');

    // 点击返回
    await formPage.cancel();

    // 验证返回首页
    await expect(page).toHaveURL('/');
  });
});

test.describe('文章管理 - 批量操作', () => {
  test('批量删除文章', async ({ page }) => {
    const listPage = new ArticleListPage(page);
    await listPage.goto();

    // 等待表格加载
    await page.waitForSelector('.ant-table-tbody tr');

    const initialCount = await listPage.getArticleCount();

    if (initialCount >= 2) {
      // 选择前两篇文章
      await page.click('.ant-table-tbody tr:nth-child(1) .ant-checkbox-input');
      await page.click('.ant-table-tbody tr:nth-child(2) .ant-checkbox-input');

      // 删除
      await listPage.clickDelete();
      await listPage.confirmDelete();

      await expect(page.locator('.ant-message-success')).toBeVisible();

      // 验证数量减少
      await page.waitForTimeout(500);
      const finalCount = await listPage.getArticleCount();
      expect(finalCount).toBe(initialCount - 2);
    }
  });
});

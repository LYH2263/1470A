import { test, expect } from '@playwright/test';

/**
 * E2E测试: 文章管理完整流程
 *
 * 测试场景:
 * 1. 访问首页,查看文章列表
 * 2. 创建新文章
 * 3. 查看文章详情
 * 4. 编辑文章
 * 5. 删除文章
 */

test.describe('文章管理系统 - 完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问首页
    await page.goto('/');
  });

  test('应该显示首页和文章列表', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/文章管理系统/);

    // 验证导航栏存在
    await expect(page.locator('header')).toBeVisible();

    // 验证侧边栏存在
    await expect(page.locator('aside, .ant-layout-sider')).toBeVisible();

    // 验证文章列表表格存在
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('应该能够创建新文章', async ({ page }) => {
    // 点击"新建文章"按钮
    await page.click('text=新建文章');

    // 等待导航到创建页面
    await expect(page).toHaveURL(/\/articles\/create/);

    // 填写表单
    await page.fill('input[id*="title"]', 'E2E测试文章');
    await page.fill('input[id*="author"]', 'E2E测试作者');

    // 选择重要性
    await page.click('.ant-select-selector');
    await page.click('text=高');

    // 填写内容 (富文本编辑器)
    const editor = page.locator('.ql-editor, [contenteditable="true"]').first();
    await editor.click();
    await editor.fill('这是E2E测试的文章内容');

    // 提交表单
    await page.click('button:has-text("保存")');

    // 等待返回首页
    await expect(page).toHaveURL('/');

    // 验证成功消息
    await expect(page.locator('.ant-message-success')).toBeVisible();

    // 验证新文章出现在列表中
    await expect(page.locator('text=E2E测试文章')).toBeVisible();
  });

  test('应该能够查看文章详情', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 点击第一篇文章的"查看"按钮
    await page.click('.ant-table-tbody tr:first-child button:has-text("查看")');

    // 等待导航到详情页面
    await expect(page.url()).toMatch(/\/articles\/[a-f0-9-]+$/);

    // 验证文章详情显示
    await expect(page.locator('h1, .article-title')).toBeVisible();
    await expect(page.locator('.article-author, text=/作者/')).toBeVisible();
    await expect(page.locator('.article-content, .ql-editor')).toBeVisible();
  });

  test('应该能够编辑文章', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 点击第一篇文章的"编辑"按钮
    await page.click('.ant-table-tbody tr:first-child button:has-text("编辑")');

    // 等待导航到编辑页面
    await expect(page.url()).toMatch(/\/articles\/[a-f0-9-]+\/edit/);

    // 修改标题
    const titleInput = page.locator('input[id*="title"]');
    await titleInput.clear();
    await titleInput.fill('E2E测试文章(已编辑)');

    // 提交表单
    await page.click('button:has-text("保存")');

    // 等待返回首页
    await expect(page).toHaveURL('/');

    // 验证成功消息
    await expect(page.locator('.ant-message-success')).toBeVisible();

    // 验证修改后的标题出现在列表中
    await expect(page.locator('text=E2E测试文章(已编辑)')).toBeVisible();
  });

  test('应该能够删除文章', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 获取删除前的文章数量
    const rowsBefore = await page.locator('.ant-table-tbody tr').count();

    // 选择第一篇文章的复选框
    await page.click('.ant-table-tbody tr:first-child .ant-checkbox-input');

    // 点击"删除"按钮
    await page.click('button:has-text("删除")');

    // 确认删除对话框
    await page.click('.ant-modal button:has-text("确定")');

    // 等待删除完成
    await expect(page.locator('.ant-message-success')).toBeVisible();

    // 验证文章数量减少
    const rowsAfter = await page.locator('.ant-table-tbody tr').count();
    expect(rowsAfter).toBe(rowsBefore - 1);
  });

  test('应该能够搜索文章', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 输入搜索关键词
    await page.fill('input[placeholder*="搜索"]', 'E2E');

    // 点击搜索按钮或按Enter
    await page.press('input[placeholder*="搜索"]', 'Enter');

    // 等待搜索结果加载
    await page.waitForTimeout(500);

    // 验证搜索结果
    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();

    if (count > 0) {
      // 验证所有结果都包含搜索关键词
      for (let i = 0; i < count; i++) {
        const text = await rows.nth(i).textContent();
        expect(text?.toLowerCase()).toContain('e2e');
      }
    }
  });

  test('应该能够分页浏览文章', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 检查是否有分页器
    const pagination = page.locator('.ant-pagination');
    const hasPagination = await pagination.isVisible();

    if (hasPagination) {
      // 获取第一页的第一篇文章标题
      const firstArticleTitle = await page
        .locator('.ant-table-tbody tr:first-child')
        .textContent();

      // 点击下一页
      await page.click('.ant-pagination-next');

      // 等待页面更新
      await page.waitForTimeout(500);

      // 获取第二页的第一篇文章标题
      const secondPageFirstArticle = await page
        .locator('.ant-table-tbody tr:first-child')
        .textContent();

      // 验证内容不同
      expect(secondPageFirstArticle).not.toBe(firstArticleTitle);
    }
  });

  test('应该能够按重要性筛选文章', async ({ page }) => {
    // 等待文章列表加载
    await page.waitForSelector('.ant-table-tbody tr');

    // 点击重要性列的筛选按钮
    const filterButton = page.locator('.ant-table-filter-trigger').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // 选择"高"重要性
      await page.click('.ant-dropdown text=高');

      // 点击确定
      await page.click('.ant-dropdown button:has-text("确定")');

      // 等待筛选结果
      await page.waitForTimeout(500);

      // 验证所有显示的文章都是高重要性
      const importanceTags = page.locator('.ant-tag');
      const count = await importanceTags.count();

      for (let i = 0; i < count; i++) {
        const text = await importanceTags.nth(i).textContent();
        expect(text).toBe('高');
      }
    }
  });
});

test.describe('文章管理系统 - 表单验证', () => {
  test('应该验证必填字段', async ({ page }) => {
    await page.goto('/articles/create');

    // 不填写任何内容,直接提交
    await page.click('button:has-text("保存")');

    // 验证错误消息显示
    await expect(page.locator('.ant-form-item-explain-error')).toBeVisible();
  });

  test('应该验证标题长度', async ({ page }) => {
    await page.goto('/articles/create');

    // 填写超长标题
    await page.fill('input[id*="title"]', 'A'.repeat(201));

    // 提交表单
    await page.click('button:has-text("保存")');

    // 验证错误消息
    await expect(page.locator('text=/标题不能超过/')).toBeVisible();
  });

  test('应该验证作者长度', async ({ page }) => {
    await page.goto('/articles/create');

    // 填写超长作者名
    await page.fill('input[id*="author"]', 'A'.repeat(51));

    // 提交表单
    await page.click('button:has-text("保存")');

    // 验证错误消息
    await expect(page.locator('text=/作者不能超过/')).toBeVisible();
  });
});

test.describe('文章管理系统 - 错误处理', () => {
  test('应该处理网络错误', async ({ page, context }) => {
    // 模拟离线状态
    await context.setOffline(true);

    await page.goto('/');

    // 尝试创建文章
    await page.click('text=新建文章');
    await page.fill('input[id*="title"]', '测试文章');
    await page.fill('input[id*="author"]', '测试作者');
    await page.click('button:has-text("保存")');

    // 验证错误消息
    await expect(page.locator('.ant-message-error')).toBeVisible();

    // 恢复在线状态
    await context.setOffline(false);
  });

  test('应该处理404页面', async ({ page }) => {
    // 访问不存在的文章
    await page.goto('/articles/non-existent-id');

    // 验证404错误或重定向到首页
    const url = page.url();
    expect(url).toMatch(/\/(404|$)/);
  });
});

test.describe('文章管理系统 - 响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // 验证页面可以正常显示
    await expect(page.locator('body')).toBeVisible();

    // 验证侧边栏可能被折叠
    const sidebar = page.locator('aside, .ant-layout-sider');
    if (await sidebar.isVisible()) {
      const width = await sidebar.evaluate((el) => el.offsetWidth);
      expect(width).toBeLessThan(300);
    }
  });

  test('应该在平板设备上正常显示', async ({ page }) => {
    // 设置平板设备视口
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');

    // 验证页面布局
    await expect(page.locator('.ant-table')).toBeVisible();
  });
});

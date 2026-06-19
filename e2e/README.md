# E2E测试文档

## 概述

本项目使用Playwright进行端到端(E2E)测试,覆盖完整的用户流程和交互场景。

## 测试文件

### 1. article-management.spec.ts
完整的文章管理流程测试,包括:
- ✅ 首页和文章列表显示
- ✅ 创建新文章
- ✅ 查看文章详情
- ✅ 编辑文章
- ✅ 删除文章
- ✅ 搜索文章
- ✅ 分页浏览
- ✅ 按重要性筛选
- ✅ 表单验证
- ✅ 错误处理
- ✅ 响应式设计

### 2. article-crud.spec.ts
使用Page Object Model模式的CRUD测试,包括:
- ✅ 完整的CRUD流程
- ✅ 创建多篇文章
- ✅ 表单取消操作
- ✅ 批量删除文章

### 3. helpers.ts
测试辅助工具,包括:
- Page Object Model类
- 测试数据工厂
- 等待工具函数

## 运行测试

### 前提条件

1. 安装依赖:
```bash
pnpm install
```

2. 安装Playwright浏览器:
```bash
pnpm playwright install
```

### 运行命令

```bash
# 运行所有E2E测试
pnpm test:e2e

# 使用UI模式运行测试
pnpm test:e2e:ui

# 调试模式运行测试
pnpm test:e2e:debug

# 查看测试报告
pnpm test:e2e:report

# 运行特定测试文件
pnpm playwright test e2e/article-crud.spec.ts

# 运行特定测试用例
pnpm playwright test -g "应该能够创建新文章"
```

## 测试配置

配置文件: `playwright.config.ts`

主要配置:
- **baseURL**: http://localhost:3000
- **timeout**: 30秒
- **retries**: CI环境重试2次
- **screenshot**: 失败时截图
- **video**: 失败时录制视频
- **trace**: 首次重试时记录追踪

## Page Object Model

### ArticleListPage
文章列表页面对象,提供以下方法:
- `goto()` - 访问首页
- `clickNewArticle()` - 点击新建文章
- `searchArticle(keyword)` - 搜索文章
- `getArticleCount()` - 获取文章数量
- `clickFirstArticleView()` - 查看第一篇文章
- `clickFirstArticleEdit()` - 编辑第一篇文章
- `selectFirstArticle()` - 选择第一篇文章
- `clickDelete()` - 点击删除按钮
- `confirmDelete()` - 确认删除

### ArticleFormPage
文章表单页面对象,提供以下方法:
- `fillTitle(title)` - 填写标题
- `fillAuthor(author)` - 填写作者
- `selectImportance(importance)` - 选择重要性
- `fillContent(content)` - 填写内容
- `submit()` - 提交表单
- `cancel()` - 取消操作
- `fillForm(data)` - 填写完整表单

### ArticleDetailPage
文章详情页面对象,提供以下方法:
- `getTitle()` - 获取标题
- `getAuthor()` - 获取作者
- `getContent()` - 获取内容
- `clickEdit()` - 点击编辑
- `clickBack()` - 返回

## 测试数据

### testData.article
默认测试文章数据:
```typescript
{
  title: 'E2E测试文章',
  author: 'E2E测试作者',
  importance: 'high',
  content: '<p>这是E2E测试的文章内容</p>',
}
```

### testData.createRandomArticle()
创建随机测试文章数据,避免数据冲突。

## 最佳实践

### 1. 使用Page Object Model
将页面操作封装到Page Object中,提高测试可维护性:

```typescript
const listPage = new ArticleListPage(page);
await listPage.goto();
await listPage.clickNewArticle();
```

### 2. 使用测试数据工厂
使用工厂函数创建测试数据,避免硬编码:

```typescript
const articleData = testData.createRandomArticle();
await formPage.fillForm(articleData);
```

### 3. 等待元素加载
使用适当的等待策略:

```typescript
// 等待元素可见
await page.waitForSelector('.ant-table-tbody tr');

// 等待网络空闲
await page.waitForLoadState('networkidle');

// 等待特定时间(尽量避免)
await page.waitForTimeout(500);
```

### 4. 使用有意义的选择器
优先使用语义化选择器:

```typescript
// 好的选择器
await page.click('button:has-text("保存")');
await page.fill('input[placeholder*="搜索"]', 'keyword');

// 避免使用脆弱的选择器
await page.click('.btn-123'); // 类名可能会变
```

### 5. 独立的测试用例
每个测试用例应该独立运行,不依赖其他测试:

```typescript
test.beforeEach(async ({ page }) => {
  // 每个测试前重置状态
  await page.goto('/');
});
```

## 调试技巧

### 1. 使用UI模式
```bash
pnpm test:e2e:ui
```
提供可视化界面,可以逐步执行测试。

### 2. 使用调试模式
```bash
pnpm test:e2e:debug
```
在浏览器中逐步调试测试。

### 3. 查看截图和视频
测试失败时,Playwright会自动保存截图和视频到`test-results/`目录。

### 4. 查看追踪
```bash
pnpm playwright show-trace test-results/trace.zip
```

### 5. 使用console.log
在测试中添加日志:

```typescript
test('测试用例', async ({ page }) => {
  console.log('当前URL:', page.url());
  const count = await page.locator('.ant-table-tbody tr').count();
  console.log('文章数量:', count);
});
```

## CI/CD集成

### GitHub Actions示例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## 常见问题

### Q: 测试运行很慢怎么办?
A:
1. 减少`waitForTimeout`的使用
2. 使用`waitForSelector`等待特定元素
3. 在CI环境中使用单个worker
4. 只运行必要的测试

### Q: 测试不稳定(flaky)怎么办?
A:
1. 增加适当的等待时间
2. 使用更可靠的选择器
3. 配置重试次数
4. 检查网络请求是否完成

### Q: 如何测试需要登录的页面?
A:
1. 使用`storageState`保存登录状态
2. 在`beforeEach`中恢复登录状态
3. 或者在每个测试中执行登录操作

### Q: 如何测试文件上传?
A:
```typescript
await page.setInputFiles('input[type="file"]', 'path/to/file.jpg');
```

## 测试覆盖范围

### 已覆盖 ✅
- 文章CRUD操作
- 搜索和筛选
- 分页
- 表单验证
- 错误处理
- 响应式设计
- 批量操作

### 待覆盖 ⏳
- 图片上传
- 富文本编辑器高级功能
- 键盘快捷键
- 拖拽排序
- 导出功能

## 参考资源

- [Playwright官方文档](https://playwright.dev/)
- [Playwright最佳实践](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [测试选择器](https://playwright.dev/docs/selectors)

---

**最后更新**: 2026-02-03
**Playwright版本**: 1.58.1

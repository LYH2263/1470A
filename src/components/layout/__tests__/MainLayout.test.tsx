import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MainLayout from '../MainLayout';

// Mock子组件
vi.mock('../TopNav', () => ({
  default: () => <div data-testid="top-nav">TopNav</div>,
}));

vi.mock('../Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

describe('MainLayout 组件', () => {
  describe('渲染', () => {
    it('应该渲染顶部导航', () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('top-nav')).toBeInTheDocument();
    });

    it('应该渲染侧边栏', () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('应该渲染子组件', () => {
      render(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('应该渲染多个子组件', () => {
      render(
        <MainLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </MainLayout>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });
  });

  describe('布局结构', () => {
    it('应该包含所有必需的布局元素', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      // 检查是否有Layout组件
      const layouts = container.querySelectorAll('.ant-layout');
      expect(layouts.length).toBeGreaterThan(0);
    });

    it('应该有正确的嵌套结构', () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      // 验证TopNav、Sidebar和Content都存在
      expect(screen.getByTestId('top-nav')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('样式', () => {
    it('应该设置最小高度', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const mainLayout = container.querySelector('.ant-layout');
      expect(mainLayout).toHaveStyle({ minHeight: '100vh' });
    });
  });

  describe('响应式', () => {
    it('应该在不同内容下正常渲染', () => {
      const { rerender } = render(
        <MainLayout>
          <div>Short Content</div>
        </MainLayout>
      );

      expect(screen.getByText('Short Content')).toBeInTheDocument();

      rerender(
        <MainLayout>
          <div>
            {Array.from({ length: 100 }, (_, i) => (
              <p key={i}>Long Content Line {i}</p>
            ))}
          </div>
        </MainLayout>
      );

      expect(screen.getByText('Long Content Line 0')).toBeInTheDocument();
      expect(screen.getByText('Long Content Line 99')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应该处理空子组件', () => {
      render(<MainLayout>{null}</MainLayout>);

      expect(screen.getByTestId('top-nav')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('应该处理undefined子组件', () => {
      render(<MainLayout>{undefined}</MainLayout>);

      expect(screen.getByTestId('top-nav')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('应该处理复杂的子组件树', () => {
      render(
        <MainLayout>
          <div>
            <header>Header</header>
            <main>
              <section>
                <article>Article Content</article>
              </section>
            </main>
            <footer>Footer</footer>
          </div>
        </MainLayout>
      );

      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Article Content')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });
});

import type { NextApiResponse } from 'next';
import { getSearchSuggestions } from '@/lib/search';
import type { ApiResponse, SearchSuggestion } from '@/types/article';
import { SEARCH } from '@/lib/constants';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<SearchSuggestion[]>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const keyword = typeof req.query.keyword === 'string'
      ? req.query.keyword.trim().slice(0, SEARCH.MAX_KEYWORD_LENGTH)
      : '';

    if (!keyword || keyword.length < SEARCH.MIN_QUERY_LENGTH) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const suggestions = await getSearchSuggestions(keyword, SEARCH.SUGGESTION_LIMIT);

    return res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('搜索建议失败:', error);
    return res.status(500).json({
      success: false,
      error: '搜索建议失败',
    });
  }
}

export default withAuth(handler);

// LNReader plugin for wetriedtls.com ("We Tried TLs")
// Save as plugins/english/wetriedtls.ts
//
// Note: some chapters (e.g. bonus/early-access ones) are paywalled by the
// site itself and return no content to guests — that's not a bug in this
// plugin, there's genuinely nothing to scrape for those.
//
// No filters — the catalog is small enough that Popular/Latest covers it,
// and a client-side status filter here was the likely cause of "search
// returns nothing".

import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

const API = 'https://api.wetriedtls.com';

const STATUS_MAP: Record<string, NovelStatus> = {
  Ongoing: NovelStatus.Ongoing,
  Completed: NovelStatus.Completed,
  Hiatus: NovelStatus.OnHiatus,
  Dropped: NovelStatus.Cancelled,
  Canceled: NovelStatus.Cancelled,
};

class WeTriedTLsPlugin implements Plugin.PluginBase {
  id = 'wetriedtls';
  name = 'We Tried TLs';
  icon = 'src/en/wetriedtls/icon.png';
  site = 'https://wetriedtls.com';
  version = '1.1.0';

  private async queryApi(term: string, pageNo: number, orderBy = 'created_at') {
    const url =
      `${API}/query?adult=true&series_type=Novel&perPage=20` +
      `&orderBy=${orderBy}&status=All&tags_ids=[]` +
      `&query_string=${encodeURIComponent(term)}&page=${pageNo}`;
    const body = await fetchApi(url).then(r => r.json());
    return (body.data ?? []) as any[];
  }

  private toNovelItem(s: any): Plugin.NovelItem {
    return {
      path: `/series/${s.series_slug}`,
      name: s.title,
      cover: s.thumbnail || defaultCover,
    };
  }

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const orderBy = showLatestNovels ? 'latest' : 'total_views';
    const results = await this.queryApi('', pageNo, orderBy);
    return results.map(s => this.toNovelItem(s));
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const results = await this.queryApi(searchTerm, pageNo);
    return results.map(s => this.toNovelItem(s));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const slug = novelPath.replace('/series/', '');

    // No direct "series by slug" endpoint exists, so: load the series page
    // to read its title off t+ numeric id (matched by slug, not just first
    // result, in case of similar titles).he DOM, then look that title up via search to
    // get the full metadata + numeric id (matched by slug, not just first
    // result, in case of similar titles).
    const pageHtml = await fetchApi(this.site + novelPath).then(r => r.text());
    const bookTitle = loadCheerio(pageHtml)('section .text-xl')
      .first()
      .text()
      .trim();

    const candidates = await this.queryApi(bookTitle, 1);
    const data = candidates.find(c => c.series_slug === slug) ?? candidates[0];
    if (!data)
      throw new Error(`Could not find metadata for "${bookTitle}" (${slug})`);

    const chapterBody = await fetchApi(
      `${API}/chapters/${data.id}?page=1&perPage=9999&order=asc`,
    ).then(r => r.json());

    const chapters: Plugin.ChapterItem[] = (chapterBody.data ?? []).map(
      (c: any, i: number) => ({
        name: c.chapter_title,
        path: `/series/${slug}/${c.chapter_slug ?? c.id}`,
        chapterNumber: c.index ?? i + 1,
      }),
    );

    return {
      path: novelPath,
      name: data.title,
      cover: data.thumbnail || defaultCover,
      author: data.author || undefined,
      summary:
        loadCheerio(data.description || '')
          .text()
          .trim() || undefined,
      status: STATUS_MAP[data.status] ?? NovelStatus.Unknown,
      chapters,
    };
  }

  // The page streams its content as JSON inside
  // <script>self.__next_f.push([...])</script> tags. A single script tag
  // can contain multiple push() calls back to back, so we scan for the
  // exact end of each one (string/escape-aware, so parens/brackets inside
  // the prose don't throw off the bounds) rather than assuming one call
  // fills the whole tag.
  private extractPushArgs(scriptText: string): any[] {
    const prefix = 'self.__next_f.push(';
    const results: any[] = [];
    let from = 0;

    while (true) {
      const start = scriptText.indexOf(prefix, from);
      if (start === -1) break;

      const jsonStart = start + prefix.length;
      let depth = 0;
      let inString = false;
      let jsonEnd = -1;

      for (let i = jsonStart; i < scriptText.length; i++) {
        const ch = scriptText[i];
        if (inString) {
          if (ch === '\\') i++;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '[' || ch === '{') depth++;
        else if (ch === ']' || ch === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd === -1) break;
      try {
        results.push(JSON.parse(scriptText.slice(jsonStart, jsonEnd)));
      } catch {
        // not valid JSON, skip it
      }
      from = jsonEnd;
    }

    return results;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const html = await fetchApi(this.site + chapterPath).then(r => r.text());
    const $ = loadCheerio(html);

    let chapterHtml = '';
    $('script').each((_, el) => {
      const text = $(el).html() || '';
      if (!text.includes('self.__next_f.push(')) return;

      for (const parsed of this.extractPushArgs(text)) {
        const [type, data] = Array.isArray(parsed) ? parsed : [];
        if (
          type === 1 &&
          typeof data === 'string' &&
          /<p[\s>]/.test(data) &&
          data.length > chapterHtml.length
        ) {
          chapterHtml = data;
        }
      }
    });

    // Check actual readable text after stripping tags, not raw HTML length —
    // guards against a false-positive match (e.g. a stray short <p> in nav)
    // slipping through now that there's no fixed HTML-length floor.
    if (
      !chapterHtml ||
      chapterHtml.replace(/<[^>]+>/g, '').trim().length < 20
    ) {
      throw new Error(
        'No chapter content found — the page structure may have changed.',
      );
    }

    return chapterHtml;
  }
}

export default new WeTriedTLsPlugin();

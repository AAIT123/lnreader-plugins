import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { CheerioAPI, load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';

const pluginHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

// Genre and Year are each their own browse path on the site (e.g.
// readfrom.net/fantasy/page/2/, readfrom.net/2015/page/2/) rather than
// combinable query params, so they're modeled as single-select Pickers
// rather than checkboxes. Verified against the site's own "Top Genres" /
// "Search by Year" sidebar links.
const genreOptions = [
  { label: 'All', value: '' },
  { label: 'Romance', value: 'romance' },
  { label: 'Fiction', value: 'fiction' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Young Adult', value: 'young-adult' },
  { label: 'Contemporary', value: 'contemporary' },
  { label: 'Mystery & Thrillers', value: 'mystery-thrillers' },
  { label: 'Science Fiction & Fantasy', value: 'science-fiction-fantasy' },
  { label: 'Paranormal', value: 'paranormal' },
  { label: 'Historical Fiction', value: 'historical-fiction' },
  { label: 'Mystery', value: 'mystery' },
  { label: 'Science Fiction', value: 'science-fiction' },
  { label: 'Literature & Fiction', value: 'literature-fiction' },
  { label: 'Thriller', value: 'thriller' },
  { label: 'Horror', value: 'horror' },
  { label: 'Suspense', value: 'suspense' },
  { label: 'Non-fiction', value: 'non-fiction' },
  { label: "Children's Books", value: 'children-s-books' },
  { label: 'Historical', value: 'historical' },
  { label: 'History', value: 'history' },
  { label: 'Crime', value: 'crime' },
  { label: 'Ebooks', value: 'ebooks' },
  { label: "Children's", value: 'children-s' },
  { label: 'Chick Lit', value: 'chick-lit' },
  { label: 'Short Stories', value: 'short-stories' },
  { label: 'Nonfiction', value: 'nonfiction' },
  { label: 'Humor', value: 'humor' },
  { label: 'Poetry', value: 'poetry' },
  { label: 'Erotica', value: 'erotica' },
  { label: 'Humor and Comedy', value: 'humor-and-comedy' },
  { label: 'Classics', value: 'classics' },
  { label: 'Gay and Lesbian', value: 'gay-and-lesbian' },
  { label: 'Biography', value: 'biography' },
  { label: 'Childrens', value: 'childrens' },
  { label: 'Memoir', value: 'memoir' },
  { label: 'Adult Fiction', value: 'adult-fiction' },
  { label: 'Biographies & Memoirs', value: 'biographies-memoirs' },
  { label: 'New Adult', value: 'new-adult' },
  { label: 'Gay & Lesbian', value: 'gay-lesbian' },
  { label: 'Womens Fiction', value: 'womens-fiction' },
  { label: 'Science', value: 'science' },
  { label: 'Historical Romance', value: 'historical-romance' },
  { label: 'Cultural', value: 'cultural' },
  { label: 'Vampires', value: 'vampires' },
  { label: 'Urban Fantasy', value: 'urban-fantasy' },
  { label: 'Sports', value: 'sports' },
  { label: 'Religion & Spirituality', value: 'religion-spirituality' },
  { label: 'Paranormal Romance', value: 'paranormal-romance' },
  { label: 'Dystopia', value: 'dystopia' },
  { label: 'Politics', value: 'politics' },
  { label: 'Travel', value: 'travel' },
  { label: 'Christian Fiction', value: 'christian-fiction' },
  { label: 'Philosophy', value: 'philosophy' },
  { label: 'Religion', value: 'religion' },
  { label: 'Autobiography', value: 'autobiography' },
  { label: 'M M Romance', value: 'm-m-romance' },
  { label: 'Cozy Mystery', value: 'cozy-mystery' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Comics & Graphic Novels', value: 'comics-graphic-novels' },
  { label: 'Business', value: 'business' },
  { label: 'Polyamorous', value: 'polyamorous' },
  { label: 'Reverse Harem', value: 'reverse-harem' },
  { label: 'War', value: 'war' },
  { label: 'Writing', value: 'writing' },
  { label: 'Self Help', value: 'self-help' },
  { label: 'Music', value: 'music' },
  { label: 'Art', value: 'art' },
  { label: 'Language', value: 'language' },
  { label: 'Westerns', value: 'westerns' },
  { label: 'BDSM', value: 'bdsm' },
  { label: 'Middle Grade', value: 'middle-grade' },
  { label: 'Western', value: 'western' },
  { label: 'Psychology', value: 'psychology' },
  { label: 'Comics', value: 'comics' },
  { label: 'Romantic Suspense', value: 'romantic-suspense' },
  { label: 'Shapeshifters', value: 'shapeshifters' },
  { label: 'Spirituality', value: 'spirituality' },
  { label: 'Picture Books', value: 'picture-books' },
  { label: 'Holiday', value: 'holiday' },
  { label: 'Animals', value: 'animals' },
  { label: 'Anthologies', value: 'anthologies' },
  { label: 'Menage', value: 'menage' },
  { label: 'Zombies', value: 'zombies' },
  { label: 'Realistic Fiction', value: 'realistic-fiction' },
  { label: 'Reference', value: 'reference' },
  { label: 'LGBT', value: 'lgbt' },
  { label: 'Lesbian Fiction', value: 'lesbian-fiction' },
  { label: 'Food and Drink', value: 'food-and-drink' },
  { label: 'Mystery Thriller', value: 'mystery-thriller' },
  { label: 'Outdoors & Nature', value: 'outdoors-nature' },
  { label: 'Christmas', value: 'christmas' },
  { label: 'Sequential Art', value: 'sequential-art' },
  { label: 'Novels', value: 'novels' },
  { label: 'Military Fiction', value: 'military-fiction' },
] as const;

const yearOptions = [
  { label: 'All', value: '' },
  { label: '1977 and earlier', value: '1977' },
  ...Array.from({ length: 2026 - 1978 + 1 }, (_, i) => {
    const year = String(1978 + i);
    return { label: year, value: year };
  }),
] as const;

class ReadFromPlugin implements Plugin.PluginBase {
  id = 'readfrom';
  name = 'Read From Net';
  icon = 'src/en/readfrom/icon.png';
  site = 'https://readfrom.net/';
  version = '1.2.0';
  filters = {
    genre: {
      type: FilterTypes.Picker,
      label: 'Genre',
      value: '',
      options: genreOptions,
    },
    year: {
      type: FilterTypes.Picker,
      label: 'Year',
      value: '',
      options: yearOptions,
    },
  } satisfies Filters;
  headers = new Headers(pluginHeaders);
  imageRequestInit: Plugin.ImageRequestInit = {
    headers: pluginHeaders,
  };

  //flag indicates whether access to LocalStorage, SesesionStorage is required.
  webStorageUtilized?: boolean;

  loadedNovelCache: (Plugin.NovelItem & {
    summary: string;
    genres: string;
    author: string;
  })[] = [];

  parseNovels(
    loadedCheerio: CheerioAPI,
    isSearch?: boolean,
  ): (Plugin.NovelItem & {
    summary: string;
    genres: string;
    author: string;
  })[] {
    const ret = loadedCheerio(
      (isSearch ? 'div.text' : '#dle-content') + ' > article.box',
    )
      .map((i, el) => {
        const $el = loadedCheerio(el);
        const novelPath = $el.find('h2.title a').attr('href');
        if (!novelPath) return;
        const summary = loadedCheerio(el).find(
          isSearch ? 'div.text5' : 'div.text3',
        )[0];
        loadedCheerio(summary).find('.coll-ellipsis').remove();
        loadedCheerio(summary).find('a').remove();
        return {
          name: loadedCheerio(el).find('h2.title').text().trim(),
          path: new URL(novelPath, this.site).pathname.substring(1),
          cover: loadedCheerio(el).find('img').attr('src') || defaultCover,
          summary:
            loadedCheerio(summary).text().trim() +
            loadedCheerio(summary).find('span.coll-hidden').text(),
          genres: loadedCheerio(el)
            .find(isSearch ? 'h5.title > a' : 'h2 > a')
            .filter((i, el) => el.attribs['title']?.startsWith?.('Genre - '))
            .map((i, el) => loadedCheerio(el).text())
            .toArray()
            .join(', '),
          author: isSearch
            ? loadedCheerio(el)
                .find('h5.title > a')
                .filter((i, el) =>
                  el.attribs['title']?.startsWith?.('Book author - '),
                )
                .text()
            : loadedCheerio(el).find('h4 > a').text(),
        };
      })
      .toArray();

    this.loadedNovelCache.push(...ret);
    while (this.loadedNovelCache.length > 100) {
      this.loadedNovelCache.shift();
    }

    return ret;
  }

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ) {
    // Genre and Year are separate browse paths on the site (not combinable
    // query params), so when either is set it replaces the normal
    // allbooks/last_added_books toggle entirely. Genre takes priority if
    // both somehow end up set, since there's no evidence the site supports
    // a combined genre+year path.
    let basePath: string;
    if (filters?.genre?.value) {
      basePath = filters.genre.value;
    } else if (filters?.year?.value) {
      basePath = filters.year.value;
    } else {
      basePath = showLatestNovels ? 'last_added_books' : 'allbooks';
    }

    const res = await fetchApi(`${this.site}${basePath}/page/${pageNo}`, {
      headers: this.headers,
    });
    const text = await res.text();
    return this.parseNovels(loadCheerio(text));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const data = await fetchApi(this.site + novelPath, {
      headers: this.headers,
    });
    const text = await data.text();
    const loadedCheerio = loadCheerio(text);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: 'Untitled',
    };

    novel.name = loadedCheerio('center > h2.title')
      .text()
      .split(', \n\n')[0]
      .trim();
    novel.cover =
      loadedCheerio('article.box > div > center > div > a > img').attr('src') ||
      defaultCover;

    const rawChapters = loadedCheerio('div.pages')
      .first()
      .find('> a')
      .toArray()
      .flatMap(el => {
        const href = loadedCheerio(el).attr('href');
        if (!href) return [];

        const path = new URL(href, this.site).pathname.substring(1);
        return path ? [{ name: loadedCheerio(el).text().trim(), path }] : [];
      });

    novel.chapters = [
      { name: '1', path: novelPath, chapterNumber: 1 },
      ...rawChapters.map((ch, i) => ({ ...ch, chapterNumber: i + 2 })),
    ];

    let moreNovelInfo = this.loadedNovelCache.find(
      novel => novel.path === novelPath,
    );
    if (!moreNovelInfo)
      moreNovelInfo = (await this.searchNovels(novel.name, 1)).find(
        novel => novel.path === novelPath,
      );
    if (moreNovelInfo) {
      novel.summary = moreNovelInfo.summary;
      novel.genres = moreNovelInfo.genres;
      novel.author = moreNovelInfo.author;
    }

    const seriesElm = loadedCheerio('center > b:has(a)').filter((i, el) =>
      loadedCheerio(el).find('a').attr('href')!.startsWith('/series.html'),
    )[0];

    if (seriesElm) {
      const seriesText = loadedCheerio(seriesElm).text().trim();

      novel.summary = seriesText + '\n\n' + novel.summary;
    }

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const response = await fetchApi(this.site + chapterPath, {
      headers: this.headers,
    });
    const $ = loadCheerio(await response.text());
    $('#textToRead > span:empty, #textToRead > center').remove();

    const chapterHtml: string[] = [];
    let p: string[] = [];

    const allowed = new Set(['b', 'i', 'u', 'strong', 'em', 'a']);
    const flush = () =>
      p.length && (chapterHtml.push(`<p>${p.join(' ').trim()}</p>`), (p = []));

    for (const el of $('#textToRead').contents().toArray()) {
      switch (el.type) {
        case 'comment':
          continue;
        case 'text':
          if (el.data.trim()) {
            // Convert _text_ to <i>text</i>
            const jbText = el.data.trim().replace(/_([^_]+)_/g, '<i>$1</i>');
            p.push(jbText);
          }
          continue;
        case 'tag':
          if (allowed.has(el.name)) {
            p.push($.html(el));
            continue;
          }
          if (el.name === 'br') {
            flush();
            continue;
          }
      }
      flush();
      chapterHtml.push($.html(el));
    }

    flush();
    return chapterHtml.join('');
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    if (pageNo !== 1) return [];
    const res = await fetchApi(
      'https://readfrom.net/build_in_search/?q=' +
        encodeURIComponent(searchTerm),
      { headers: this.headers },
    );
    const text = await res.text();
    return this.parseNovels(loadCheerio(text), true);
  }

  // resolveUrl = (path: string, isNovel?: boolean) => this.site + '/' + path;
}

export default new ReadFromPlugin();

import type { ArticleBlock, Locale, Localized } from "../types";

/**
 * Зеркалирование английской и русской версии публикации.
 *
 * Правила:
 *  • Структура блоков (набор, типы, порядок, id) всегда одинакова в обеих вкладках.
 *  • Технические поля — путь к картинке и адрес ссылки — общие: на сервере лежит
 *    один и тот же файл, ссылка ведёт туда же.
 *  • Текстовые поля копируются в одну сторону — из исходной (английской) версии
 *    в русскую, то есть у русской версии изначально стоит английский текст. Как
 *    только текст перевели вручную — он больше не перезаписывается. Правка
 *    перевода никогда не меняет оригинал.
 *  • Пустое поле заполняется из соседней версии в любую сторону: так русский
 *    текст попадёт в англоязычную вкладку, если её включили уже после набора.
 */

/** Версия-источник: её текст копируется в перевод. */
const SOURCE_LOCALE: Locale = "en";

/** Поля, которые всегда одинаковы в обеих версиях. */
const SHARED_KEYS = ["src", "url", "albumUrl", "style", "code"] as const;

/** Поля, которые копируются, пока их не перевели вручную. */
const TEXT_KEYS = ["text", "markdown", "alt", "label"] as const;

type AnyBlock = Record<string, unknown>;

function asRecord(block: ArticleBlock): AnyBlock {
  return block as unknown as AnyBlock;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "ru" : "en";
}

function cloneBlock(block: ArticleBlock): ArticleBlock {
  return { ...block } as ArticleBlock;
}

/**
 * Подбирает для каждого блока из `next` пару в `target`:
 * сначала по id, затем — для старых публикаций с разными id — по позиции и типу.
 */
function alignBlocks(next: ArticleBlock[], target: ArticleBlock[]): (ArticleBlock | undefined)[] {
  const used = new Set<string>();
  const byId = new Map(target.map((b) => [b.id, b]));

  const first = next.map((block) => {
    const hit = byId.get(block.id);
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      return hit;
    }
    return undefined;
  });

  return first.map((hit, i) => {
    if (hit) return hit;
    const positional = target[i];
    if (positional && positional.type === next[i].type && !used.has(positional.id)) {
      used.add(positional.id);
      return positional;
    }
    return undefined;
  });
}

function mergeBlock(
  nextBlock: ArticleBlock,
  prevBlock: ArticleBlock | undefined,
  targetBlock: ArticleBlock | undefined,
  fromSource: boolean,
): ArticleBlock {
  // Блока во второй версии ещё нет либо тип поменяли — берём полную копию.
  if (!targetBlock || targetBlock.type !== nextBlock.type) return cloneBlock(nextBlock);

  const src = asRecord(nextBlock);
  const prev = prevBlock ? asRecord(prevBlock) : undefined;
  const dst: AnyBlock = { ...asRecord(targetBlock), id: nextBlock.id };

  for (const key of SHARED_KEYS) {
    if (key in src) dst[key] = src[key];
    else delete dst[key];
  }

  for (const key of TEXT_KEYS) {
    if (!(key in src)) continue;
    const empty = dst[key] === undefined || dst[key] === "";
    // Пустое поле дозаполняем всегда, «ещё не переведённое» — только из оригинала.
    const untouched = empty || (fromSource && prev !== undefined && dst[key] === prev[key]);
    if (untouched) dst[key] = src[key];
  }

  return dst as unknown as ArticleBlock;
}

/**
 * Приводит блоки второй языковой версии к структуре редактируемой.
 * @param prev   блоки редактируемой версии до изменения
 * @param next   блоки редактируемой версии после изменения
 * @param target блоки соседней версии
 * @param locale какую версию сейчас редактируют (по умолчанию исходную)
 */
export function syncBlocks(
  prev: ArticleBlock[],
  next: ArticleBlock[],
  target: ArticleBlock[],
  locale: Locale = SOURCE_LOCALE,
): ArticleBlock[] {
  const aligned = alignBlocks(next, target);
  const prevById = new Map(prev.map((b) => [b.id, b]));
  const fromSource = locale === SOURCE_LOCALE;
  return next.map((block, i) => mergeBlock(block, prevById.get(block.id) ?? prev[i], aligned[i], fromSource));
}

/**
 * Копирует текст в соседнюю вкладку. Из оригинала — пока перевод не правили
 * вручную; из перевода — только если оригинал ещё пуст.
 */
export function mirrorText(value: Localized, locale: Locale, nextValue: string): Localized {
  const other = otherLocale(locale);
  const prevValue = value[locale];
  const otherValue = value[other];
  const empty = !otherValue;
  const untouched = empty || (locale === SOURCE_LOCALE && otherValue === prevValue);
  return { ...value, [locale]: nextValue, ...(untouched ? { [other]: nextValue } : {}) } as Localized;
}

/** Полная копия блоков (используется при создании публикации). */
export function copyBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  return blocks.map(cloneBlock);
}

/** Гарантирует одинаковую структуру обеих версий (например, у старых карточек). */
export function alignPublicationBlocks(
  blocks: { en: ArticleBlock[]; ru: ArticleBlock[] },
  source: Locale = "en",
): { en: ArticleBlock[]; ru: ArticleBlock[] } {
  const from = blocks[source] ?? [];
  const to = blocks[otherLocale(source)] ?? [];
  if (!from.length) return { en: blocks.en ?? [], ru: blocks.ru ?? [] };
  const synced = syncBlocks(from, from, to);
  return source === "en" ? { en: from, ru: synced } : { en: synced, ru: from };
}

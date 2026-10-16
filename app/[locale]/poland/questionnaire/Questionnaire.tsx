'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Answers } from '@/lib/calc/types';
import { assessResidency } from '@/lib/calc/residency';
import { compareScenarios } from '@/lib/calc/scenarios';
import { visibleScreens, isScreenComplete, resumeIndex, type Draft } from '@/lib/questions/schema';
import { decodeAnswers, encodeAnswers, isPrefill } from '@/lib/share';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';
import { Question } from '@/components/Question';
import { Progress } from '@/components/Progress';
import { ResidencyVerdict } from '@/components/ResidencyVerdict';
import { ScenarioCard } from '@/components/ScenarioCard';
import { ComparisonTable, RiskNote } from '@/components/ComparisonTable';
import { flushSync } from 'react-dom';
import { Disclaimer } from '@/components/Disclaimer';
import { EmailCta } from '@/components/EmailCta';
import { useT } from '@/components/I18nProvider';
import button from '@/components/Button.module.css';
import motion from '@/components/Motion.module.css';
import ruled from '@/components/Ruled.module.css';
import styles from './page.module.css';

/** Позиція в черзі появи (`Motion.module.css`). */
const at = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Зміна кроку через View Transitions API: браузер знімає стару картку, React
 * синхронно рендерить нову, і CSS (`::view-transition-*(step)` у globals.css)
 * анімує заміну. Без API (Firefox, jsdom) або з «зменшити рух» — звичайна
 * миттєва зміна.
 */
function stepTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

/**
 * Анкета й результат — клієнтські: відповіді не залишають вкладку (ADR-0002).
 * Адресу сторінки задає `page.tsx` поруч; шеринг і «Пройти заново» беруть
 * поточний шлях, тож лінк веде туди, де людина є, з мовою включно.
 */
export function Questionnaire() {
  const t = useT();
  const [answers, setAnswers] = useState<Draft>({});
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [shareNote, setShareNote] = useState(false);
  // Прогрес не має відкочуватись назад, коли змінилась лише кількість екранів
  // (зʼявився/зник умовний крок), а не позиція користувача.
  const progressRef = useRef({ index: 0, percent: 0 });

  // Відновлення: спершу лінк (шеринг або передзаповнення), інакше — прогрес сесії.
  useEffect(() => {
    const query = window.location.search.replace(/^\?/, '');
    const fromLink = decodeAnswers(query);
    if (Object.keys(fromLink).length > 0 && isPrefill(query)) {
      // Зі сторінки-відповіді: анкета з першого кроку з уже вибраним. Query
      // знімається одразу, інакше F5 посеред анкети скинув би нові відповіді
      // назад до передзаповнених.
      setAnswers(fromLink);
      window.history.replaceState(null, '', window.location.pathname);
    } else if (Object.keys(fromLink).length > 0) {
      setAnswers(fromLink);
      setDone(true);
    } else {
      const { answers: saved, step } = loadDraft();
      setAnswers(saved);
      setIndex(resumeIndex(saved, step));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !done) saveDraft(answers, index);
  }, [answers, index, hydrated, done]);

  const screens = useMemo(() => visibleScreens(answers), [answers]);
  const screen = screens[Math.min(index, screens.length - 1)];
  const canAdvance = screen ? isScreenComplete(screen, answers) : false;
  const isLast = index >= screens.length - 1;

  function update(name: keyof Answers, value: unknown) {
    setAnswers((prev) => ({ ...prev, [name]: value }));
  }

  function next() {
    if (!canAdvance) return;
    if (isLast) setDone(true);
    else stepTransition(() => setIndex((i) => i + 1));
  }

  function back() {
    if (done) setDone(false);
    else stepTransition(() => setIndex((i) => Math.max(0, i - 1)));
  }

  function restart() {
    clearDraft();
    setAnswers({});
    setIndex(0);
    setDone(false);
    window.history.replaceState(null, '', window.location.pathname);
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}?${encodeAnswers(answers as Answers)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote(true);
      window.setTimeout(() => setShareNote(false), 4000);
    } catch {
      window.history.replaceState(null, '', url);
    }
  }

  if (!hydrated) return <Skeleton />;

  if (done) {
    return <Result answers={answers as Answers} onRestart={restart} onShare={share} shareNote={shareNote} />;
  }

  const rawPercent = screens.length > 0 ? Math.round(((index + 1) / screens.length) * 100) : 0;
  // Та сама позиція + більше екранів = не відкочуємось; зміна кроку рухає нормально.
  const percent = index === progressRef.current.index ? Math.max(rawPercent, progressRef.current.percent) : rawPercent;
  progressRef.current = { index, percent };

  return (
    <main>
      <Progress percent={percent} />

      {/* Зміна кроку озвучується, бо заголовок міняється без переходу сторінки. */}
      <div aria-live="polite">
        {screen && <Question key={screen.id} screen={screen} answers={answers} onChange={update} />}
      </div>

      <nav className={styles.nav}>
        <button type="button" className={`${button.secondary} ${button.back}`} onClick={back} disabled={index === 0}>
          {t('nav.back')}
        </button>
        <button type="button" className={`${button.primary} ${button.arrow}`} onClick={next} disabled={!canAdvance}>
          {isLast ? t('nav.showResult') : t('nav.next')}
        </button>
      </nav>
    </main>
  );
}

/**
 * Поки сторінка не знає, що показати (чернетка в sessionStorage і відповіді з
 * лінка читаються лише в браузері), — нейтральні обриси: надрядок, заголовок,
 * аркуш. Вони підходять і кроку анкети, і результату за лінком «Поділитися»,
 * тож жоден із двох не підміняє форму іншого.
 */
function Skeleton() {
  const t = useT();
  return (
    <main aria-busy="true" aria-label={t('questionnaire.loading')}>
      <div aria-hidden="true">
        <span className={styles.skeletonLine} style={{ width: '18%' }} />
        <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} style={{ width: '60%' }} />
        <div className={`${ruled.inkEdge} ${ruled.sheet} ${styles.skeletonCard}`}>
          <span className={styles.skeletonLine} style={{ width: '40%' }} />
          <span className={styles.skeletonBlock} />
          <span className={styles.skeletonBlock} />
          <span className={styles.skeletonBlock} />
        </div>
      </div>
    </main>
  );
}

function Result({
  answers,
  onRestart,
  onShare,
  shareNote,
}: {
  answers: Answers;
  onRestart: () => void;
  onShare: () => void;
  shareNote: boolean;
}) {
  const t = useT();
  const residency = assessResidency(answers);
  const scenarios = compareScenarios(answers);

  /*
   * Дашборд: на ПК дві рівні колонки — ліворуч вердикт і пояснення ризику,
   * праворуч таблиця порівняння; деталі — на всю ширину; внизу ліворуч
   * дисклеймер і кнопки, праворуч лист очікування. На телефоні — порядок
   * розмітки стовпчиком: пояснення ризику одразу під таблицею. Рух — лише в заголовках і лінійках: цифри, позначки ризику й
   * дисклеймер стоять із першого кадру (DECISIONS 2026-10-12).
   */
  return (
    <main aria-live="polite" className={styles.result}>
      <header className={styles.resultHead}>
        <p className={`${motion.reveal} ${styles.resultEyebrow}`} style={at(0)}>
          {t('result.eyebrow')}
        </p>
        <h1 className={`${motion.reveal} ${styles.resultTitle}`} style={at(1)}>
          {t('result.title')}
        </h1>
      </header>

      <div className={styles.dashboard}>
        <div className={styles.verdict}>
          <ResidencyVerdict result={residency} />
        </div>
        <div className={styles.compare}>
          <ComparisonTable scenarios={scenarios} />
        </div>
        <div className={styles.note}>
          <RiskNote />
        </div>

        <section className={styles.details} aria-labelledby="details-heading">
          <h2 id="details-heading" className={`${motion.soft} ${styles.detailsHeading}`} style={at(6)}>
            {t('scenarios.detailsTitle')}
          </h2>
          <div className={`${ruled.inkRule} ${ruled.sheet} ${styles.cards}`}>
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
        </section>

        {/* Повний список джерел — у шапці («Джерела»); тут джерела стоять біля
            своїх висновків у картках. */}
        <div className={styles.closing}>
          <div className={styles.disclaimer}>
            <Disclaimer />
          </div>

          <div className={styles.actions}>
            <nav className={styles.nav}>
              <button type="button" className={button.secondary} onClick={onRestart}>
                {t('nav.restart')}
              </button>
              <button type="button" className={button.primary} onClick={onShare}>
                {t('nav.share')}
              </button>
            </nav>
            <p aria-live="polite" className={styles.shareNote}>
              {shareNote ? (
                <span key="copied" className={motion.soft}>
                  {t('nav.shareCopied')}
                </span>
              ) : (
                ''
              )}
            </p>
          </div>

          <EmailCta />
        </div>
      </div>
    </main>
  );
}

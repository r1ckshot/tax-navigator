'use client';

import { useEffect, useMemo, useState } from 'react';
import { t } from '@/lib/i18n/uk';
import type { Answers } from '@/lib/calc/types';
import { assessResidency } from '@/lib/calc/residency';
import { compareScenarios } from '@/lib/calc/scenarios';
import { visibleScreens, isScreenComplete, resumeIndex, type Draft } from '@/lib/questions/schema';
import { decodeAnswers, encodeAnswers } from '@/lib/share';
import { clearDraft, loadDraft, saveDraft } from '@/lib/storage';
import { Question } from '@/components/Question';
import { Progress } from '@/components/Progress';
import { ResidencyVerdict } from '@/components/ResidencyVerdict';
import { ScenarioCard } from '@/components/ScenarioCard';
import { TakeHomeChart } from '@/components/TakeHomeChart';
import { Disclaimer } from '@/components/Disclaimer';
import { EmailCta } from '@/components/EmailCta';
import styles from './page.module.css';

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Draft>({});
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [shareNote, setShareNote] = useState(false);

  // Відновлення: спершу лінк (шеринг), інакше — прогрес сесії.
  useEffect(() => {
    const fromLink = decodeAnswers(window.location.search.replace(/^\?/, ''));
    if (Object.keys(fromLink).length > 0) {
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
    else setIndex((i) => i + 1);
  }

  function back() {
    if (done) setDone(false);
    else setIndex((i) => Math.max(0, i - 1));
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

  if (!hydrated) return <main />;

  if (done) {
    return <Result answers={answers as Answers} onRestart={restart} onShare={share} shareNote={shareNote} />;
  }

  return (
    <main>
      <Progress current={index + 1} total={screens.length} />

      {/* Зміна кроку озвучується, бо заголовок міняється без переходу сторінки. */}
      <div aria-live="polite">
        {screen && <Question key={screen.id} screen={screen} answers={answers} onChange={update} />}
      </div>

      <nav className={styles.nav}>
        <button type="button" onClick={back} disabled={index === 0}>
          {t('nav.back')}
        </button>
        <button type="button" data-variant="primary" onClick={next} disabled={!canAdvance}>
          {isLast ? t('nav.showResult') : t('nav.next')}
        </button>
      </nav>
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
  const residency = assessResidency(answers);
  const scenarios = compareScenarios(answers);

  return (
    <main aria-live="polite">
      <ResidencyVerdict result={residency} />

      <h2>{t('scenarios.title')}</h2>
      <p className={styles.subtitle}>{t('scenarios.subtitle')}</p>

      <TakeHomeChart scenarios={scenarios} />

      <div className={styles.cards}>
        {scenarios.map((s) => (
          <ScenarioCard key={s.id} scenario={s} />
        ))}
      </div>

      <Disclaimer />

      <nav className={styles.nav}>
        <button type="button" onClick={onRestart}>
          {t('nav.restart')}
        </button>
        <button type="button" data-variant="primary" onClick={onShare}>
          {t('nav.share')}
        </button>
      </nav>
      <p aria-live="polite" className={styles.shareNote}>
        {shareNote ? t('nav.shareCopied') : ''}
      </p>

      <EmailCta />
    </main>
  );
}

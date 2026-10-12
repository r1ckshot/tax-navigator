'use client';

import { useEffect, type CSSProperties } from 'react';
import { useT } from './I18nProvider';
import type { Answers } from '@/lib/calc/types';
import { snapToStep } from '@/lib/calc/quantize';
import type { Draft, Field, Screen, SliderConfig } from '@/lib/questions/schema';
import { visibleFields } from '@/lib/questions/schema';
import { formatMoney } from '@/lib/format';
import motion from './Motion.module.css';
import styles from './Question.module.css';

/** Позиція в черзі появи кроку (`Motion.module.css`, `.soft`). */
const at = (i: number) => ({ '--i': i }) as CSSProperties;

/** Скільки позицій у черзі займає поле: питання + варіанти, або чотири рядки слайдера. */
const slots = (field: Field) => (field.kind === 'slider' ? 4 : 1 + field.options!.length);

interface Props {
  screen: Screen;
  answers: Draft;
  onChange: (name: keyof Answers, value: unknown) => void;
}

/**
 * Крок проявляється по черзі: надрядок → питання → кожен варіант → наступне
 * питання → його варіанти. Черга наскрізна для всього кроку, тож друге питання
 * не стартує разом із першим.
 */
export function Question({ screen, answers, onChange }: Props) {
  const t = useT();
  const fields = visibleFields(screen, answers);
  const starts = fields.map((_, i) => 1 + fields.slice(0, i).reduce((n, f) => n + slots(f), 0));
  return (
    <section className={styles.screen}>
      {/* Категорія кроку лишається h1 (семантика заголовка), але візуально — дрібний
          акцентний надрядок; головний візуальний акцент на самому питанні нижче. */}
      <h1 className={`${motion.soft} ${styles.eyebrow}`} style={at(0)}>
        {t(screen.titleKey)}
      </h1>
      {fields.map((field, i) => (
        <FieldControl key={field.name} field={field} answers={answers} onChange={onChange} start={starts[i]} />
      ))}
    </section>
  );
}

function FieldControl({ field, answers, onChange, start }: { field: Field; start: number } & Omit<Props, 'screen'>) {
  const t = useT();
  const current = answers[field.name];

  if (field.kind === 'slider') {
    return <SliderField field={field} value={current as number | undefined} onChange={onChange} start={start} />;
  }

  // fieldset/legend — щоб зчитувач озвучив питання разом із варіантами.
  return (
    <fieldset className={styles.fieldset}>
      <legend className={`${motion.soft} ${styles.legend}`} style={at(start)}>
        {t(field.labelKey)}
      </legend>
      <div className={styles.options}>
        {field.options!.map((option, i) => {
          const id = `${field.name}-${String(option.value)}`;
          return (
            <label key={id} className={`${motion.soft} ${styles.option}`} htmlFor={id} style={at(start + 1 + i)}>
              <input
                id={id}
                type="radio"
                name={field.name}
                checked={current === option.value}
                onChange={() => onChange(field.name, option.value)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Будь-яке число → найближчий крок у межах слайдера. */
function snap(value: number, cfg: SliderConfig): number {
  return snapToStep(value, { min: cfg.min, max: cfg.max, step: cfg.step, fallback: cfg.default });
}

/**
 * Універсальний слайдер (виручка, кількість днів…): жодного ручного вводу.
 * Позиція має стартове значення, тож екран одразу «повний» — користувач приймає
 * або коригує. Точного «сирого» числа немає за конструкцією.
 */
function SliderField({
  field,
  value,
  onChange,
  start,
}: {
  field: Field;
  value: number | undefined;
  onChange: Props['onChange'];
  start: number;
}) {
  const t = useT();
  const cfg = field.slider!;

  useEffect(() => {
    if (value === undefined) onChange(field.name, cfg.default);
  }, [value, field.name, cfg.default, onChange]);

  const shown = value ?? cfg.default;
  const atMax = Boolean(cfg.openEnded) && shown >= cfg.max;
  const unit = t(cfg.unitKey);
  // Частка заливки треку — щоб пройдена частина фарбувалась акцентом (webkit).
  const fill = ((shown - cfg.min) / (cfg.max - cfg.min)) * 100;

  return (
    <div className={styles.sliderField}>
      <label htmlFor={field.name} className={`${motion.soft} ${styles.sliderLabel}`} style={at(start)}>
        {t(field.labelKey)}
      </label>

      <output className={`${motion.soft} ${styles.sliderValue}`} htmlFor={field.name} style={at(start + 1)}>
        {formatMoney(shown)}
        {atMax ? '+' : ''} <span className={styles.sliderUnit}>{unit}</span>
      </output>

      <input
        id={field.name}
        type="range"
        className={`${motion.soft} ${styles.slider}`}
        style={{ '--fill': `${fill}%`, '--i': start + 2 } as CSSProperties}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={shown}
        aria-valuetext={`${formatMoney(shown)}${atMax ? '+' : ''} ${unit}`}
        onChange={(e) => onChange(field.name, snap(Number(e.target.value), cfg))}
      />

      <div className={`${motion.soft} ${styles.sliderScale}`} aria-hidden="true" style={at(start + 3)}>
        <span>{formatMoney(cfg.min)}</span>
        <span>
          {formatMoney(cfg.max)}
          {cfg.openEnded ? '+' : ''}
        </span>
      </div>
    </div>
  );
}

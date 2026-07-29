'use client';

import { useEffect, type CSSProperties } from 'react';
import { t } from '@/lib/i18n/uk';
import type { Answers } from '@/lib/calc/types';
import { snapToStep } from '@/lib/calc/quantize';
import type { Draft, Field, Screen, SliderConfig } from '@/lib/questions/schema';
import { visibleFields } from '@/lib/questions/schema';
import { formatMoney } from '@/lib/format';
import styles from './Question.module.css';

interface Props {
  screen: Screen;
  answers: Draft;
  onChange: (name: keyof Answers, value: unknown) => void;
}

export function Question({ screen, answers, onChange }: Props) {
  return (
    <section className={styles.screen}>
      {/* Категорія кроку лишається h1 (семантика заголовка), але візуально — дрібний
          акцентний надрядок; головний візуальний акцент на самому питанні нижче. */}
      <h1 className={styles.eyebrow}>{t(screen.titleKey)}</h1>
      {visibleFields(screen, answers).map((field) => (
        <FieldControl key={field.name} field={field} answers={answers} onChange={onChange} />
      ))}
    </section>
  );
}

function FieldControl({ field, answers, onChange }: { field: Field } & Omit<Props, 'screen'>) {
  const current = answers[field.name];

  if (field.kind === 'slider') {
    return <SliderField field={field} value={current as number | undefined} onChange={onChange} />;
  }

  // fieldset/legend — щоб зчитувач озвучив питання разом із варіантами.
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t(field.labelKey)}</legend>
      <div className={styles.options}>
        {field.options!.map((option) => {
          const id = `${field.name}-${String(option.value)}`;
          return (
            <label key={id} className={styles.option} htmlFor={id}>
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
}: {
  field: Field;
  value: number | undefined;
  onChange: Props['onChange'];
}) {
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
      <label htmlFor={field.name} className={styles.sliderLabel}>
        {t(field.labelKey)}
      </label>

      <output className={styles.sliderValue} htmlFor={field.name}>
        {formatMoney(shown)}
        {atMax ? '+' : ''} <span className={styles.sliderUnit}>{unit}</span>
      </output>

      <input
        id={field.name}
        type="range"
        className={styles.slider}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={shown}
        aria-valuetext={`${formatMoney(shown)}${atMax ? '+' : ''} ${unit}`}
        onChange={(e) => onChange(field.name, snap(Number(e.target.value), cfg))}
      />

      <div className={styles.sliderScale} aria-hidden="true">
        <span>{formatMoney(cfg.min)}</span>
        <span>
          {formatMoney(cfg.max)}
          {cfg.openEnded ? '+' : ''}
        </span>
      </div>
    </div>
  );
}

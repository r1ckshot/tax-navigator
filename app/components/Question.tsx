'use client';

import { t } from '@/lib/i18n/uk';
import type { Answers } from '@/lib/calc/types';
import type { Draft, Field, Screen } from '@/lib/questions/schema';
import { visibleFields, validateRevenue } from '@/lib/questions/schema';
import styles from './Question.module.css';

interface Props {
  screen: Screen;
  answers: Draft;
  onChange: (name: keyof Answers, value: unknown) => void;
}

export function Question({ screen, answers, onChange }: Props) {
  return (
    <section className={styles.screen}>
      <h1>{t(screen.titleKey)}</h1>
      {visibleFields(screen, answers).map((field) => (
        <FieldControl key={field.name} field={field} answers={answers} onChange={onChange} />
      ))}
    </section>
  );
}

function FieldControl({ field, answers, onChange }: { field: Field } & Omit<Props, 'screen'>) {
  const current = answers[field.name];

  if (field.kind === 'number') {
    return <NumberField field={field} value={current as number | undefined} onChange={onChange} />;
  }

  // fieldset/legend — щоб зчитувач озвучив питання разом із варіантами.
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t(field.labelKey)}</legend>
      {field.hintKey && <p className={styles.hint}>{t(field.hintKey)}</p>}
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

function NumberField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: number | undefined;
  onChange: Props['onChange'];
}) {
  const isRevenue = field.name === 'monthlyRevenue';
  const status = isRevenue && value !== undefined ? validateRevenue(value) : 'ok';
  // Перевищення ліміту ричалту — попередження, а не блокування: інші підформи
  // лишаються придатними, і мовчки прораховувати їх було б гірше.
  const isError = status === 'notANumber' || status === 'tooLow';
  const errorId = `${field.name}-error`;

  return (
    <div className={styles.numberField}>
      <label htmlFor={field.name}>{t(field.labelKey)}</label>
      {field.hintKey && <p className={styles.hint}>{t(field.hintKey)}</p>}
      <input
        id={field.name}
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ''}
        aria-invalid={isError || undefined}
        aria-describedby={status !== 'ok' ? errorId : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(field.name, raw === '' ? undefined : Number(raw));
        }}
      />
      {status !== 'ok' && (
        <p id={errorId} className={styles.error} data-severity={isError ? 'error' : 'warning'} role="alert">
          {t(`error.${status}`)}
        </p>
      )}
    </div>
  );
}

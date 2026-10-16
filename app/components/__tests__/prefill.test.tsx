/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Questionnaire as QuestionnairePage } from '@/[locale]/poland/questionnaire/Questionnaire';
import { encodeAnswers } from '@/lib/share';
import { loadDraft } from '@/lib/storage';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { q, t } from '@/lib/__tests__/plain';

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

const open = (search: string) => {
  window.history.replaceState(null, '', `/uk/poland/questionnaire${search}`);
  render(<QuestionnairePage />);
};

describe('анкета з передзаповненням', () => {
  it('відкривається з першого кроку, а не результатом; відповідь сторінки вже в чернетці', async () => {
    open('?w=programming&start=1');

    expect(await screen.findByText(q('q.days.label'))).toBeDefined();
    expect(screen.queryByText(q('residency.plResident'))).toBeNull();
    expect(screen.getByRole('button', { name: t('nav.back') }).hasAttribute('disabled')).toBe(true);
    expect(loadDraft().answers).toEqual({ workKind: 'programming' });
  });

  // Інакше F5 посеред анкети скинув би нові відповіді до передзаповнених.
  it('query знімається з адреси одразу після відкриття', async () => {
    open('?w=programming&start=1');
    await screen.findByText(q('q.days.label'));
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/uk/poland/questionnaire');
  });

  it('share-лінк без позначки, як і раніше, показує результат', async () => {
    open(`?${encodeAnswers(baseAnswers)}`);
    expect(await screen.findByText(q('residency.plResident'))).toBeDefined();
  });
});

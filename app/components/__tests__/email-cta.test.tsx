/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmailCta } from '@/components/EmailCta';
import { t } from '@/lib/i18n/uk';

afterEach(cleanup);

describe('EmailCta', () => {
  it('без форми показує «Скоро» і жодного посилання', () => {
    render(<EmailCta href={null} />);
    expect(screen.getByText(t('cta.soon'))).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('з формою веде на неї в новій вкладці й називає, куди йде email', () => {
    render(<EmailCta href="https://tally.so/r/abc123" />);
    const link = screen.getByRole('link', { name: t('cta.action') });
    expect(link.getAttribute('href')).toBe('https://tally.so/r/abc123');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(t('cta.note'))).toBeTruthy();
    expect(screen.queryByText(t('cta.soon'))).toBeNull();
  });
});

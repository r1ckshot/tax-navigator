import { describe, expect, it } from 'vitest';
import { assessZus } from '../zus';
import { calcJdg } from '../scenarios/jdg';
import { withAnswers } from './fixtures';

describe('ZUS — пріоритет рішень', () => {
  it('паралельний етат (zbieg tytułów) перекриває все інше', () => {
    const r = assessZus(
      withAnswers({ hasParallelUop: true, jdgStatus: 'gt30', hadJdgInLast60Months: true, formerEmployer: 'identical' })
    );
    expect(r.stage).toBe('zbiegOnlyHealth');
    expect(r.socialMonthly).toBe(0);
  });

  it('історія JDG за 60 міс знімає право на ulga na start', () => {
    expect(assessZus(withAnswers({ jdgStatus: 'none', hadJdgInLast60Months: false })).stage).toBe('ulgaNaStart');
    const blocked = assessZus(withAnswers({ jdgStatus: 'none', hadJdgInLast60Months: true }));
    expect(blocked.stage).toBe('duzy');
    expect(blocked.socialMonthly).toBe(1926.76);
  });

  it('етапи за віком діяльності', () => {
    expect(assessZus(withAnswers({ jdgStatus: 'lt6' })).socialMonthly).toBe(0);
    expect(assessZus(withAnswers({ jdgStatus: 'from6to30' })).socialMonthly).toBe(456.18);
    expect(assessZus(withAnswers({ jdgStatus: 'gt30' })).socialMonthly).toBe(1926.76);
  });

  it('добровільна хворобова змінює preferencyjny', () => {
    expect(assessZus(withAnswers({ jdgStatus: 'from6to30', voluntarySickness: false })).socialMonthly).toBe(420.86);
  });
});

describe('były pracodawca — два РІЗНІ тести', () => {
  it('частковий збіг: пільговий ZUS втрачено, але ричалт лишається', () => {
    const answers = withAnswers({ formerEmployer: 'partial', jdgStatus: 'from6to30' });
    expect(assessZus(answers).stage).toBe('duzy');

    const ryczalt = calcJdg(answers).subforms?.find((s) => s.id === 'ryczalt');
    expect(ryczalt?.available).toBe(true);
  });

  it('тотожні послуги: втрачено і пільговий ZUS, і ричалт', () => {
    const answers = withAnswers({ formerEmployer: 'identical', jdgStatus: 'from6to30' });
    expect(assessZus(answers).stage).toBe('duzy');

    const ryczalt = calcJdg(answers).subforms?.find((s) => s.id === 'ryczalt');
    expect(ryczalt?.available).toBe(false);
    expect(ryczalt?.unavailableReasonKey).toBe('ryczalt.formerEmployer');
  });

  it('без колишнього роботодавця пільга зберігається', () => {
    expect(assessZus(withAnswers({ formerEmployer: 'no', jdgStatus: 'from6to30' })).stage).toBe('preferencyjny');
  });
});

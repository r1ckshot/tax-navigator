import styles from './RouteMap.module.css';

/** Одна крива на два місця: SVG малює її, CSS веде нею точку (`offset-path`). */
const ROUTE = 'M 500 150 C 430 40, 230 30, 120 110';

/**
 * Анімація напряму C: маршрут зі сходу (UA) на захід (PL) прокреслюється, і
 * точка проходить ним до Польщі. Без чисел і без висновків — це знак бренду,
 * а не дані. Тло — точкова сітка, як на карті.
 */
export function RouteMap() {
  return (
    <svg className={styles.map} viewBox="0 0 600 220" role="img" aria-label="UA → PL">
      <defs>
        <pattern id="lab-c-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" className={styles.dot} />
        </pattern>
      </defs>
      <rect width="600" height="220" fill="url(#lab-c-dots)" className={styles.field} />
      <path d={ROUTE} pathLength={1} className={styles.trail} />
      <path d={ROUTE} pathLength={1} className={styles.route} />
      <g className={styles.from}>
        <circle cx="500" cy="150" r="7" />
        <text x="500" y="182">UA</text>
      </g>
      <g className={styles.to}>
        <circle cx="120" cy="110" r="16" className={styles.pulse} />
        <circle cx="120" cy="110" r="7" />
        <text x="120" y="146">PL</text>
      </g>
      <circle r="5" className={styles.traveller} style={{ offsetPath: `path('${ROUTE}')` }} />
    </svg>
  );
}

import styles from './ColorSwatch.module.css';

/**
 * Зразок кольору зі словника: квадрат, імʼя токена і підпис.
 *
 * Колір малюється через `var(name)`, а не через переданий hex: так зразок ролі
 * перемикається разом із темою, як і все інше на сторінці, а зразок палітри
 * показує саме те значення, яке бачить браузер.
 */
export function ColorSwatch({ name, caption }: { name: string; caption: string }) {
  return (
    <figure className={styles.swatch}>
      <span className={styles.chip} style={{ background: `var(${name})` }} aria-hidden="true" />
      <figcaption className={styles.caption}>
        <code className={styles.name}>{name}</code>
        <span className={styles.value}>{caption}</span>
      </figcaption>
    </figure>
  );
}

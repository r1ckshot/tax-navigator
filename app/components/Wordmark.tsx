import { Fragment, type ReactNode } from 'react';
import styles from './Wordmark.module.css';

const NAME = 'nettomap';

/**
 * Знак nettomap: «netto» прямим, «map» курсивом акценту — редакційна пара в
 * одному слові. Текстом, а не картинкою: читається скрінрідером як назва і
 * бере шрифт і колір із ролей, тож темна тема доходить сама. Той самий знак
 * намальовано в `app/icon.svg` (контури Source Serif 4: «n» 600 чорнилом,
 * «m» курсивом 400 акцентом, лінійка під ними; без коментаря у файлі — подвійний
 * дефіс у XML-коментарі робить SVG невалідним, і браузер іконку відкидає) і на
 * OG-картинці.
 *
 * `inline` — у рядку тексту: кегль і вага навколишнього тексту, лише пара
 * прямий/курсив і колір.
 */
export function Wordmark({ inline = false }: { inline?: boolean }) {
  return (
    <span className={inline ? styles.inline : styles.wordmark}>
      netto<em>map</em>
    </span>
  );
}

/**
 * Рядок, де назва бренду стоїть знаком, а не звичайним словом. Лише для тексту
 * на сторінці: у заголовку вкладки й прев'ю назва лишається словом.
 */
export function withWordmark(text: string): ReactNode {
  const parts = text.split(NAME);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <Wordmark inline />}
      {part}
    </Fragment>
  ));
}

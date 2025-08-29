import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export function formatDateTimeTRLocal(dateVal) {
  if (!dateVal) return '';
  try {
    const base = dayjs.utc(dateVal);
    if (!base.isValid()) return '';
    let tz = null;
    try { tz = base.tz('Europe/Istanbul'); } catch (e) { tz = null; }
    const chosen = (tz && tz.isValid() && tz.format('HH') !== base.format('HH')) ? tz : base.add(3, 'hour');
    return chosen.format('DD.MM.YYYY HH.mm');
  } catch (e) {
    return '';
  }
}

export default formatDateTimeTRLocal;

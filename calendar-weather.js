/*
문희농원 달력 날씨 표시 모듈
GitHub 저장소 루트에 calendar-weather.js 로 업로드하세요.

전제:
- Apps Script doGet()이 weatherRecords를 함께 반환해야 합니다.
- index.html에서 app.js 다음 줄에 이 파일을 불러와야 합니다.
*/

window.munhuiCalendarWeather = window.munhuiCalendarWeather || [];

function munhuiWeatherIcon_(weather) {
  const text = String(weather || '');
  if (/뇌우|우박/.test(text)) return '⛈️';
  if (/눈/.test(text)) return '🌨️';
  if (/비|소나기|이슬비/.test(text)) return '🌧️';
  if (/안개/.test(text)) return '🌫️';
  if (/흐림/.test(text)) return '☁️';
  if (/구름/.test(text)) return '⛅';
  if (/맑음/.test(text)) return '☀️';
  return '🌤️';
}

function munhuiWeatherTemp_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}°` : '';
}

function munhuiWeatherMap_() {
  const map = {};
  for (const row of window.munhuiCalendarWeather || []) {
    if (row && row.date) map[row.date] = row;
  }
  return map;
}

function munhuiAddCalendarWeatherStyles_() {
  if (document.getElementById('munhui-calendar-weather-style')) return;

  const style = document.createElement('style');
  style.id = 'munhui-calendar-weather-style';
  style.textContent = `
    #calendarGrid .day {
      position: relative;
      min-height: 62px;
      padding: 7px 3px 5px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 2px;
    }

    #calendarGrid .day .calendar-day-number {
      font-weight: 700;
      line-height: 1.1;
    }

    #calendarGrid .day .calendar-weather {
      margin-top: auto;
      width: 100%;
      text-align: center;
      font-size: 9.5px;
      line-height: 1.18;
      letter-spacing: -0.35px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: .84;
    }

    #calendarGrid .day .calendar-weather-humidity {
      display: block;
      font-size: 9px;
      opacity: .82;
    }

    #calendarGrid .day.other .calendar-weather {
      opacity: .35;
    }

    .selected-date-weather {
      margin: 8px 0 13px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(47, 111, 78, .08);
      font-size: 13px;
      line-height: 1.5;
    }

    .selected-date-weather strong {
      display: block;
      margin-bottom: 2px;
    }

    @media (max-width: 430px) {
      #calendarGrid .day {
        min-height: 58px;
      }

      #calendarGrid .day .calendar-weather {
        font-size: 8.8px;
      }

      #calendarGrid .day .calendar-weather-humidity {
        font-size: 8.3px;
      }
    }
  `;
  document.head.appendChild(style);
}

async function munhuiLoadCalendarWeather_() {
  try {
    const response = await fetch(SHEETS_API, { cache: 'no-store' });
    const data = await response.json();

    if (!data || !data.ok) return;

    window.munhuiCalendarWeather =
      Array.isArray(data.weatherRecords) ? data.weatherRecords : [];

    if (document.getElementById('journal')?.classList.contains('active')) {
      renderJournal();
    }
  } catch (error) {
    console.warn('완장리 날씨 데이터를 불러오지 못했습니다.', error);
  }
}

function renderCalendar(list) {
  munhuiAddCalendarWeatherStyles_();

  const counts = {};
  list.forEach(x => counts[x.workDate] = (counts[x.workDate] || 0) + 1);

  const weatherMap = munhuiWeatherMap_();

  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();

  document.getElementById('calendarTitle').textContent = `${y}년 ${m + 1}월`;

  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const today = localDateString(new Date());
  const grid = document.getElementById('calendarGrid');

  grid.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const key = localDateString(d);
    const w = weatherMap[key];

    const b = document.createElement('button');
    b.className = 'day';

    const number = document.createElement('span');
    number.className = 'calendar-day-number';
    number.textContent = d.getDate();
    b.appendChild(number);

    if (w) {
      const min = munhuiWeatherTemp_(w.minTemperature);
      const max = munhuiWeatherTemp_(w.maxTemperature);
      const temp = min && max ? `${min}~${max}` : (min || max);

      const weather = document.createElement('span');
      weather.className = 'calendar-weather';

      weather.innerHTML =
        `<span>${munhuiWeatherIcon_(w.weather)} ${esc(temp)}</span>` +
        (
          w.humidity !== '' &&
          w.humidity !== null &&
          w.humidity !== undefined
            ? `<span class="calendar-weather-humidity">💧${esc(Math.round(Number(w.humidity)))}%</span>`
            : ''
        );

      b.appendChild(weather);
    }

    if (d.getMonth() !== m) b.classList.add('other');
    if (key === today) b.classList.add('today');
    if (key === selectedCalendarDate) b.classList.add('selected');
    if (counts[key]) b.classList.add('has-entry');

    b.onclick = () => {
      selectedCalendarDate = key;
      calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      renderJournal();
    };

    grid.appendChild(b);
  }
}

function renderEntriesForDate(list) {
  const rows = list.filter(x => x.workDate === selectedCalendarDate);

  const [y, m, d] = selectedCalendarDate.split('-').map(Number);
  const weekday =
    ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];

  document.getElementById('selectedDateTitle').innerHTML =
    `${m}월 ${d}일 (${weekday}) <span class="entry-count">${rows.length}건</span>`;

  const weather = munhuiWeatherMap_()[selectedCalendarDate];

  let weatherHtml = '';

  if (weather) {
    const min = munhuiWeatherTemp_(weather.minTemperature);
    const max = munhuiWeatherTemp_(weather.maxTemperature);
    const temp = min && max ? `${min} ~ ${max}` : (min || max || '-');

    const details = [
      `${munhuiWeatherIcon_(weather.weather)} ${esc(weather.weather || '날씨')}`,
      `최저/최고 ${esc(temp)}`,
      weather.humidity !== '' && weather.humidity !== null && weather.humidity !== undefined
        ? `습도 ${esc(Math.round(Number(weather.humidity)))}%`
        : '',
      weather.precipitation !== '' && weather.precipitation !== null && weather.precipitation !== undefined
        ? `강수량 ${esc(weather.precipitation)}mm`
        : ''
    ].filter(Boolean);

    weatherHtml =
      `<div class="selected-date-weather">` +
      `<strong>📍 가은읍 완장리 자동 날씨</strong>` +
      `${details.join(' · ')}` +
      `</div>`;
  }

  document.getElementById('entries').innerHTML =
    weatherHtml +
    (
      rows.length
        ? rows.map(entryCard).join('')
        : '<div class="empty">이 날짜에는 저장된 작업이 없습니다.</div>'
    );
}

munhuiAddCalendarWeatherStyles_();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', munhuiLoadCalendarWeather_);
} else {
  munhuiLoadCalendarWeather_();
}

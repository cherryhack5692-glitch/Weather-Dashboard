const defaultCity = 'San Francisco';
const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with your actual OpenWeatherMap API key
let weatherChart = null;
let mapInstance = null;
let markerInstance = null;

const WEATHER_MAIN_ICON = {
  Clear: 'fa-solid fa-sun',
  Clouds: 'fa-solid fa-cloud',
  Rain: 'fa-solid fa-cloud-showers-heavy',
  Drizzle: 'fa-solid fa-cloud-rain',
  Thunderstorm: 'fa-solid fa-bolt',
  Snow: 'fa-solid fa-snowflake',
  Mist: 'fa-solid fa-smog',
  Haze: 'fa-solid fa-smog',
  Fog: 'fa-solid fa-smog',
  Dust: 'fa-solid fa-wind',
  Smoke: 'fa-solid fa-smog',
};

const elements = {
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  cityName: document.getElementById('cityName'),
  localTime: document.getElementById('localTime'),
  weatherStatus: document.getElementById('weatherStatus'),
  temperature: document.getElementById('temperature'),
  currentIcon: document.getElementById('currentIcon'),
  weatherDescription: document.getElementById('weatherDescription'),
  feelsLike: document.getElementById('feelsLike'),
  highTemp: document.getElementById('highTemp'),
  lowTemp: document.getElementById('lowTemp'),
  highlightsGrid: document.getElementById('highlightsGrid'),
  forecastRow: document.getElementById('forecastRow'),
  tempChart: document.getElementById('tempChart'),
};

async function loadApiKey() {
  if (window.location.protocol === 'file:') {
    return API_KEY;
  }

  try {
    const response = await fetch('api.txt');
    if (!response.ok) {
      throw new Error('api.txt not available');
    }
    const text = await response.text();
    const key = text.trim();
    return key || API_KEY;
  } catch (error) {
    console.warn('Unable to load api.txt; falling back to embedded key.', error);
    return API_KEY;
  }
}

function formatTime(timestamp, offsetSeconds) {
  const date = new Date((timestamp + offsetSeconds) * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

function formatDay(timestamp, offsetSeconds) {
  const date = new Date((timestamp + offsetSeconds) * 1000);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function formatDateLabel(timestamp, offsetSeconds) {
  const date = new Date((timestamp + offsetSeconds) * 1000);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function capitalize(text) {
  if (!text) return '';
  return text
    .split(' ')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function buildHighlights(current, uvIndex, timezoneOffset) {
  return [
    {
      label: 'Humidity',
      value: `${current.main.humidity}%`,
      sub: 'Air moisture',
    },
    {
      label: 'Wind Speed',
      value: `${Math.round(current.wind.speed * 3.6)} km/h`,
      sub: 'Wind direction',
    },
    {
      label: 'Pressure',
      value: `${current.main.pressure} hPa`,
      sub: 'Atmospheric pressure',
    },
    {
      label: 'Visibility',
      value: `${(current.visibility / 1000).toFixed(1)} km`,
      sub: 'Clear line of sight',
    },
    {
      label: 'UV Index',
      value: uvIndex !== null ? uvIndex.toFixed(1) : 'N/A',
      sub: uvIndex !== null ? 'Current UV exposure' : 'Not available',
    },
    {
      label: 'Cloud Coverage',
      value: `${current.clouds.all}%`,
      sub: 'Sky clarity',
    },
    {
      label: 'Sunrise',
      value: formatTime(current.sys.sunrise, timezoneOffset),
      sub: 'Morning start',
    },
    {
      label: 'Sunset',
      value: formatTime(current.sys.sunset, timezoneOffset),
      sub: 'Evening end',
    },
  ];
}

function renderHighlights(highlights) {
  elements.highlightsGrid.innerHTML = highlights
    .map(
      (item) => `
        <article class="card highlight-card ${item.label === 'UV Index' ? 'highlight-card--uv' : ''}">
          <h3>${item.label}</h3>
          <p>${item.value}</p>
          <span>${item.sub}</span>
        </article>
      `
    )
    .join('');
}

function renderForecast(daily, timezoneOffset) {
  const forecastItems = daily.slice(1, 6);
  elements.forecastRow.innerHTML = forecastItems
    .map((day) => {
      const iconClass = getWeatherIconClass(day.weather.main, day.weather.description || '');
      return `
        <article class="card forecast-card">
          <p>${formatDay(day.dt, timezoneOffset)}</p>
          <div class="forecast-icon"><i class="${iconClass} fa-fw" aria-hidden="true"></i></div>
          <div class="forecast-temp">
            <span>${Math.round(day.temp.min)}°</span>
            <span>&ndash;</span>
            <span>${Math.round(day.temp.max)}°</span>
          </div>
          <p>${capitalize(day.weather.main)}</p>
        </article>
      `;
    })
    .join('');
}

function renderChart(daily, timezoneOffset) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded. Skipping temperature trend rendering.');
    return;
  }

  const labels = daily.slice(1, 6).map((day) => formatDay(day.dt, timezoneOffset));
  const maxTemps = daily.slice(1, 6).map((day) => Math.round(day.temp.max));
  const minTemps = daily.slice(1, 6).map((day) => Math.round(day.temp.min));

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'High',
          data: maxTemps,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.18)',
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
        },
        {
          label: 'Low',
          data: minTemps,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.16)',
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#475569',
          },
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.24)',
          },
          ticks: {
            color: '#475569',
            callback: (value) => `${value}°`,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#475569',
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y}°`,
          },
        },
      },
    },
  };

  if (weatherChart) {
    weatherChart.data = config.data;
    weatherChart.options = config.options;
    weatherChart.update();
  } else {
    weatherChart = new Chart(elements.tempChart, config);
  }
}

function updateMap(lat, lon, city) {
  if (typeof L === 'undefined') {
    console.warn('Leaflet is not loaded, skipping map update.');
    return;
  }

  if (!mapInstance) {
    mapInstance = L.map('map', {
      scrollWheelZoom: false,
      zoomControl: false,
    }).setView([lat, lon], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);
  } else {
    mapInstance.setView([lat, lon], 10, {
      animate: true,
      duration: 0.8,
    });
  }

  if (markerInstance) {
    markerInstance.setLatLng([lat, lon]);
  } else {
    markerInstance = L.marker([lat, lon]).addTo(mapInstance);
  }
  markerInstance.bindPopup(`<strong>${city}</strong>`).openPopup();
}

function parseForecastToDaily(list, timezoneOffset) {
  const dailyMap = new Map();

  list.forEach((item) => {
    const localTs = (item.dt + timezoneOffset) * 1000;
    const localDate = new Date(localTs);
    const key = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth()}-${localDate.getUTCDate()}`;

    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        dt: item.dt,
        temp: {
          min: item.main.temp_min,
          max: item.main.temp_max,
        },
        weather: item.weather[0],
      });
    } else {
      const day = dailyMap.get(key);
      day.temp.min = Math.min(day.temp.min, item.main.temp_min);
      day.temp.max = Math.max(day.temp.max, item.main.temp_max);
    }
  });

  return Array.from(dailyMap.values()).slice(0, 6);
}

function updateHero(weather, daily, timezoneOffset) {
  const description = capitalize(weather.weather[0].description);
  const iconCode = weather.weather[0].icon;
  const temp = Math.round(weather.main.temp);
  const feels = Math.round(weather.main.feels_like);
  const today = daily[0] || { temp: { max: weather.main.temp, min: weather.main.temp } };
  const high = Math.round(today.temp.max);
  const low = Math.round(today.temp.min);

  const localTime = formatDateLabel(weather.dt, timezoneOffset);

  elements.cityName.textContent = `${weather.name}, ${weather.sys.country}`;
  elements.localTime.textContent = localTime;
  elements.weatherStatus.textContent = capitalize(weather.weather[0].main);
  elements.temperature.textContent = `${temp}°C`;
  elements.currentIcon.className = getWeatherIconClass(weather.weather[0].main, weather.weather[0].description);
  elements.weatherDescription.textContent = description;
  elements.feelsLike.textContent = `${feels}°C`;
  elements.highTemp.textContent = `${high}°C`;
  elements.lowTemp.textContent = `${low}°C`;
}

function getWeatherIconClass(weatherMain = '', weatherDescription = '') {
  const desc = weatherDescription.toLowerCase();
  if (desc.includes('frost') || desc.includes('freezing') || desc.includes('ice') || desc.includes('cold') || desc.includes('chill') || desc.includes('cool')) {
    return 'fa-solid fa-snowflake';
  }

  if (desc.includes('sunny')) {
    return 'fa-solid fa-sun';
  }

  if (weatherMain && WEATHER_MAIN_ICON[weatherMain]) {
    return WEATHER_MAIN_ICON[weatherMain];
  }

  return 'fa-solid fa-sun';
}

async function fetchUvIndex(lat, lon) {
  try {
    const uvRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&current_weather=true&timezone=UTC`
    );

    if (!uvRes.ok) {
      console.warn('Open-Meteo UV fetch failed:', uvRes.status);
      return null;
    }

    const uvData = await uvRes.json();
    const currentTime = uvData.current_weather?.time;
    const times = uvData.hourly?.time || [];
    const values = uvData.hourly?.uv_index || [];

    if (!times.length || !values.length) {
      return null;
    }

    const index = currentTime ? times.indexOf(currentTime) : -1;
    return index >= 0 ? values[index] : values[0] ?? null;
  } catch (error) {
    console.warn('Unable to fetch UV index:', error);
    return null;
  }
}

async function fetchWeatherData(city) {
  const apiKey = await loadApiKey();

  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
  );

  if (!weatherRes.ok) {
    const errorText = await weatherRes.text();
    throw new Error(`City lookup failed (${weatherRes.status}): ${errorText}`);
  }

  const weather = await weatherRes.json();

  const forecastRes = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${weather.coord.lat}&lon=${weather.coord.lon}&units=metric&appid=${apiKey}`
  );

  if (!forecastRes.ok) {
    const errorText = await forecastRes.text();
    throw new Error(`Forecast lookup failed (${forecastRes.status}): ${errorText}`);
  }

  const forecast = await forecastRes.json();
  const daily = parseForecastToDaily(forecast.list, weather.timezone);
  const uvIndex = await fetchUvIndex(weather.coord.lat, weather.coord.lon);

  return { weather, daily, timezoneOffset: weather.timezone, uvIndex };
}

async function loadCity(city) {
  try {
    const { weather, daily, timezoneOffset, uvIndex } = await fetchWeatherData(city);
    updateHero(weather, daily, timezoneOffset);
    renderHighlights(buildHighlights(weather, uvIndex, timezoneOffset));
    renderForecast(daily, timezoneOffset);
    renderChart(daily, timezoneOffset);
    updateMap(weather.coord.lat, weather.coord.lon, `${weather.name}, ${weather.sys.country}`);
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Unable to load weather for that location.';
    alert(`Unable to load weather for that location. ${message}`);
  }
}

function attachListeners() {
  if (!elements.searchForm) {
    console.error('Search form not found in the DOM.');
    return;
  }

  elements.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const city = elements.searchInput.value.trim();
    if (city) {
      loadCity(city);
      elements.searchInput.blur();
    }
  });
}

function initialize() {
  attachListeners();
  loadCity(defaultCity);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
// ---- Physical constants (as given) ----
const Na = 1e16;
const Nd = 1e15;
const q  = 1.602e-19;
const epsS = 11.7 * 8.85e-12;
document.getElementById('epsVal').textContent = epsS.toExponential(4);

// ---- DOM refs ----
const xpSlider = document.getElementById('xpSlider');
const xnSlider = document.getElementById('xnSlider');
const xpNumber = document.getElementById('xpNumber');
const xnNumber = document.getElementById('xnNumber');
const xpVal = document.getElementById('xpVal');
const xnVal = document.getElementById('xnVal');
const phiLeft = document.getElementById('phiLeft');
const phiMid = document.getElementById('phiMid');
const phiRight = document.getElementById('phiRight');

// phi(x): x_p_um, x_n_um are in micrometers (as entered).
// We convert to meters for the physics formula, x is swept in meters,
// then plotted back in micrometers.
function phiOf(xMeters, xpMeters, xnMeters) {
  if (xMeters < -xpMeters || xMeters > xnMeters) return null;
  if (xMeters <= 0) {
    return (q * Na) / (2 * epsS) * Math.pow(xMeters + xpMeters, 2);
  } else {
    return (q * Nd / epsS) * (xnMeters * xMeters - (xMeters * xMeters) / 2)
         + (q * Na) / (2 * epsS) * Math.pow(xpMeters, 2);
  }
}

function buildDataset(xp_um, xn_um) {
  const xp = xp_um * 1e-6; // meters
  const xn = xn_um * 1e-6;
  const N = 400;
  const points = [];
  for (let i = 0; i <= N; i++) {
    const x_um = -xp_um + (i / N) * (xp_um + xn_um);
    const xMeters = x_um * 1e-6;
    const phi = phiOf(xMeters, xp, xn);
    points.push({ x: x_um, y: phi });
  }
  return points;
}

const ctx = document.getElementById('phiChart').getContext('2d');
let chart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [{
      label: 'φ(x)',
      data: buildDataset(parseFloat(xpSlider.value), parseFloat(xnSlider.value)),
      borderColor: '#eaf2ef',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      segment: {
        borderColor: ctx => (ctx.p0.parsed.x <= 0 ? '#d9793f' : '#3f8fd9')
      }
    }]
  },
  options: {
    responsive: true,
    animation: { duration: 200 },
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'x (µm)', color: '#93a8a3', font: { family: 'monospace', size: 11 } },
        grid: { color: '#1f2a29' },
        ticks: { color: '#93a8a3', font: { family: 'monospace', size: 10 } }
      },
      y: {
        title: { display: true, text: 'φ(x) (V)', color: '#93a8a3', font: { family: 'monospace', size: 11 } },
        grid: { color: '#1f2a29' },
        ticks: { color: '#93a8a3', font: { family: 'monospace', size: 10 } }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => `φ = ${item.parsed.y.toExponential(4)} V`,
          title: (items) => `x = ${items[0].parsed.x.toFixed(2)} µm`
        }
      }
    }
  }
});

function update() {
  const xp_um = parseFloat(xpSlider.value);
  const xn_um = parseFloat(xnSlider.value);

  xpVal.textContent = xp_um + ' µm';
  xnVal.textContent = xn_um + ' µm';
  xpNumber.value = xp_um;
  xnNumber.value = xn_um;

  chart.data.datasets[0].data = buildDataset(xp_um, xn_um);
  chart.update('none');

  const xp = xp_um * 1e-6, xn = xn_um * 1e-6;
  const pLeft = phiOf(-xp, xp, xn);
  const pMid = phiOf(0, xp, xn);
  const pRight = phiOf(xn, xp, xn);
  phiLeft.textContent = pLeft.toExponential(4) + ' V';
  phiMid.textContent = pMid.toExponential(4) + ' V';
  phiRight.textContent = pRight.toExponential(4) + ' V';
}

function syncFromSlider(slider, number) {
  number.value = slider.value;
  update();
}
function syncFromNumber(slider, number) {
  let v = parseFloat(number.value);
  if (isNaN(v)) return;
  v = Math.min(1000, Math.max(0, v));
  slider.value = v;
  number.value = v;
  update();
}

xpSlider.addEventListener('input', () => syncFromSlider(xpSlider, xpNumber));
xnSlider.addEventListener('input', () => syncFromSlider(xnSlider, xnNumber));
xpNumber.addEventListener('change', () => syncFromNumber(xpSlider, xpNumber));
xnNumber.addEventListener('change', () => syncFromNumber(xnSlider, xnNumber));

update();